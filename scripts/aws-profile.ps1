<#
.SYNOPSIS
    Check and switch AWS CLI named profiles for this project.

.DESCRIPTION
    Shows which AWS profiles exist, which one is active in this PowerShell
    window, and who each credential actually is (aws sts get-caller-identity).
    Can switch the active profile for this window (-Use) or permanently
    (-Use -Persist), and undo either (-Clear / -Clear -Persist).

    Environment variables set here live in the current PowerShell process,
    so -Use takes effect immediately in this window and disappears when the
    window closes. -Persist writes the user-level AWS_PROFILE variable,
    which affects NEW windows only (and may conflict with other AWS work
    done under a different account - prefer the session-only switch).

    The safest habit is still passing "--profile petlife" per command;
    this script exists so you do not have to.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\aws-profile.ps1                     # status: profiles, active one, identity
    .\scripts\aws-profile.ps1 -All                # also verify identity of every profile
    .\scripts\aws-profile.ps1 -Pick               # whoami for every profile, pick one by number
    .\scripts\aws-profile.ps1 -Pick -Persist      # same, and make it the default for new windows
    .\scripts\aws-profile.ps1 -Use petlife        # switch this window to 'petlife' (verified first)
    .\scripts\aws-profile.ps1 -Use petlife -Persist   # also make it the default for new windows
    .\scripts\aws-profile.ps1 -Clear              # back to the 'default' profile in this window
    .\scripts\aws-profile.ps1 -Clear -Persist     # also remove the persisted value
#>

[CmdletBinding(DefaultParameterSetName = 'Show')]
param(
    # Verify the identity of every profile, not just the active one.
    [Parameter(ParameterSetName = 'Show')]
    [switch]$All,

    # Profile name to activate in this PowerShell window (verified via STS first).
    [Parameter(ParameterSetName = 'Use', Mandatory = $true, Position = 0)]
    [string]$Use,

    # List every profile with its identity (whoami), numbered, and switch to the chosen one.
    [Parameter(ParameterSetName = 'Pick', Mandatory = $true)]
    [switch]$Pick,

    # Stop overriding AWS_PROFILE in this window.
    [Parameter(ParameterSetName = 'Clear', Mandatory = $true)]
    [switch]$Clear,

    # With -Use: also write the user-level AWS_PROFILE (new windows).
    # With -Clear: also remove the user-level AWS_PROFILE.
    [Parameter(ParameterSetName = 'Use')]
    [Parameter(ParameterSetName = 'Pick')]
    [Parameter(ParameterSetName = 'Clear')]
    [switch]$Persist
)

$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''

# The project account, taken from the ACM certificate ARN (us-east-1).
# Used only to warn when a profile points at a different account.
$ProjectAccountId = '532393804562'
$ProjectProfile = 'petlife'

# --------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------

function Write-Head { param([string]$Text) Write-Host "== $Text ==" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "  [ OK ] $Text" -ForegroundColor Green }
function Write-Warn2 { param([string]$Text) Write-Host "  [WARN] $Text" -ForegroundColor Yellow }
function Fail { param([string]$Text) Write-Host "  [FAIL] $Text" -ForegroundColor Red; exit 1 }

# Runs the aws CLI capturing stdout+stderr without tripping Windows
# PowerShell 5.1 (stderr redirection under ErrorActionPreference=Stop
# raises NativeCommandError, so lower it around the call).
function Invoke-Aws {
    param([string[]]$CliArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & aws @CliArgs 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    $text = ($out | ForEach-Object { "$_" }) -join "`n"
    return @{ ExitCode = $code; Text = $text }
}

function Test-AwsCli {
    $cmd = Get-Command aws -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Fail 'AWS CLI not found. Install: winget install Amazon.AWSCLI  (then open a NEW PowerShell window)'
    }
    return (Invoke-Aws @('--version')).Text
}

function Get-AwsProfiles {
    $r = Invoke-Aws @('configure', 'list-profiles')
    if ($r.ExitCode -eq 0 -and $r.Text.Trim().Length -gt 0) {
        return @($r.Text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    # Fallback (AWS CLI v1 has no list-profiles): parse the shared config files.
    $names = @()
    $cred = Join-Path $HOME '.aws\credentials'
    $conf = Join-Path $HOME '.aws\config'
    if (Test-Path $cred) {
        $names += Select-String -Path $cred -Pattern '^\s*\[\s*([^\]]+?)\s*\]' -AllMatches |
            ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value }
    }
    if (Test-Path $conf) {
        $names += Select-String -Path $conf -Pattern '^\s*\[\s*profile\s+([^\]]+?)\s*\]' -AllMatches |
            ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value }
    }
    return @($names | Sort-Object -Unique)
}

