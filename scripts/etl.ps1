<#
.SYNOPSIS
    Load a dataset into the database: license CSVs from data.go.kr, or the
    curated (hand-edited) CSVs under data\content\.

.DESCRIPTION
    Thin wrapper over the pnpm ETL scripts. Raw government CSVs go under
    data\raw\ (gitignored). Curated lists live in the repository under
    data\content\ and are edited by hand ("#" in a cell = unconfirmed).

    License datasets (pnpm etl:license, -File required, data.go.kr CSV):
      animal-beauty          - grooming/spa licenses
      animal-boarding        - boarding/daycare licenses
      animal-memorial        - memorial licenses (no ads on these pages)
      animal-transport       - transport licenses
      animal-pharmacy        - animal pharmacies (no ads, vet-consult note)
      animal-drug-wholesale  - drug wholesalers (B2B reference directory)
      animal-medical-device  - medical device retailers (B2B reference directory)
      feed-manufacture       - feed manufacturing registry (maker badges)

    Curated datasets (upsert by the "external key" column; "#" cells never
    overwrite values entered in the admin panel):
      direct-spots           - hand-picked spots -> spots/spot_links (source=direct)
                               pnpm etl:direct   -File required
                               e.g. data\content\spots\soomgo-grooming-2026-09.csv
      rehab-sites            - rehab / oriental / special-treatment providers
                               pnpm etl:rehab    -File optional
                               default data\content\rehab\rehab-sites.csv

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
    .\scripts\etl.ps1 -Stage dev -Dataset direct-spots -File data\content\spots\soomgo-grooming-2026-09.csv
    .\scripts\etl.ps1 -Stage prod -Dataset rehab-sites
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('animal-beauty', 'animal-boarding', 'animal-memorial', 'animal-transport',
        'animal-pharmacy', 'animal-drug-wholesale', 'animal-medical-device', 'feed-manufacture',
        'direct-spots', 'rehab-sites')]
    [string]$Dataset,

    # CSV path. Required for every dataset except rehab-sites (which has a default).
    [string]$File,

    # Load into a deployed stage database instead of the local one.
    [ValidateSet('dev', 'prod')]
    [string]$Stage,

    # License datasets only: data reference date (YYYY-MM-DD).
    [string]$ReferenceDate,

    # License datasets only: source file encoding.
    [ValidateSet('auto', 'utf8', 'cp949')]
    [string]$Encoding = 'auto',

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root.'
}

$curated = @{
    'direct-spots' = @{ Script = 'etl:direct'; DefaultFile = $null }
    'rehab-sites'  = @{ Script = 'etl:rehab';  DefaultFile = 'data/content/rehab/rehab-sites.csv' }
}

if ($curated.ContainsKey($Dataset)) {
    if (-not $File) { $File = $curated[$Dataset].DefaultFile }
    if (-not $File) { throw "-File is required for dataset '$Dataset'." }
    if ($ReferenceDate -or $Encoding -ne 'auto') {
        Write-Host "  [WARN] -ReferenceDate / -Encoding apply to license datasets only and are ignored here." -ForegroundColor Yellow
    }
} elseif (-not $File) {
    throw "-File is required for dataset '$Dataset' (a CSV downloaded from data.go.kr, under data\raw\)."
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

if ($curated.ContainsKey($Dataset)) {
    $script = $curated[$Dataset].Script
    $etlArgs = @('--file', $File)
} else {
    $script = 'etl:license'
    $etlArgs = @('--dataset', $Dataset, '--file', $File, '--encoding', $Encoding)
    if ($ReferenceDate) { $etlArgs += @('--reference-date', $ReferenceDate) }
}
if ($DryRun) { $etlArgs += '--dry-run' }

try {
    Write-Host "  [ .. ] pnpm $script -- $($etlArgs -join ' ')"
    pnpm $script -- @etlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] ETL failed (exit $LASTEXITCODE). Check the report under data\reports\" -ForegroundColor Red
        exit 1
    }
} finally {
    if ($null -ne $prevDbUrl) { $env:DATABASE_URL = $prevDbUrl }
    else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
}
