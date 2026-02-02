@echo off
REM Start the local API server
cd /d "%~dp0..\app\server"
start "" node index.js
REM Give the server a moment to boot, then open the browser
timeout /t 1 /nobreak >nul
start "" http://localhost:3001