function Get-ProfileRegion {
    param([string]$ProfileName)
    $cliArgs = @('configure', 'get', 'region')
    if ($ProfileName -and $ProfileName -ne 'default') { $cliArgs += @('--profile', $ProfileName) }
    $r = Invoke-Aws $cliArgs
    if ($r.ExitCode -eq 0 -and $r.Text.Trim()) { return $r.Text.Trim() }
    if ($env:AWS_REGION) { return "$($env:AWS_REGION) (from AWS_REGION)" }
    if ($env:AWS_DEFAULT_REGION) { return "$($env:AWS_DEFAULT_REGION) (from AWS_DEFAULT_REGION)" }
    return '(not set)'
}

# Runs sts get-caller-identity for a profile.
# Returns @{ Ok = $true; Id = <identity> } or @{ Ok = $false; Error = <first line> }.
function Get-Identity {
    param([string]$ProfileName)
    $cliArgs = @('sts', 'get-caller-identity', '--output', 'json')
    if ($ProfileName -and $ProfileName -ne 'default') { $cliArgs += @('--profile', $ProfileName) }
    $r = Invoke-Aws $cliArgs
    if ($r.ExitCode -ne 0) {
        $firstLine = ($r.Text -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
        return @{ Ok = $false; Error = "$firstLine" }
    }
    try { return @{ Ok = $true; Id = ($r.Text | ConvertFrom-Json) } }
    catch { return @{ Ok = $false; Error = "unexpected STS output: $($r.Text)" } }
}

# Prints who a profile is. Returns $true when the credentials work.
function Show-Identity {
    param([string]$ProfileName)
    $r = Get-Identity $ProfileName
    if (-not $r.Ok) { Write-Warn2 "identity check failed: $($r.Error)"; return $false }
    $id = $r.Id
    Write-Host "    account : $($id.Account)"
    Write-Host "    arn     : $($id.Arn)"
    Write-Host "    region  : $(Get-ProfileRegion $ProfileName)"
    if ($id.Account -ne $ProjectAccountId) {
        Write-Warn2 "account differs from the project account ($ProjectAccountId, from the ACM cert ARN)."
        Write-Warn2 'This looks like a DIFFERENT AWS user/account - do not deploy this project with it.'
    } else {
        Write-Ok "matches the project account ($ProjectAccountId)"
    }
    return $true
}

# Activates a profile in this window (and optionally for new windows).
function Set-ActiveProfile {
    param([string]$ProfileName, [bool]$PersistIt)
    $env:AWS_PROFILE = $ProfileName
    Write-Ok "This window now uses AWS_PROFILE=$ProfileName (until the window closes)."
    if ($PersistIt) {
        setx AWS_PROFILE $ProfileName | Out-Null
        Write-Ok 'Persisted for NEW windows too (setx, user level).'
        Write-Warn2 'If you also do other AWS work under a different account, undo with: .\scripts\aws-profile.ps1 -Clear -Persist'
    }
    Write-Host ''
    Write-Host "  Check anytime:  aws sts get-caller-identity"
}

function Get-EffectiveProfile {
    if ($env:AWS_PROFILE) { return $env:AWS_PROFILE }
    return 'default'
}

# --------------------------------------------------------------------
# -Clear : stop overriding
# --------------------------------------------------------------------

if ($PSCmdlet.ParameterSetName -eq 'Clear') {
    Test-AwsCli | Out-Null
    if ($env:AWS_PROFILE) {
        Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue
        Write-Ok 'AWS_PROFILE removed for this window.'
    } else {
        Write-Ok 'AWS_PROFILE was not set in this window.'
    }
    if ($Persist) {
        [Environment]::SetEnvironmentVariable('AWS_PROFILE', $null, 'User')
        Write-Ok 'User-level AWS_PROFILE removed (new windows will not have it).'
    }
    Write-Host "  Effective profile is now: $(Get-EffectiveProfile)"
    exit 0
}

# --------------------------------------------------------------------
# -Use <name> : switch after verifying
# --------------------------------------------------------------------

if ($PSCmdlet.ParameterSetName -eq 'Use') {
    Test-AwsCli | Out-Null
    $profiles = Get-AwsProfiles
    $exact = @($profiles | Where-Object { $_ -ceq $Use })
    if ($exact.Count -eq 0) {
        $ci = @($profiles | Where-Object { $_ -eq $Use })
        if ($ci.Count -gt 0) {
            Fail "Profile '$Use' not found, but '$($ci[0])' exists (profile names are case-sensitive)."
        }
        Write-Host "  Known profiles: $($profiles -join ', ')"
        Fail "Profile '$Use' not found. Register it first:  aws configure --profile $Use"
    }

    Write-Head "Verifying profile '$Use'"
    if (-not (Show-Identity $Use)) {
        Fail "Credentials for '$Use' do not work - not switching. Re-run: aws configure --profile $Use"
    }

    Set-ActiveProfile $Use $Persist.IsPresent
    exit 0
}

# --------------------------------------------------------------------
# -Pick : whoami for every profile, choose by number
# --------------------------------------------------------------------

if ($PSCmdlet.ParameterSetName -eq 'Pick') {
    Test-AwsCli | Out-Null
    $profiles = @(Get-AwsProfiles)
    if ($profiles.Count -eq 0) {
        Fail "No profiles found. Register the project profile:  aws configure --profile $ProjectProfile"
    }
    $active = Get-EffectiveProfile

    Write-Head 'Who am I - every profile'
    $ids = @{}
    for ($i = 0; $i -lt $profiles.Count; $i++) {
        $p = $profiles[$i]
        $n = $i + 1
        $mark = if ($p -eq $active) { '*' } else { ' ' }
        $r = Get-Identity $p
        $ids[$p] = $r
        if (-not $r.Ok) {
            Write-Host ("  {0} [{1}] {2,-16} (credentials fail: {3})" -f $mark, $n, $p, $r.Error) -ForegroundColor DarkGray
            continue
        }
        $tag = if ($r.Id.Account -eq $ProjectAccountId) { 'PROJECT' } else { 'other account' }
        $color = if ($p -eq $active) { 'Green' } elseif ($r.Id.Account -eq $ProjectAccountId) { 'White' } else { 'Yellow' }
        Write-Host ("  {0} [{1}] {2,-16} {3}  {4}  ({5})" -f $mark, $n, $p, $r.Id.Account, $r.Id.Arn, $tag) -ForegroundColor $color
    }
    Write-Host "  (* = active in this window: $active)"
    Write-Host ''

    $answer = Read-Host "Profile number to use (Enter = keep '$active')"
    $answer = "$answer".Trim()
    if (-not $answer) { Write-Ok "Kept '$active'."; exit 0 }
    $num = 0
    if (-not [int]::TryParse($answer, [ref]$num) -or $num -lt 1 -or $num -gt $profiles.Count) {
        Fail "Enter a number between 1 and $($profiles.Count)."
    }
    $chosen = $profiles[$num - 1]
    if (-not $ids[$chosen].Ok) {
        Fail "Credentials for '$chosen' do not work - not switching. Re-run: aws configure --profile $chosen"
    }
    if ($ids[$chosen].Id.Account -ne $ProjectAccountId) {
        Write-Warn2 "'$chosen' is NOT the project account ($ProjectAccountId) - do not deploy this project with it."
    }
    Set-ActiveProfile $chosen $Persist.IsPresent
    exit 0
}

# --------------------------------------------------------------------
# default : show status
# --------------------------------------------------------------------

Write-Head 'AWS CLI'
$ver = Test-AwsCli
Write-Host "  $ver"
if ($ver -notmatch 'aws-cli/2') {
    Write-Warn2 'AWS CLI v2 is expected. Install: winget install Amazon.AWSCLI'
}

Write-Head 'Profiles'
$profiles = Get-AwsProfiles
if ($profiles.Count -eq 0) {
    Write-Warn2 "No profiles found. Register the project profile:  aws configure --profile $ProjectProfile"
    exit 0
}
$active = Get-EffectiveProfile
foreach ($p in $profiles) {
    if ($p -eq $active) { Write-Host "  * $p   (ACTIVE in this window)" -ForegroundColor Green }
    else { Write-Host "    $p" }
}
if (-not ($profiles -contains $ProjectProfile)) {
    Write-Warn2 "Project profile '$ProjectProfile' is not registered yet:  aws configure --profile $ProjectProfile"
}
if ($env:AWS_PROFILE) {
    Write-Host "  AWS_PROFILE=$($env:AWS_PROFILE) (session override)"
} else {
    Write-Host "  AWS_PROFILE not set - commands without --profile use 'default'."
}
$persisted = [Environment]::GetEnvironmentVariable('AWS_PROFILE', 'User')
if ($persisted) { Write-Host "  User-level (new windows): AWS_PROFILE=$persisted" }

if ($All) {
    foreach ($p in $profiles) {
        Write-Head "Identity of '$p'"
        Show-Identity $p | Out-Null
    }
} else {
    Write-Head "Identity of active profile '$active'"
    Show-Identity $active | Out-Null
    Write-Host ''
    Write-Host '  (use -All to verify every profile)'
}

Write-Host ''
Write-Host 'Pick:    .\scripts\aws-profile.ps1 -Pick            (whoami for all, choose by number)'
Write-Host 'Switch:  .\scripts\aws-profile.ps1 -Use petlife     Undo:  .\scripts\aws-profile.ps1 -Clear'
