<#
.SYNOPSIS
    Add / list / remove a TXT value on the project's Route 53 zone. No prompts.

.DESCRIPTION
    Built for site-verification records (Google Search Console domain property,
    Naver, etc.), which are plain TXT values on the apex.

    IMPORTANT - it MERGES. A Route 53 TXT record set holds several values, and
    an UPSERT replaces the whole set. Blindly writing one value would delete
    any SPF / DMARC / other verification values already there and silently
    break email. This script reads the current values first, adds (or removes)
    only the one you pass, and writes the merged set back.

    Idempotent: running it twice changes nothing the second time.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\dns-txt.ps1 -List
    .\scripts\dns-txt.ps1 -Add "google-site-verification=2dOK8..."
    .\scripts\dns-txt.ps1 -Add "naver-site-verification=abc" -Wait
    .\scripts\dns-txt.ps1 -Remove "google-site-verification=2dOK8..."
#>

[CmdletBinding(DefaultParameterSetName = 'List')]
param(
    # TXT value to add, without surrounding quotes.
    [Parameter(ParameterSetName = 'Add', Mandatory = $true)]
    [string]$Add,

    # TXT value to remove.
    [Parameter(ParameterSetName = 'Remove', Mandatory = $true)]
    [string]$Remove,

    # Show the current TXT values.
    [Parameter(ParameterSetName = 'List')]
    [switch]$List,

    # Apex domain (the hosted zone).
    [string]$Domain = 'petlifewith.me',

    # Sub-record, e.g. "_dmarc". Empty means the apex itself.
    [string]$Name = '',

    [int]$Ttl = 300,
    [string]$AwsProfile = 'petlife',

    # Block until Route 53 reports the change as INSYNC (usually under a minute).
    [switch]$Wait
)

$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''

function Write-Step { param([string]$Message) Write-Host "  [ OK ] $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "  [ .. ] $Message" }
function Fail { param([string]$Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

function Invoke-Aws {
    param([string[]]$CliArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & aws @CliArgs --profile $AwsProfile 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    return @{ ExitCode = $code; Text = (($out | ForEach-Object { "$_" }) -join "`n") }
}

function Invoke-AwsJson {
    param([string[]]$CliArgs, [string]$Label)
    $r = Invoke-Aws ($CliArgs + @('--output', 'json'))
    if ($r.ExitCode -ne 0) { Fail "$Label failed: $($r.Text)" }
    if (-not $r.Text.Trim()) { return $null }
    return $r.Text | ConvertFrom-Json
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Fail 'AWS CLI not found. Install: winget install Amazon.AWSCLI  (then open a NEW PowerShell window)'
}

# Fully qualified record name, always with the trailing dot Route 53 uses.
$recordName = if ($Name) { "$($Name.TrimEnd('.')).$Domain." } else { "$Domain." }

Write-Host "== TXT $recordName (zone $Domain) ==" -ForegroundColor Cyan

# --- hosted zone -----------------------------------------------------
$zones = Invoke-AwsJson @('route53', 'list-hosted-zones-by-name', '--dns-name', "$Domain.") 'list-hosted-zones-by-name'
$zone = @($zones.HostedZones | Where-Object { $_.Name -eq "$Domain." }) | Select-Object -First 1
if (-not $zone) { Fail "No Route 53 hosted zone for $Domain in this account (profile '$AwsProfile')." }
$zoneId = $zone.Id -replace '^/hostedzone/', ''

# --- current values --------------------------------------------------
$sets = Invoke-AwsJson @(
    'route53', 'list-resource-record-sets',
    '--hosted-zone-id', $zoneId,
    '--start-record-name', $recordName,
    '--start-record-type', 'TXT',
    '--max-items', '1'
) 'list-resource-record-sets'

$existing = @($sets.ResourceRecordSets | Where-Object { $_.Name -eq $recordName -and $_.Type -eq 'TXT' }) | Select-Object -First 1
# Route 53 stores TXT values wrapped in double quotes - strip them for comparison.
$values = @()
if ($existing) {
    $values = @($existing.ResourceRecords | ForEach-Object { $_.Value -replace '^"', '' -replace '"$', '' })
}

if ($values.Count -eq 0) { Write-Host '  (no TXT values yet)' }
else { foreach ($v in $values) { Write-Host "  $v" } }

if ($PSCmdlet.ParameterSetName -eq 'List') {
    Write-Host ''
    Write-Host "  Add:    .\scripts\dns-txt.ps1 -Add `"google-site-verification=...`""
    Write-Host "  Remove: .\scripts\dns-txt.ps1 -Remove `"google-site-verification=...`""
    exit 0
}

# --- compute the new value set --------------------------------------
if ($PSCmdlet.ParameterSetName -eq 'Add') {
    $target = $Add.Trim().Trim('"')
    if (-not $target) { Fail 'Empty value.' }
    if ($values -contains $target) {
        Write-Step 'Already present - nothing to change.'
        exit 0
    }
    $newValues = @($values + $target)
    $action = 'UPSERT'
} else {
    $target = $Remove.Trim().Trim('"')
    if ($values -notcontains $target) {
        Write-Step 'Not present - nothing to change.'
        exit 0
    }
    $newValues = @($values | Where-Object { $_ -ne $target })
    # Removing the last value means the record set itself must go.
    $action = if ($newValues.Count -eq 0) { 'DELETE' } else { 'UPSERT' }
}

# For DELETE, Route 53 requires the record exactly as it exists today.
$recordValues = if ($action -eq 'DELETE') { $values } else { $newValues }
$ttlToSend = if ($action -eq 'DELETE' -and $existing) { [int]$existing.TTL } else { $Ttl }

$changeBatch = @{
    Comment = 'site verification TXT (scripts/dns-txt.ps1)'
    Changes = @(
        @{
            Action            = $action
            ResourceRecordSet = @{
                Name            = $recordName
                Type            = 'TXT'
                TTL             = $ttlToSend
                # TXT values must be sent quoted.
                ResourceRecords = @($recordValues | ForEach-Object { @{ Value = '"' + $_ + '"' } })
            }
        }
    )
}

$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("r53-txt-" + [System.Guid]::NewGuid().ToString('N') + '.json')
($changeBatch | ConvertTo-Json -Depth 10 -Compress) | Set-Content -Path $tempFile -Encoding Ascii

try {
    Write-Info "$action -> $($recordValues.Count) value(s)"
    $result = Invoke-AwsJson @(
        'route53', 'change-resource-record-sets',
        '--hosted-zone-id', $zoneId,
        '--change-batch', "file://$tempFile"
    ) 'change-resource-record-sets'
} finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

$changeId = $result.ChangeInfo.Id
Write-Step "Submitted ($($result.ChangeInfo.Status))"

if ($Wait -and $changeId) {
    Write-Info 'Waiting until Route 53 reports INSYNC ...'
    $w = Invoke-Aws @('route53', 'wait', 'resource-record-sets-changed', '--id', $changeId)
    if ($w.ExitCode -ne 0) { Write-Host "  [WARN] waiter failed: $($w.Text)" -ForegroundColor Yellow }
    else { Write-Step 'INSYNC' }
}

Write-Host ''
Write-Host '  Check propagation:'
Write-Host "    Resolve-DnsName -Type TXT $($recordName.TrimEnd('.')) -Server 8.8.8.8"
Write-Host '  Then press Verify in Search Console (domain property).'
