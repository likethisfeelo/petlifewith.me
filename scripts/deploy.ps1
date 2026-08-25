<#
.SYNOPSIS
    Deploy the site to AWS (OpenNext via SST). No interactive prompts.

.DESCRIPTION
    Stages:
      dev   -> https://dev.petlifewith.me  (preview: robots blocked, all noindex)
      prod  -> https://petlifewith.me (+ www/admin/service/product aliases)

    Steps (each can be skipped with a switch):
      1. AWS profile identity guard (must be the project account).
      2. Deploy env file check (.env.deploy.<stage> - created by aws-db.ps1).
      3. Preflight: ACM certificate (us-east-1, ISSUED, covers apex+wildcard)
         and Route 53 hosted zone.
      4. pnpm install (frozen lockfile), typecheck + tests.
      5. DB migrations against the stage database.
      6. sst deploy --stage <stage>  (first deploy takes 10-15 minutes -
         CloudFront distribution creation is slow; later deploys are faster).

    DNS records for the domain and all aliases are created automatically in
    Route 53 by the deploy. Nothing here prompts for confirmation.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\deploy.ps1 -Stage dev
    .\scripts\deploy.ps1 -Stage prod
    .\scripts\deploy.ps1 -Stage dev -SkipTests            # iterate faster
    .\scripts\deploy.ps1 -Stage dev -SkipPreflight -SkipMigrate
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'prod')]
    [string]$Stage,

    [string]$AwsProfile = 'petlife',
    [string]$Region = 'ap-northeast-2',

    # Skip typecheck + unit tests (use only while iterating on dev).
    [switch]$SkipTests,
    # Skip certificate / hosted zone checks.
    [switch]$SkipPreflight,
    # Skip DB migrations (when you know the schema did not change).
    [switch]$SkipMigrate
)

$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''
$env:SST_TELEMETRY_DISABLE = '1'
$env:CI = ''  # keep pnpm/vitest in normal non-watch mode without CI strictness

$ProjectAccountId = '532393804562'
$ApexDomain = 'petlifewith.me'
# Same certificate as sst.config.ts (override both via $env:CERT_ARN).
$DefaultCertArn = 'arn:aws:acm:us-east-1:532393804562:certificate/90e71d55-1296-4ba7-b58f-ca4c8bbe093b'

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
    return $r.Text | ConvertFrom-Json
}

function Invoke-Pnpm {
    param([string]$Label, [string[]]$CliArgs)
    & pnpm @CliArgs
    if ($LASTEXITCODE -ne 0) { Fail "$Label failed (exit $LASTEXITCODE)." }
    Write-Step $Label
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

Write-Host "== Deploying stage '$Stage' as profile '$AwsProfile' ==" -ForegroundColor Cyan
foreach ($tool in @('aws', 'node', 'pnpm')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "'$tool' not found on PATH." }
}
$identity = Invoke-AwsJson @('sts', 'get-caller-identity') 'sts get-caller-identity'
if ($identity.Account -ne $ProjectAccountId) {
    Fail "Profile '$AwsProfile' is account $($identity.Account), expected $ProjectAccountId. Check: .\scripts\aws-profile.ps1"
}
Write-Step "Account $($identity.Account)"

# --------------------------------------------------------------------
# 2. deploy env file
# --------------------------------------------------------------------

$envFile = ".env.deploy.$Stage"
if (-not (Test-Path $envFile)) {
    Fail "$envFile not found. Run .\scripts\aws-db.ps1 first (creates DB + env files)."
}
foreach ($key in @('DATABASE_URL', 'ADMIN_TOKEN', 'AUTH_SECRET')) {
    if (-not (Get-EnvValue $envFile $key)) { Fail "$envFile is missing $key. Re-run .\scripts\aws-db.ps1" }
}
Write-Step "$envFile present"

# --------------------------------------------------------------------
# 3. preflight: certificate + hosted zone
# --------------------------------------------------------------------

