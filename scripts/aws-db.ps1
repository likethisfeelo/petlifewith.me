<#
.SYNOPSIS
    One-time AWS database setup: RDS PostgreSQL 16 + per-stage databases,
    deploy env files, migrations and seeds. No interactive prompts.

.DESCRIPTION
    Idempotent - safe to re-run. It performs:
      1. Verifies the AWS profile points at the project account.
      2. Security group 'petlife-db-public' in the default VPC (port 5432 open).
         NOTE: the app runs on Lambda WITHOUT a VPC, so the DB endpoint must be
         publicly reachable. Protection = strong password + TLS + deletion
         protection. Moving to VPC + RDS Proxy later is documented in docs.
      3. RDS instance 'petlife-db' (db.t4g.micro, PostgreSQL 16, 20GB gp3,
         encrypted, 7-day backups, deletion protection, ~USD 15/month).
         Waits until available (first creation takes 5-10 minutes).
      4. Databases app_prod and app_dev inside the one instance.
      5. Writes .env.deploy.prod / .env.deploy.dev (gitignored) with
         DATABASE_URL and freshly generated ADMIN_TOKEN / AUTH_SECRET.
         Existing files are kept untouched.
      6. Runs migrations + base/content seeds for both stages.

    If the instance exists but .env.deploy.prod was lost, the master password
    is RESET (modify-db-instance) so the script can proceed without prompts.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\aws-db.ps1
    .\scripts\aws-db.ps1 -DevFixtures      # also load sample data into app_dev
    .\scripts\aws-db.ps1 -SkipSeed         # provision + migrate only
#>

[CmdletBinding()]
param(
    [string]$AwsProfile = 'petlife',
    [string]$Region = 'ap-northeast-2',
    [string]$InstanceId = 'petlife-db',
    [string]$InstanceClass = 'db.t4g.micro',
    [int]$StorageGb = 20,
    # Load sample spots/makers/items into app_dev so dev pages render with data.
    [switch]$DevFixtures,
    # Provision and migrate only - skip base/content seeds.
    [switch]$SkipSeed
)

$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''
$ProjectAccountId = '532393804562'
$MasterUser = 'app_admin'
$SgName = 'petlife-db-public'

if (-not (Test-Path 'pnpm-workspace.yaml')) {
    throw 'Run this from the repository root (pnpm-workspace.yaml not found).'
}

# --------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------

