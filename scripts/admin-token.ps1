<#
.SYNOPSIS
    Manage admin accounts (labelled tokens) for a stage. No interactive prompts.

.DESCRIPTION
    Admin login uses ADMIN_TOKEN, which holds one or more accounts:

        ADMIN_TOKEN=<token>                        one account, label "admin"
        ADMIN_TOKEN=hee:<token1>,partner:<token2>  one account per person

    Each person gets their OWN token, so it can be revoked individually and the
    admin panel shows who is signed in. Removing an account also kills that
    person's existing session on the next request (the session stores a
    fingerprint of the token).

    Env file per stage:
        local -> .env.local            (local development)
        dev   -> .env.deploy.dev       (dev.petlifewith.me)
        prod  -> .env.deploy.prod      (petlifewith.me)

    After changing a DEPLOYED stage you must update the GitHub secret and
    redeploy - this script prints the exact steps.

    The generated token is printed once. Hand it to the person over a private
    channel (password manager). Never paste it into chat, commits or issues.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\admin-token.ps1 -Stage prod -List
    .\scripts\admin-token.ps1 -Stage prod -Add hee
    .\scripts\admin-token.ps1 -Stage prod -Remove partner
    .\scripts\admin-token.ps1 -Generate                 # just print a token, change nothing
#>

[CmdletBinding(DefaultParameterSetName = 'List')]
param(
    [ValidateSet('local', 'dev', 'prod')]
    [string]$Stage = 'prod',

    # Show the accounts registered for this stage (labels only, never tokens).
    [Parameter(ParameterSetName = 'List')]
    [switch]$List,

    # Add an account with this label and a freshly generated token.
    [Parameter(ParameterSetName = 'Add', Mandatory = $true)]
    [string]$Add,

    # Remove the account with this label (revokes their access and session).
    [Parameter(ParameterSetName = 'Remove', Mandatory = $true)]
    [string]$Remove,

    # Print a new random token without touching any file.
    [Parameter(ParameterSetName = 'Generate', Mandatory = $true)]
    [switch]$Generate
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root (pnpm-workspace.yaml not found).'
}