if (-not $SkipPreflight) {
    Write-Host '== Preflight ==' -ForegroundColor Cyan
    $certArn = $DefaultCertArn
    if ($env:CERT_ARN) { $certArn = $env:CERT_ARN }
    $cert = (Invoke-AwsJson @('acm', 'describe-certificate', '--certificate-arn', $certArn, '--region', 'us-east-1') 'acm describe-certificate').Certificate
    if ($cert.Status -ne 'ISSUED') {
        Fail "Certificate status is $($cert.Status), expected ISSUED. Validate it in the ACM console (us-east-1)."
    }
    $sans = @($cert.SubjectAlternativeNames)
    $coversApex = $sans -contains $ApexDomain
    $coversWildcard = $sans -contains "*.$ApexDomain"
    if (-not ($coversApex -and $coversWildcard)) {
        Fail "Certificate must cover both '$ApexDomain' and '*.$ApexDomain'. It covers: $($sans -join ', '). Re-issue in us-east-1 with both names."
    }
    Write-Step "Certificate ISSUED and covers $ApexDomain + *.$ApexDomain (us-east-1)"

    $zones = Invoke-AwsJson @('route53', 'list-hosted-zones-by-name', '--dns-name', "$ApexDomain.") 'route53 list-hosted-zones-by-name'
    $zone = @($zones.HostedZones | Where-Object { $_.Name -eq "$ApexDomain." }) | Select-Object -First 1
    if (-not $zone) { Fail "No Route 53 hosted zone for $ApexDomain in this account." }
    Write-Step "Hosted zone found: $($zone.Id)"
}

# --------------------------------------------------------------------
# 4. install + checks
# --------------------------------------------------------------------

Write-Host '== Build checks ==' -ForegroundColor Cyan
Invoke-Pnpm 'pnpm install' @('install', '--frozen-lockfile')
if (-not $SkipTests) {
    Invoke-Pnpm 'typecheck' @('-r', 'typecheck')
    Invoke-Pnpm 'tests' @('-r', 'test')
} else {
    Write-Warn2 'Tests skipped (-SkipTests)'
}

# --------------------------------------------------------------------
# 5. migrations
# --------------------------------------------------------------------

if (-not $SkipMigrate) {
    Write-Host '== DB migration ==' -ForegroundColor Cyan
    $stageDbUrl = Get-EnvValue $envFile 'DATABASE_URL'
    $prevDbUrl = $env:DATABASE_URL
    $env:DATABASE_URL = $stageDbUrl
    try {
        Invoke-Pnpm "migrate ($Stage)" @('--filter', '@app/data', 'db:migrate')
    } finally {
        if ($null -ne $prevDbUrl) { $env:DATABASE_URL = $prevDbUrl } else { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue }
    }
} else {
    Write-Warn2 'Migrations skipped (-SkipMigrate)'
}

# --------------------------------------------------------------------
# 6. sst deploy
# --------------------------------------------------------------------

Write-Host '== sst deploy ==' -ForegroundColor Cyan
Write-Info 'First deploy takes 10-15 minutes (CloudFront). Later deploys are faster.'
$prevProfile = $env:AWS_PROFILE
$env:AWS_PROFILE = $AwsProfile
try {
    & pnpm exec sst deploy --stage $Stage
    if ($LASTEXITCODE -ne 0) { Fail "sst deploy failed (exit $LASTEXITCODE). Read the error above; re-run when fixed." }
} finally {
    if ($null -ne $prevProfile) { $env:AWS_PROFILE = $prevProfile } else { Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host '== Deployed ==' -ForegroundColor Cyan
if ($Stage -eq 'prod') {
    Write-Host '  https://petlifewith.me  (+ www / admin / service / product subdomains)'
    Write-Host '  DNS records were created in Route 53 - propagation can take a few minutes.'
    Write-Host '  After first prod deploy: register the site in Google Search Console and'
    Write-Host '  Naver Search Advisor, and set NEXT_PUBLIC_DEFAULT_OG_IMAGE_URL (docs).'
} else {
    Write-Host '  https://dev.petlifewith.me  (preview stage: robots blocked, all pages noindex)'
    Write-Host '  Admin: https://dev.petlifewith.me/admin (no admin subdomain on dev)'
}
