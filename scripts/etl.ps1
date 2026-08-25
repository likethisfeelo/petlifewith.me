<#
.SYNOPSIS
    Run the license-data ETL against a CSV downloaded from data.go.kr.

.DESCRIPTION
    Thin wrapper over "pnpm etl:license". Put raw CSV files under data\raw\
    (gitignored) and pass the relative path.

    Datasets:
      animal-beauty          - grooming/spa licenses
      animal-boarding        - boarding/daycare licenses
      animal-memorial        - memorial licenses (no ads on these pages)
      animal-transport       - transport licenses
      animal-pharmacy        - animal pharmacies (no ads, vet-consult note)
      animal-drug-wholesale  - drug wholesalers (B2B, not listed publicly)
      animal-medical-device  - medical device retailers (B2B, not listed publicly)
      feed-manufacture       - feed manufacturing registry (maker badges)

    Which database it loads into:
      (default)      local dev DB from the root .env.local (setup.ps1 creates it)
      -Stage dev     the DEPLOYED dev database  - reads DATABASE_URL from .env.deploy.dev
      -Stage prod    the DEPLOYED prod database - reads DATABASE_URL from .env.deploy.prod

    Run migrations/seeds first when the schema changed: .\scripts\db.ps1 -Stage dev

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.
    (Korean FILE NAMES passed as arguments are fine.)

.EXAMPLE
    .\scripts\etl.ps1 -Stage dev -Dataset animal-pharmacy -File "data\raw\pharmacy.csv" -Encoding cp949 -ReferenceDate 2026-08-25
    .\scripts\etl.ps1 -Dataset animal-beauty -File data\raw\beauty.csv -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('animal-beauty', 'animal-boarding', 'animal-memorial', 'animal-transport',
        'animal-pharmacy', 'animal-drug-wholesale', 'animal-medical-device', 'feed-manufacture')]
    [string]$Dataset,

    [Parameter(Mandatory)][string]$File,

    # Load into a deployed stage database instead of the local one.
    [ValidateSet('dev', 'prod')]
    [string]$Stage,

    [string]$ReferenceDate,

    [ValidateSet('auto', 'utf8', 'cp949')]
    [string]$Encoding = 'auto',

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root.'
}
if (-not (Test-Path $File)) {
    throw "File not found: $File"
}

$prevDbUrl = $env:DATABASE_URL
if ($Stage) {
    $envFile = ".env.deploy.$Stage"
    if (-not (Test-Path $envFile)) {
        throw "$envFile not found. Run .\scripts\aws-db.ps1 first (it creates the deploy env files)."
    }
    $line = Select-String -Path $envFile -Pattern '^\s*DATABASE_URL=(.+)$' | Select-Object -First 1
    if (-not $line) { throw "$envFile has no DATABASE_URL. Re-run .\scripts\aws-db.ps1" }
    $env:DATABASE_URL = $line.Matches[0].Groups[1].Value.Trim()
    Write-Host "  [ OK ] Using the '$Stage' stage database from $envFile" -ForegroundColor Green
}

$etlArgs = @('--dataset', $Dataset, '--file', $File, '--encoding', $Encoding)
if ($ReferenceDate) { $etlArgs += @('--reference-date', $ReferenceDate) }
if ($DryRun) { $etlArgs += '--dry-run' }

try {
    pnpm etl:license -- @etlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] ETL failed (exit $LASTEXITCODE). Check the report under data\reports\" -ForegroundColor Red
        exit 1
    }
} finally {
    if ($null -ne $prevDbUrl) { $env:DATABASE_URL = $prevDbUrl }
    else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
}
