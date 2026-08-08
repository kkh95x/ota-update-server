# Safe pnpm launcher for Windows (name is NOT pnpm.cmd — avoids shadowing)
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PnpmJs = Join-Path $Root "node_modules\pnpm\bin\pnpm.cjs"
if (Test-Path $PnpmJs) {
    & node $PnpmJs @args
    exit $LASTEXITCODE
}
if (Get-Command npx -ErrorAction SilentlyContinue) {
    & npx --yes pnpm@9.15.4 @args
    exit $LASTEXITCODE
}
Write-Error "Run first: npx pnpm@9.15.4 install"
exit 1
