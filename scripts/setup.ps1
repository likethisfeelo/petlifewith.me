<#
.SYNOPSIS
    One-time local development setup: env file, dependencies, database.

.DESCRIPTION
    1. Copies .env.example to .env.local when missing (fill values afterwards).
    2. Installs pnpm dependencies.
    3. Starts the dev database container (docker compose).
    4. Applies migrations and base/content seeds.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\setup.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$WithDevFixtures
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root.'
}

Write-Host ''
Write-Host '  Local setup' -ForegroundColor Cyan
Write-Host '  ----------------------------------------------------------' -ForegroundColor DarkGray

# ---- 1. env file ----------------------------------------------------
if (-not (Test-Path '.env.local')) {
    Copy-Item '.env.example' '.env.local'
    Write-Host '  [ OK ] .env.local created from .env.example - fill in values!' -ForegroundColor Yellow
} else {
    Write-Host '  [ OK ] .env.local exists' -ForegroundColor Green
}

# ---- 2. dependencies ------------------------------------------------
pnpm install
Write-Host '  [ OK ] pnpm install' -ForegroundColor Green

# ---- 3. database container -----------------------------------------
if (-not $SkipDocker) {
    docker compose up -d db
    Write-Host '  [ OK ] postgres container started (docker compose)' -ForegroundColor Green
    Start-Sleep -Seconds 3
} else {
    Write-Host '  [SKIP] docker (use local postgres, check DATABASE_URL)' -ForegroundColor DarkGray
}

# ---- 4. migrate + seed ----------------------------------------------
pnpm db:migrate
Write-Host '  [ OK ] migrations applied' -ForegroundColor Green

pnpm seed
Write-Host '  [ OK ] base + content seed done' -ForegroundColor Green

if ($WithDevFixtures) {
    pnpm seed:dev
    Write-Host '  [ OK ] dev fixtures (sample spots/makers/items) loaded' -ForegroundColor Green
}

Write-Host ''
Write-Host '  Done. Start the app with: pnpm dev' -ForegroundColor Cyan
Write-Host ''
