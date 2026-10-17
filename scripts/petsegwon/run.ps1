# Petsegwon stats pipeline runner (ASCII only to avoid encoding errors)
# Usage:
#   $env:DATA_GO_KR_KEY = "<decoding service key>"
#   .\run.ps1                 # registration + all industries + build
#   .\run.ps1 -Step build     # rebuild stats from existing raw files only

param(
    [ValidateSet("all", "registration", "businesses", "build")]
    [string]$Step = "all"
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$env:PYTHONIOENCODING = "utf-8"

if (-not (Test-Path ".\config.json")) {
    Write-Host "config.json not found. Copy config.example.json to config.json and fill TODO values."
    exit 1
}

if ($Step -ne "build" -and -not $env:DATA_GO_KR_KEY) {
    Write-Host "Set DATA_GO_KR_KEY first: `$env:DATA_GO_KR_KEY = '<key>'"
    exit 1
}

if ($Step -eq "all" -or $Step -eq "registration") {
    Write-Host "[1/3] Collecting dog registrations..."
    python .\collect_registrations.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Step -eq "all" -or $Step -eq "businesses") {
    Write-Host "[2/3] Collecting businesses..."
    python .\collect_businesses.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Step -eq "all" -or $Step -eq "build") {
    Write-Host "[3/3] Building stats..."
    python .\build_stats.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Done. Check out\validation.csv before publishing out\stats.json."