function Write-Step { param([string]$Message) Write-Host "  [ OK ] $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "  [ .. ] $Message" }
function Write-Warn2 { param([string]$Message) Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Fail { param([string]$Message) Write-Host "  [FAIL] $Message" -ForegroundColor Red; exit 1 }

# aws CLI wrapper safe under PS 5.1 (stderr redirect + EAP Stop issue).
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

function Invoke-AwsJson {
    param([string[]]$CliArgs, [string]$Label)
    $r = Invoke-Aws ($CliArgs + @('--output', 'json'))
    if ($r.ExitCode -ne 0) { Fail "$Label failed: $($r.Text)" }
    if (-not $r.Text.Trim()) { return $null }
    return $r.Text | ConvertFrom-Json
}

function Invoke-Pnpm {
    param([string]$Label, [string[]]$CliArgs)
    & pnpm @CliArgs
    if ($LASTEXITCODE -ne 0) { Fail "$Label failed (exit $LASTEXITCODE)." }
}

function New-RandomHex {
    param([int]$Bytes)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $Bytes
    $rng.GetBytes($buf)
    $rng.Dispose()
    return ([System.BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

function New-DbPassword {
    # RDS-safe and URL-safe: alphanumeric only (no encoding needed in DATABASE_URL).
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] 32
    $rng.GetBytes($buf)
    $rng.Dispose()
    $sb = New-Object System.Text.StringBuilder
    foreach ($b in $buf) { [void]$sb.Append($chars[$b % $chars.Length]) }
    return $sb.ToString()
}

function Get-EnvValue {
    param([string]$File, [string]$Key)
    if (-not (Test-Path $File)) { return $null }
    $line = Select-String -Path $File -Pattern "^\s*$Key=(.*)$" | Select-Object -First 1
    if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
    return $null
}

# --------------------------------------------------------------------
# 1. identity guard
# --------------------------------------------------------------------

Write-Host "== Verifying AWS profile '$AwsProfile' ==" -ForegroundColor Cyan
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Fail 'AWS CLI not found. Install: winget install Amazon.AWSCLI  (then open a NEW PowerShell window)'
}
$identity = Invoke-AwsJson @('sts', 'get-caller-identity') 'sts get-caller-identity'
if ($identity.Account -ne $ProjectAccountId) {
    Fail "Profile '$AwsProfile' is account $($identity.Account), expected $ProjectAccountId. Check: .\scripts\aws-profile.ps1"
}
Write-Step "Account $($identity.Account) ($($identity.Arn))"

# --------------------------------------------------------------------
# 2. security group in the default VPC
# --------------------------------------------------------------------

Write-Host '== Security group ==' -ForegroundColor Cyan
$vpcs = Invoke-AwsJson @('ec2', 'describe-vpcs', '--filters', 'Name=is-default,Values=true') 'describe-vpcs'
if (-not $vpcs.Vpcs -or $vpcs.Vpcs.Count -eq 0) {
    Fail 'No default VPC in this region. Create one: aws ec2 create-default-vpc'
}
$vpcId = $vpcs.Vpcs[0].VpcId

$sgs = Invoke-AwsJson @('ec2', 'describe-security-groups', '--filters', "Name=group-name,Values=$SgName", "Name=vpc-id,Values=$vpcId") 'describe-security-groups'
if ($sgs.SecurityGroups -and $sgs.SecurityGroups.Count -gt 0) {
    $sgId = $sgs.SecurityGroups[0].GroupId
    Write-Step "Security group exists: $SgName ($sgId)"
} else {
    $created = Invoke-AwsJson @('ec2', 'create-security-group', '--group-name', $SgName, '--description', 'petlife RDS public access (Lambda has no VPC)', '--vpc-id', $vpcId) 'create-security-group'
    $sgId = $created.GroupId
    Write-Step "Security group created: $SgName ($sgId)"
}
$ingressRules = @(
    @('--protocol', 'tcp', '--port', '5432', '--cidr', '0.0.0.0/0'),
    @('--ip-permissions', 'IpProtocol=tcp,FromPort=5432,ToPort=5432,Ipv6Ranges=[{CidrIpv6=::/0}]')
)
foreach ($rule in $ingressRules) {
    $r = Invoke-Aws (@('ec2', 'authorize-security-group-ingress', '--group-id', $sgId) + $rule)
    if ($r.ExitCode -ne 0 -and $r.Text -notmatch 'InvalidPermission\.Duplicate') {
        Fail "authorize-security-group-ingress failed: $($r.Text)"
    }
}
Write-Step 'Ingress 5432 open (IPv4 + IPv6) - required because Lambda runs without a VPC'

# --------------------------------------------------------------------
# 3. RDS instance
# --------------------------------------------------------------------

Write-Host "== RDS instance '$InstanceId' ==" -ForegroundColor Cyan
$prodEnvFile = '.env.deploy.prod'
$devEnvFile = '.env.deploy.dev'
$masterPassword = $null
$passwordIsNew = $false

$describe = Invoke-Aws @('rds', 'describe-db-instances', '--db-instance-identifier', $InstanceId, '--output', 'json')
if ($describe.ExitCode -ne 0) {
    if ($describe.Text -notmatch 'DBInstanceNotFound') { Fail "describe-db-instances failed: $($describe.Text)" }

    # pick the newest PostgreSQL 16 minor version
    $versions = Invoke-AwsJson @('rds', 'describe-db-engine-versions', '--engine', 'postgres', '--query', 'DBEngineVersions[].EngineVersion') 'describe-db-engine-versions'
    $v16 = @($versions | Where-Object { "$_" -like '16.*' })
    if ($v16.Count -eq 0) { Fail 'No PostgreSQL 16.x engine version available in this region.' }
    try { $engineVersion = ($v16 | Sort-Object { [System.Version]"$_" } | Select-Object -Last 1) }
    catch { $engineVersion = ($v16 | Sort-Object | Select-Object -Last 1) }

    $masterPassword = New-DbPassword
    $passwordIsNew = $true
    Write-Info "Creating $InstanceClass PostgreSQL $engineVersion (about USD 15/month) ..."
    $createArgs = @(
        'rds', 'create-db-instance',
        '--db-instance-identifier', $InstanceId,
        '--db-instance-class', $InstanceClass,
        '--engine', 'postgres',
        '--engine-version', "$engineVersion",
        '--master-username', $MasterUser,
        '--master-user-password', $masterPassword,
        '--allocated-storage', "$StorageGb",
        '--storage-type', 'gp3',
        '--storage-encrypted',
        '--vpc-security-group-ids', $sgId,
        '--db-name', 'app_prod',
        '--backup-retention-period', '7',
        '--publicly-accessible',
        '--deletion-protection',
        '--auto-minor-version-upgrade',
        '--no-multi-az',
        '--copy-tags-to-snapshot',
        '--tags', 'Key=project,Value=petlife'
    )
    Invoke-AwsJson $createArgs 'create-db-instance' | Out-Null
    Write-Step 'Instance creation started'
} else {
    Write-Step 'Instance already exists - reusing it'
    $existingUrl = Get-EnvValue $prodEnvFile 'DATABASE_URL'
    if ($existingUrl -and $existingUrl -match '://[^:]+:([^@]+)@') {
        $masterPassword = $Matches[1]
        Write-Step "Master password recovered from $prodEnvFile"
    } else {
        $masterPassword = New-DbPassword
        $passwordIsNew = $true
        Write-Warn2 "$prodEnvFile has no DATABASE_URL - RESETTING the master password so setup can continue."
        Invoke-AwsJson @('rds', 'modify-db-instance', '--db-instance-identifier', $InstanceId, '--master-user-password', $masterPassword, '--apply-immediately') 'modify-db-instance (password reset)' | Out-Null
    }
}

Write-Info 'Waiting until the instance is available (first creation: 5-10 minutes) ...'
$wait = Invoke-Aws @('rds', 'wait', 'db-instance-available', '--db-instance-identifier', $InstanceId)
if ($wait.ExitCode -ne 0) { Fail "Waiter failed or timed out - re-run this script. Detail: $($wait.Text)" }
$inst = (Invoke-AwsJson @('rds', 'describe-db-instances', '--db-instance-identifier', $InstanceId) 'describe-db-instances').DBInstances[0]
$dbHost = $inst.Endpoint.Address
$dbPort = $inst.Endpoint.Port
Write-Step "Available at ${dbHost}:${dbPort} (engine $($inst.EngineVersion))"
if (-not $inst.DeletionProtection) {
    Write-Warn2 "Deletion protection is OFF - turn it on: aws rds modify-db-instance --db-instance-identifier $InstanceId --deletion-protection"
}

# sslmode=no-verify: pg encrypts the connection but skips CA verification
# (RDS CA is not in the Node trust store; upgrade path is documented in docs).
$prodUrl = "postgresql://${MasterUser}:${masterPassword}@${dbHost}:${dbPort}/app_prod?sslmode=no-verify"
$devUrl = "postgresql://${MasterUser}:${masterPassword}@${dbHost}:${dbPort}/app_dev?sslmode=no-verify"

# --------------------------------------------------------------------
# 4. per-stage databases (app_prod exists via --db-name; ensure app_dev)
# --------------------------------------------------------------------

Write-Host '== Databases ==' -ForegroundColor Cyan
if (-not (Test-Path 'node_modules')) {
    Write-Info 'node_modules missing - running pnpm install ...'
    Invoke-Pnpm 'pnpm install' @('install', '--frozen-lockfile')
}
$env:ADMIN_DATABASE_URL = $prodUrl
try {
    Invoke-Pnpm 'ensure app_dev database' @('--filter', '@app/data', 'exec', 'node', 'src/db/ensure-database.mjs', 'app_dev')
} finally {
    Remove-Item Env:ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
}
Write-Step 'app_prod / app_dev ready'

# --------------------------------------------------------------------
# 5. deploy env files (kept if they already exist)
# --------------------------------------------------------------------

Write-Host '== Deploy env files ==' -ForegroundColor Cyan
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm')
foreach ($pair in @(@($prodEnvFile, $prodUrl, 'prod'), @($devEnvFile, $devUrl, 'dev'))) {
    $file = $pair[0]; $url = $pair[1]; $stageName = $pair[2]
    if (Test-Path $file) {
        if ($passwordIsNew) {
            # password changed - rewrite only the DATABASE_URL line, keep the rest
            $content = @(Get-Content $file)
            $content = @($content | ForEach-Object { if ($_ -match '^\s*DATABASE_URL=') { "DATABASE_URL=$url" } else { $_ } })
            if (-not ($content -match '^\s*DATABASE_URL=')) { $content += "DATABASE_URL=$url" }
            Set-Content -Path $file -Value $content -Encoding Ascii
            Write-Step "$file kept (DATABASE_URL updated for the new password)"
        } else {
            Write-Step "$file kept as-is"
        }
        continue
    }
    $lines = @(
        "# Deploy env for stage '$stageName' - DO NOT COMMIT (gitignored via .env.*)",
        "# Generated by scripts/aws-db.ps1 on $stamp",
        "DATABASE_URL=$url",
        "ADMIN_TOKEN=$(New-RandomHex 24)",
        "AUTH_SECRET=$(New-RandomHex 32)",
        '# Optional overrides picked up by sst.config.ts:',
        '#NEXT_PUBLIC_CONTACT_EMAIL=',
        '#NEXT_PUBLIC_DEFAULT_OG_IMAGE_URL=',
        '#DB_POOL_MAX=2'
    )
    Set-Content -Path $file -Value $lines -Encoding Ascii
    Write-Step "$file written (admin token + auth secret generated, password hidden)"
}

# --------------------------------------------------------------------
# 6. migrations + seeds
# --------------------------------------------------------------------

Write-Host '== Migrations and seeds ==' -ForegroundColor Cyan
$prevDbUrl = $env:DATABASE_URL
foreach ($pair in @(@('prod', $prodUrl), @('dev', $devUrl))) {
    $stageName = $pair[0]; $url = $pair[1]
    Write-Info "stage $stageName : migrate"
    $env:DATABASE_URL = $url
    try {
        Invoke-Pnpm "migrate ($stageName)" @('--filter', '@app/data', 'db:migrate')
        if (-not $SkipSeed) {
            Invoke-Pnpm "seed:base ($stageName)" @('--filter', '@app/data', 'seed:base')
            Invoke-Pnpm "seed:content ($stageName)" @('--filter', '@app/data', 'seed:content')
            if ($DevFixtures -and $stageName -eq 'dev') {
                Invoke-Pnpm 'seed:dev (dev fixtures)' @('--filter', '@app/data', 'seed:dev')
            }
        }
    } finally {
        if ($null -ne $prevDbUrl) { $env:DATABASE_URL = $prevDbUrl } else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
    }
    Write-Step "stage $stageName done"
}

Write-Host ''
Write-Host '== Done ==' -ForegroundColor Cyan
Write-Host "  Endpoint : ${dbHost}:${dbPort} (public, TLS, deletion protection on)"
Write-Host '  Databases: app_prod / app_dev on one db.t4g.micro instance'
Write-Host "  Env files: $prodEnvFile / $devEnvFile (gitignored - back them up safely)"
Write-Host '  Next     : .\scripts\deploy.ps1 -Stage dev'
