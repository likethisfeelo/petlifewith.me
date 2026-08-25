<#
.SYNOPSIS
    Remove a deployed stage (sst remove). Refuses to run without -Yes.

.DESCRIPTION
    Removes the CloudFront/Lambda/S3 resources of one stage. Never prompts -
    instead it refuses unless the -Yes switch is passed explicitly.

    - The RDS database is NOT managed by SST and is never touched here.
      Deleting it is a manual, deliberate act (commands are printed below).
    - Stage 'prod' is declared with protect + retain in sst.config.ts, so
      removal is blocked twice: this script requires -Force, and SST itself
      refuses protected resources until sst.config.ts is edited.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\aws-destroy.ps1 -Stage dev            # shows what would happen, refuses
    .\scripts\aws-destroy.ps1 -Stage dev -Yes       # actually removes the dev stack
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prod')]
    [string]$Stage,

    # Required to actually remove anything.
    [switch]$Yes,

    # Additionally required for -Stage prod.
    [switch]$Force,

    [string]$AwsProfile = 'petlife'
)

$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''
$env:SST_TELEMETRY_DISABLE = '1'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root (pnpm-workspace.yaml not found).'
}

function Fail { param([string]$Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

Write-Host "== Remove stage '$Stage' ==" -ForegroundColor Cyan
Write-Host '  This removes: CloudFront distribution, Lambda functions, site assets,'
Write-Host '  and (non-prod only) the media bucket of this stage.'
Write-Host '  It does NOT touch: the RDS database, Route 53 zone, ACM certificate.'

if (-not $Yes) {
    Write-Host ''
    Write-Host '  Refusing without -Yes. To proceed:' -ForegroundColor Yellow
    Write-Host "    .\scripts\aws-destroy.ps1 -Stage $Stage -Yes"
    exit 1
}
if ($Stage -eq 'prod' -and -not $Force) {
    Fail 'prod additionally requires -Force, and sst.config.ts declares prod as protect+retain - edit it first if you truly mean to tear prod down.'
}

$prevProfile = $env:AWS_PROFILE
$env:AWS_PROFILE = $AwsProfile
try {
    & pnpm exec sst remove --stage $Stage
    if ($LASTEXITCODE -ne 0) { Fail "sst remove failed (exit $LASTEXITCODE)." }
} finally {
    if ($null -ne $prevProfile) { $env:AWS_PROFILE = $prevProfile } else { Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host '== Removed ==' -ForegroundColor Cyan
Write-Host '  The RDS instance is still running (it costs money). To delete it manually:'
Write-Host '    aws rds modify-db-instance --db-instance-identifier petlife-db --no-deletion-protection --apply-immediately --profile petlife'
Write-Host '    aws rds delete-db-instance --db-instance-identifier petlife-db --final-db-snapshot-identifier petlife-db-final --profile petlife'
