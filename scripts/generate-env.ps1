# Generate secure secrets and write them to .env files.
# Usage (from repository root):
#   .\scripts\generate-env.ps1
#   .\scripts\generate-env.ps1 -Force   # reset .env from .env.example before generating

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RootEnv = Join-Path $RootDir ".env"
$RootExample = Join-Path $RootDir ".env.example"
$DockerEnv = Join-Path $RootDir "infra\docker\.env"
$DockerExample = Join-Path $RootDir "infra\docker\.env.example"

function Write-Info([string]$Message) {
    Write-Host $Message
}

function Stop-WithError([string]$Message) {
    Write-Error $Message
    exit 1
}

function New-RandomAlphanumeric([int]$Length = 32) {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $bytes = New-Object byte[] ($Length * 2)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $result = New-Object System.Text.StringBuilder
    for ($i = 0; $result.Length -lt $Length; $i++) {
        [void]$result.Append($chars[$bytes[$i] % $chars.Length])
    }
    return $result.ToString()
}

function New-RandomBase64Secret() {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Ensure-EnvFile {
    param(
        [string]$Target,
        [string]$Example
    )
    if (-not (Test-Path $Example)) {
        Stop-WithError "Missing template: $Example"
    }
    if (-not (Test-Path $Target) -or $Force) {
        Copy-Item -Path $Example -Destination $Target -Force
        Write-Info "Created $Target from template"
    }
}

function Set-EnvValue {
    param(
        [string]$FilePath,
        [string]$Key,
        [string]$Value
    )
    $prefix = "${Key}="
    $lines = Get-Content -Path $FilePath -Encoding utf8
    $replaced = $false
    $newLines = foreach ($line in $lines) {
        if ($line.StartsWith($prefix)) {
            $replaced = $true
            "${Key}=${Value}"
        }
        else {
            $line
        }
    }
    if (-not $replaced) {
        $newLines += "${Key}=${Value}"
    }
    [System.IO.File]::WriteAllLines($FilePath, $newLines)
}

Ensure-EnvFile -Target $RootEnv -Example $RootExample
Ensure-EnvFile -Target $DockerEnv -Example $DockerExample

$PostgresPassword = New-RandomAlphanumeric -Length 32
$MinioRootPassword = New-RandomAlphanumeric -Length 32
$AuthSecret = New-RandomBase64Secret
$CsrfSecret = New-RandomBase64Secret
$RolloutHashSecret = New-RandomBase64Secret
$MinioRootUser = "minioadmin"
$DatabaseUrl = "postgresql://ota:$PostgresPassword@localhost:5432/ota"

Set-EnvValue -FilePath $DockerEnv -Key "POSTGRES_PASSWORD" -Value $PostgresPassword
Set-EnvValue -FilePath $DockerEnv -Key "MINIO_ROOT_PASSWORD" -Value $MinioRootPassword
Set-EnvValue -FilePath $DockerEnv -Key "MINIO_ROOT_USER" -Value $MinioRootUser
Set-EnvValue -FilePath $DockerEnv -Key "AUTH_SECRET" -Value $AuthSecret
Set-EnvValue -FilePath $DockerEnv -Key "CSRF_SECRET" -Value $CsrfSecret
Set-EnvValue -FilePath $DockerEnv -Key "ROLLOUT_HASH_SECRET" -Value $RolloutHashSecret
Set-EnvValue -FilePath $DockerEnv -Key "S3_ACCESS_KEY_ID" -Value $MinioRootUser
Set-EnvValue -FilePath $DockerEnv -Key "S3_SECRET_ACCESS_KEY" -Value $MinioRootPassword

Set-EnvValue -FilePath $RootEnv -Key "DATABASE_URL" -Value $DatabaseUrl
Set-EnvValue -FilePath $RootEnv -Key "AUTH_SECRET" -Value $AuthSecret
Set-EnvValue -FilePath $RootEnv -Key "CSRF_SECRET" -Value $CsrfSecret
Set-EnvValue -FilePath $RootEnv -Key "ROLLOUT_HASH_SECRET" -Value $RolloutHashSecret
Set-EnvValue -FilePath $RootEnv -Key "S3_ACCESS_KEY_ID" -Value $MinioRootUser
Set-EnvValue -FilePath $RootEnv -Key "S3_SECRET_ACCESS_KEY" -Value $MinioRootPassword

Write-Info ""
Write-Info "=== Secrets generated and written ==="
Write-Info "  $RootEnv"
Write-Info "  $DockerEnv"
Write-Info ""
Write-Info "Generated values (save securely - shown once):"
Write-Info "  POSTGRES_PASSWORD     = $PostgresPassword"
Write-Info "  MINIO_ROOT_PASSWORD   = $MinioRootPassword"
Write-Info "  MINIO_ROOT_USER       = $MinioRootUser"
Write-Info "  AUTH_SECRET           = $AuthSecret"
Write-Info "  CSRF_SECRET           = $CsrfSecret"
Write-Info "  ROLLOUT_HASH_SECRET   = $RolloutHashSecret"
Write-Info "  DATABASE_URL          = postgresql://ota:***@localhost:5432/ota"
Write-Info ""
Write-Info "Next steps:"
Write-Info "  cd infra\docker; docker compose up -d postgres redis minio minio-init"
Write-Info "  cd ..\..; pnpm db:push; pnpm db:seed"
