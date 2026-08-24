<#
.SYNOPSIS
    One-time Git setup for the roof-good repository.

.DESCRIPTION
    Configures line endings for Windows-dev / Linux-deploy, sets commit identity,
    and installs a pre-commit hook that blocks secrets.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\git-init.ps1 -UserName "Wonjo Cho" -UserEmail "dark@k-rida.com"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$UserName,
    [Parameter(Mandatory)][string]$UserEmail
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path .git)) {
    throw "Run this from the repository root (no .git folder found)."
}

Write-Host ""
Write-Host "  Git setup" -ForegroundColor Cyan
Write-Host "  ----------------------------------------------------------" -ForegroundColor DarkGray

# ---- 1. identity, repo-local ---------------------------------------
git config user.name  $UserName
git config user.email $UserEmail
Write-Host "  [ OK ] user.name / user.email" -ForegroundColor Green

# ---- 2. line endings -----------------------------------------------
# Turn autocrlf off and manage explicitly via .gitattributes.
# Without this, shell scripts uploaded to Lambda fail with 'bad interpreter'.
git config core.autocrlf false
git config core.eol lf
Write-Host "  [ OK ] core.autocrlf=false / core.eol=lf" -ForegroundColor Green

$attrs = @'
# Default: store text files with LF in the repo
* text=auto eol=lf

# Scripts that run on Linux (Lambda, Docker) must be LF
*.sh    text eol=lf
*.bash  text eol=lf

# Windows-only scripts keep CRLF
*.ps1   text eol=crlf
*.psm1  text eol=crlf
*.bat   text eol=crlf
*.cmd   text eol=crlf

# Binary: never convert
*.png   binary
*.jpg   binary
*.jpeg  binary
*.webp  binary
*.gif   binary
*.ico   binary
*.pdf   binary
*.woff  binary
*.woff2 binary
*.zip   binary

# Reduce diff noise
pnpm-lock.yaml    -diff linguist-generated
package-lock.json -diff linguist-generated
'@

[IO.File]::WriteAllText(
    (Join-Path (Get-Location) '.gitattributes'),
    ($attrs -replace "`r`n", "`n"),
    (New-Object Text.UTF8Encoding $false)
)
Write-Host "  [ OK ] .gitattributes written" -ForegroundColor Green

# ---- 3. convenience -------------------------------------------------
git config pull.rebase true
git config push.autoSetupRemote true
git config fetch.prune true
git config diff.algorithm histogram
Write-Host "  [ OK ] pull.rebase / push.autoSetupRemote / fetch.prune" -ForegroundColor Green

# ---- 4. pre-commit hook: block secrets -------------------------------
$hookDir = '.git/hooks'
if (-not (Test-Path $hookDir)) { New-Item -ItemType Directory -Path $hookDir -Force | Out-Null }

$hook = @'
#!/bin/sh
# roof-good pre-commit : block secrets
# Bypass with: git commit --no-verify  (not recommended)

fail=0
files=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$files" ] && exit 0

for f in $files; do
  case "$f" in
    *.example) continue ;;
  esac
  case "$f" in
    .env|.env.*|*/.env|*/.env.*)
      echo "BLOCKED: $f  (env files must not be committed)"
      fail=1 ;;
    *.pem|*.key|*.p12|*.pfx|credentials|*/credentials)
      echo "BLOCKED: $f  (key or credential file)"
      fail=1 ;;
    cdk.context.json)
      echo "WARN: $f may contain account details, please review." ;;
  esac
done

patterns='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|aws_secret_access_key[[:space:]]*=|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_[0-9a-zA-Z]{20,}|xox[baprs]-[0-9a-zA-Z-]{10,}'

hits=$(git diff --cached -U0 | grep -E "^\+" | grep -E "$patterns")
if [ -n "$hits" ]; then
  echo "BLOCKED: possible secret detected in staged changes."
  echo "$hits" | head -5
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Commit aborted. Use AWS Secrets Manager for secrets."
  exit 1
fi

exit 0
'@

# Hook must be LF, otherwise Git Bash cannot execute it
[IO.File]::WriteAllText(
    (Join-Path (Get-Location) "$hookDir/pre-commit"),
    ($hook -replace "`r`n", "`n"),
    (New-Object Text.UTF8Encoding $false)
)
Write-Host "  [ OK ] pre-commit hook installed" -ForegroundColor Green

# ---- 5. renormalize existing files -----------------------------------
$tracked = git ls-files 2>$null
if ($tracked) {
    Write-Host ""
    Write-Host "  Renormalizing line endings of tracked files..." -ForegroundColor DarkGray
    git add --renormalize . 2>$null
    $changed = @(git diff --cached --name-only)
    if ($changed.Count -gt 0) {
        Write-Host "  [INFO] $($changed.Count) file(s) changed. Commit them:" -ForegroundColor DarkGray
        Write-Host '         git commit -m "chore: normalize line endings"' -ForegroundColor White
    } else {
        Write-Host "  [ OK ] nothing to renormalize" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "  Done." -ForegroundColor Cyan
Write-Host "  Test the hook:" -ForegroundColor DarkGray
Write-Host '    echo AKIA + 16?? ??? ??? > t.txt; git add t.txt; git commit -m test' -ForegroundColor DarkGray
Write-Host ""
