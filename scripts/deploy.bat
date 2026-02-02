@echo off
set "root=%~dp0.."
for %%I in ("%root%") do set "root=%%~fI"
cd /d "%root%\app\web"
set "PATH=%PATH%;%APPDATA%\npm"
call npm run build
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)
call firebase deploy --only hosting --project secondbrainv2-8e789
