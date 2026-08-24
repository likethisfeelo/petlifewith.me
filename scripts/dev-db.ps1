<#
.SYNOPSIS
    Start or stop the local dev database (and optional MinIO).

.DESCRIPTION
    Wraps docker compose for daily use.

    NOTE: ASCII-only on purpose. Korean text in .ps1 breaks under Windows
    PowerShell 5.1 when the BOM is lost. Do not add non-ASCII characters.

.EXAMPLE
    .\scripts\dev-db.ps1              # start postgres
    .\scripts\dev-db.ps1 -WithMinio   # start postgres + minio
    .\scripts\dev-db.ps1 -Down        # stop everything
#>

[CmdletBinding()]
param(
    [switch]$WithMinio,
    [switch]$Down
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'docker-compose.yml')) {
    throw 'Run this from the repository root.'
}

if ($Down) {
    docker compose down
    Write-Host '  [ OK ] containers stopped' -ForegroundColor Green
    exit 0
}

if ($WithMinio) {
    docker compose up -d
} else {
    docker compose up -d db
}

docker compose ps
Write-Host '  [ OK ] dev database is up (localhost:5432, db=app_dev user=app)' -ForegroundColor Green
