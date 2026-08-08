# Build from repo root context (required — Dockerfiles COPY packages/, apps/, scripts/).
# Usage (from this folder):
#   powershell -File build.ps1
#   powershell -File build.ps1 -WorkerOnly -Tag latest -Push

param(
  [string]$Owner = "kkh95x",
  [string]$Tag = "latest",
  [switch]$Push,
  [switch]$DashboardOnly,
  [switch]$WorkerOnly
)

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $Here "..\..")

$registry = "ghcr.io"
$dashboardImage = "$registry/${Owner}/ota-update-server-dashboard`:$Tag"
$workerImage = "$registry/${Owner}/ota-update-server-worker`:$Tag"

function Build-Image {
  param([string]$Dockerfile, [string]$Image)
  Write-Host "Building $Image (context: $Root) ..."
  docker build -f (Join-Path $Here $Dockerfile) -t $Image $Root
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $WorkerOnly) {
  Build-Image "Dockerfile.dashboard" $dashboardImage
}

if (-not $DashboardOnly) {
  Build-Image "Dockerfile.worker" $workerImage
}

if ($Push) {
  Write-Host "Logging in to $registry ..."
  docker login $registry -u $Owner
  if (-not $WorkerOnly) { docker push $dashboardImage }
  if (-not $DashboardOnly) { docker push $workerImage }
  Write-Host "Done."
} else {
  Write-Host "Built locally. Add -Push to upload to GHCR."
}