function Write-Step { param([string]$Message) Write-Host "  [ OK ] $Message" -ForegroundColor Green }
function Write-Warn2 { param([string]$Message) Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Fail { param([string]$Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

function New-Token {
    # 24 bytes -> 48 hex chars. Hex keeps the value free of ':' and ',' which
    # separate label and account in ADMIN_TOKEN.
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] 24
    $rng.GetBytes($buf)
    $rng.Dispose()
    return ([System.BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

function Get-EnvFile {
    param([string]$StageName)
    if ($StageName -eq 'local') { return '.env.local' }
    return ".env.deploy.$StageName"
}

# Returns an ordered list of @{ Label; Token } parsed the same way lib/config.ts does.
function Read-Accounts {
    param([string]$Value)
    $accounts = @()
    if (-not $Value) { return $accounts }
    foreach ($entry in ($Value -split '[,\n]')) {
        $trimmed = $entry.Trim()
        if (-not $trimmed) { continue }
        $label = 'admin'
        $token = $trimmed
        $colon = $trimmed.IndexOf(':')
        if ($colon -gt 0) {
            $prefix = $trimmed.Substring(0, $colon)
            if ($prefix -match '^[A-Za-z0-9._-]{1,32}$') {
                $label = $prefix
                $token = $trimmed.Substring($colon + 1).Trim()
            }
        }
        if (-not $token) { continue }
        if ($accounts | Where-Object { $_.Label -eq $label }) { continue }
        $accounts += @{ Label = $label; Token = $token }
    }
    return $accounts
}

function Format-Accounts {
    param($Accounts)
    return (($Accounts | ForEach-Object { "$($_.Label):$($_.Token)" }) -join ',')
}

if ($PSCmdlet.ParameterSetName -eq 'Generate') {
    Write-Host '== New admin token (nothing was changed) ==' -ForegroundColor Cyan
    Write-Host "  $(New-Token)"
    Write-Host '  Add it under a label:  ADMIN_TOKEN=<existing>,<label>:<this token>'
    exit 0
}

$envFile = Get-EnvFile $Stage
if (-not (Test-Path $envFile)) {
    Fail "$envFile not found. Run .\scripts\aws-db.ps1 (deploy stages) or .\scripts\setup.ps1 (local) first."
}

$lines = @(Get-Content $envFile)
$current = ''
foreach ($line in $lines) {
    if ($line -match '^\s*ADMIN_TOKEN=(.*)$') { $current = $Matches[1].Trim() }
}
$accounts = @(Read-Accounts $current)

Write-Host "== Admin accounts for stage '$Stage' ($envFile) ==" -ForegroundColor Cyan

if ($PSCmdlet.ParameterSetName -eq 'List') {
    if ($accounts.Count -eq 0) {
        Write-Warn2 'No accounts registered - nobody can sign in to the admin panel.'
    } else {
        foreach ($a in $accounts) { Write-Host "  $($a.Label)" }
        Write-Host "  ($($accounts.Count) account(s); tokens are not printed)"
    }
    Write-Host ''
    Write-Host "  Add:    .\scripts\admin-token.ps1 -Stage $Stage -Add <label>"
    Write-Host "  Remove: .\scripts\admin-token.ps1 -Stage $Stage -Remove <label>"
    exit 0
}

if ($PSCmdlet.ParameterSetName -eq 'Add') {
    if ($Add -notmatch '^[A-Za-z0-9._-]{1,32}$') {
        Fail "Label must be 1-32 chars of A-Z a-z 0-9 . _ - (got '$Add')."
    }
    if ($accounts | Where-Object { $_.Label -eq $Add }) {
        Fail "Label '$Add' already exists. Remove it first to rotate: -Remove $Add"
    }
    $token = New-Token
    $accounts += @{ Label = $Add; Token = $token }
    $newValue = Format-Accounts $accounts
} else {
    $match = @($accounts | Where-Object { $_.Label -eq $Remove })
    if ($match.Count -eq 0) {
        Write-Host "  Known labels: $((($accounts | ForEach-Object { $_.Label }) -join ', '))"
        Fail "Label '$Remove' not found."
    }
    $accounts = @($accounts | Where-Object { $_.Label -ne $Remove })
    if ($accounts.Count -eq 0) {
        Fail "Refusing to remove the last account - nobody could sign in. Add another one first."
    }
    $newValue = Format-Accounts $accounts
}

# Rewrite only the ADMIN_TOKEN line, keep everything else byte-for-byte.
$found = $false
$updated = @($lines | ForEach-Object {
    if ($_ -match '^\s*ADMIN_TOKEN=') { $found = $true; "ADMIN_TOKEN=$newValue" } else { $_ }
})
if (-not $found) { $updated += "ADMIN_TOKEN=$newValue" }
Set-Content -Path $envFile -Value $updated -Encoding Ascii

if ($PSCmdlet.ParameterSetName -eq 'Add') {
    Write-Step "Account '$Add' added to $envFile"
    Write-Host ''
    Write-Host '  Token (hand over privately, shown once):' -ForegroundColor Yellow
    Write-Host "    $token"
    Write-Host ''
} else {
    Write-Step "Account '$Remove' removed from $envFile - their session dies on the next request after deploy"
}
Write-Host "  Accounts now: $((($accounts | ForEach-Object { $_.Label }) -join ', '))"

if ($Stage -eq 'local') {
    Write-Host '  Restart the dev server (pnpm dev) to pick it up.'
} else {
    $secret = "ENV_DEPLOY_$($Stage.ToUpper())"
    Write-Host ''
    Write-Host '  Apply it to the deployed site:'
    Write-Host "    1. Get-Content $envFile -Raw | Set-Clipboard"
    Write-Host "    2. GitHub -> Settings -> Secrets and variables -> Actions -> $secret -> Update secret -> paste"
    Write-Host "    3. Actions -> deploy -> Run workflow -> stage $Stage"
}
