<#
.SYNOPSIS
    Run the license-data ETL against a CSV downloaded from data.go.kr.

.DESCRIPTION
    Thin wrapper over "pnpm etl:license". Put raw CSV files under data\raw\
    (gitignored) and pass the relative path.

    Datasets:
      animal-beauty     - grooming/spa licenses
      animal-boarding   - boarding/daycare licenses
      animal-memorial   - memorial licenses (no ads on these pages)
      animal-transport  - transport licenses
      feed-manufacture  - feed manufacturing registry (maker badges)

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\etl.ps1 -Dataset animal-beauty -File data\raw\beauty.csv -ReferenceDate 2026-08-01
    .\scripts\etl.ps1 -Dataset animal-beauty -File data\raw\beauty.csv -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('animal-beauty', 'animal-boarding', 'animal-memorial', 'animal-transport', 'feed-manufacture')]
    [string]$Dataset,

    [Parameter(Mandatory)][string]$File,

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

$etlArgs = @('--dataset', $Dataset, '--file', $File, '--encoding', $Encoding)
if ($ReferenceDate) { $etlArgs += @('--reference-date', $ReferenceDate) }
if ($DryRun) { $etlArgs += '--dry-run' }

pnpm etl:license -- @etlArgs
