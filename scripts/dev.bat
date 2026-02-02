@echo off
set "root=%~dp0.."
for %%I in ("%root%") do set "root=%%~fI"
REM Start React dev server in a new window
start "Second Brain Web" /d "%root%\app\web" cmd /k npm run dev -- --force
REM Give Vite a moment to boot, then open the UI
timeout /t 2 /nobreak >nul
start "" http://localhost:5173
