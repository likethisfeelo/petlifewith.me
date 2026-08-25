<#
.SYNOPSIS
    Fetch recent Lambda logs for a deployed stage. No interactive prompts.

.DESCRIPTION
    Finds the CloudWatch log groups of this app's Lambda functions
    (names contain "petlife-<stage>") and prints recent events, so you can
    see WHY the site returns 5xx without opening the AWS console.

    Typical use: the site shows "Internal Server Error" on every path ->
    run this, look for the first stack trace ("Runtime.*", "Error", "Cannot
    find module ...") and share it.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\aws-logs.ps1 -Stage dev
    .\scripts\aws-logs.ps1 -Stage dev -Minutes 180
    .\scripts\aws-logs.ps1 -Stage dev -ErrorsOnly
#>

[CmdletBinding()]
param(
    [ValidateSet('dev', 'prod')]
    [string]$Stage = 'dev',
    [string]$AwsProfile = 'petlife',
    [string]$Region = 'ap-northeast-2',
    # How far back to read.
    [int]$Minutes = 60,
    # Print only lines that look like errors (plus a little context is lost - use without it for full logs).
    [switch]$ErrorsOnly
)

$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''

function Fail { param([string]$Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

function Invoke-Aws {
    param([string[]]$CliArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & aws @CliArgs --profile $AwsProfile --region $Region 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    return @{ ExitCode = $code; Text = (($out | ForEach-Object { "$_" }) -join "`n") }
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Fail 'AWS CLI not found. Install: winget install Amazon.AWSCLI'
}

Write-Host "== Lambda log groups for stage '$Stage' ==" -ForegroundColor Cyan
$r = Invoke-Aws @('logs', 'describe-log-groups', '--log-group-name-prefix', '/aws/lambda/', '--query', 'logGroups[].logGroupName', '--output', 'json')
if ($r.ExitCode -ne 0) { Fail "describe-log-groups failed: $($r.Text)" }
# Windows PowerShell 5.1: ConvertFrom-Json emits a JSON array as ONE array
# object (PowerShell 7 enumerates it) - pipe through ForEach-Object so both
# editions yield one string per log group.
$all = @(($r.Text | ConvertFrom-Json) | ForEach-Object { "$_" })
$needle = "petlife-$Stage"
$groups = @($all | Where-Object { $_ -match [regex]::Escape($needle) })
if ($groups.Count -eq 0) {
    Write-Host "  No log groups matching '$needle' found. All lambda groups:" -ForegroundColor Yellow
    $all | ForEach-Object { Write-Host "    $_" }
    Fail 'Is the stage deployed, and is the profile pointing at the right account?'
}
$groups | ForEach-Object { Write-Host "  $_" }

foreach ($g in $groups) {
    Write-Host ''
    Write-Host "== $g (last $Minutes min) ==" -ForegroundColor Cyan
    $t = Invoke-Aws @('logs', 'tail', $g, '--since', "${Minutes}m", '--format', 'short')
    if ($t.ExitCode -ne 0) {
        Write-Host "  (tail failed: $($t.Text))" -ForegroundColor Yellow
        continue
    }
    if (-not $t.Text.Trim()) {
        Write-Host '  (no events in this window)'
        continue
    }
    if ($ErrorsOnly) {
        $lines = $t.Text -split "`n" | Where-Object { $_ -match 'ERROR|Error|error|Task timed out|Runtime\.|Cannot find|Unhandled|EACCES|ENOENT|ETIMEDOUT|ECONNREFUSED' }
        if ($lines.Count -eq 0) { Write-Host '  (no error-looking lines - run without -ErrorsOnly for full output)' }
        else { $lines | Select-Object -First 120 | ForEach-Object { Write-Host $_ } }
    } else {
        $t.Text -split "`n" | Select-Object -First 250 | ForEach-Object { Write-Host $_ }
    }
}

Write-Host ''
Write-Host 'Share the first stack trace above to diagnose 5xx errors.'
