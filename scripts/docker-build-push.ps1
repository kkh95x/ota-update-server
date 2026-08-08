param(
  [string]$Owner = "kkh95x",
  [string]$Tag = "latest",
  [switch]$Push,
  [switch]$DashboardOnly,
  [switch]$WorkerOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$registry = "ghcr.io"
$dashboardImage = "$registry/$Owner/ota-update-server-dashboard`:$Tag"
$workerImage = "$registry/$Owner/ota-update-server-worker`:$Tag"

function Build-Image {
  param([string]$Dockerfile, [string]$Image)
  Write-Host "Building $Image ..."
  docker build -f $Dockerfile -t $Image .
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $WorkerOnly) {
  Build-Image "infra/docker/Dockerfile.dashboard" $dashboardImage
}

if (-not $DashboardOnly) {
  Build-Image "infra/docker/Dockerfile.worker" $workerImage
}

if ($Push) {
  Write-Host "Logging in to $registry (use a GitHub PAT with write:packages) ..."
  docker login $registry -u $Owner
  if (-not $WorkerOnly) { docker push $dashboardImage }
  if (-not $DashboardOnly) { docker push $workerImage }
  Write-Host "Pushed:"
  if (-not $WorkerOnly) { Write-Host "  $dashboardImage" }
  if (-not $DashboardOnly) { Write-Host "  $workerImage" }
} else {
  Write-Host "Built locally. Re-run with -Push to upload to GHCR."
}
