<#
.SYNOPSIS
    Migrate / seed / inspect a database (local or a deployed stage). No prompts.

.DESCRIPTION
    The data commands (db:migrate, seed:base, ETL) read DATABASE_URL from the
    root .env.local by default - that file only exists for LOCAL development
    (setup.ps1 creates it). To work on a DEPLOYED database instead, this script
    reads DATABASE_URL from .env.deploy.<stage> (created by aws-db.ps1) and
    runs the task against it.

    Tasks:
      migrate  - apply schema migrations (drizzle)
      seed     - base reference data only (topics / spot types / regions).
                 Idempotent. Content seeds are NOT offered here on purpose:
                 they overwrite admin edits to guide bodies.
      status   - connection check + row counts (tables, spots by type, ...)
      all      - migrate + seed + status (default)

    deploy.ps1 already runs migrate + seed for the stage it deploys, so this
    script is for doing the same WITHOUT deploying (e.g. before running ETL).

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\db.ps1 -Stage dev              # migrate + seed + status on the dev DB
    .\scripts\db.ps1 -Stage dev -Task status # just show what is in the dev DB
    .\scripts\db.ps1 -Task migrate           # local DB (.env.local) migrate only
#>

[CmdletBinding()]
param(
    # Deployed stage database. Omit to use the local .env.local database.
    [ValidateSet('dev', 'prod')]
    [string]$Stage,

    [ValidateSet('migrate', 'seed', 'status', 'all')]
    [string]$Task = 'all'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root (pnpm-workspace.yaml not found).'
}

function Write-Step { param([string]$Message) Write-Host "  [ OK ] $Message" -ForegroundColor Green }
function Fail { param([string]$Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

function Invoke-Pnpm {
    param([string]$Label, [string[]]$CliArgs)
    & pnpm @CliArgs
    if ($LASTEXITCODE -ne 0) { Fail "$Label failed (exit $LASTEXITCODE)." }
    Write-Step $Label
}

$prevDbUrl = $env:DATABASE_URL
if ($Stage) {
    $envFile = ".env.deploy.$Stage"
    if (-not (Test-Path $envFile)) {
        Fail "$envFile not found. Run .\scripts\aws-db.ps1 first (it creates the deploy env files)."
    }
    $line = Select-String -Path $envFile -Pattern '^\s*DATABASE_URL=(.+)$' | Select-Object -First 1
    if (-not $line) { Fail "$envFile has no DATABASE_URL. Re-run .\scripts\aws-db.ps1" }
    $env:DATABASE_URL = $line.Matches[0].Groups[1].Value.Trim()
    Write-Host "== Target: '$Stage' stage database (from $envFile) ==" -ForegroundColor Cyan
} else {
    if (-not (Test-Path '.env.local')) {
        Fail 'No .env.local (local dev DB is not set up). Either run .\scripts\setup.ps1 for local development, or pass -Stage dev|prod to target a deployed database.'
    }
    $line = Select-String -Path '.env.local' -Pattern '^\s*DATABASE_URL=(.+)$' | Select-Object -First 1
    if (-not $line) { Fail '.env.local has no DATABASE_URL. Re-run .\scripts\setup.ps1' }
    $env:DATABASE_URL = $line.Matches[0].Groups[1].Value.Trim()
    Write-Host '== Target: local database (.env.local) ==' -ForegroundColor Cyan
}

if (-not (Test-Path 'node_modules')) {
    Invoke-Pnpm 'pnpm install' @('install', '--frozen-lockfile')
}

try {
    if ($Task -eq 'migrate' -or $Task -eq 'all') {
        Invoke-Pnpm 'migrate' @('--filter', '@app/data', 'db:migrate')
    }
    if ($Task -eq 'seed' -or $Task -eq 'all') {
        Invoke-Pnpm 'seed:base (topics / spot types / regions)' @('--filter', '@app/data', 'seed:base')
    }
    if ($Task -eq 'status' -or $Task -eq 'all') {
        Invoke-Pnpm 'status' @('--filter', '@app/data', 'exec', 'node', 'src/db/status.mjs')
    }
} finally {
    if ($null -ne $prevDbUrl) { $env:DATABASE_URL = $prevDbUrl }
    else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
}
