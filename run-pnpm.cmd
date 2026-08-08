@echo off
REM Safe pnpm launcher for Windows (does not shadow the real pnpm binary)
setlocal
set "ROOT=%~dp0"
set "PNPM_JS=%ROOT%node_modules\pnpm\bin\pnpm.cjs"
if exist "%PNPM_JS%" (
  node "%PNPM_JS%" %*
  exit /b %ERRORLEVEL%
)
where npx >nul 2>&1
if %ERRORLEVEL% equ 0 (
  call npx --yes pnpm@9.15.4 %*
  exit /b %ERRORLEVEL%
)
echo Install pnpm first: npx pnpm@9.15.4 install
exit /b 1
