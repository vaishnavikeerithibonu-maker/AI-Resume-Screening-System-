@echo off
title Aegis Match - Startup
echo ==============================================================
echo              AEGIS MATCH - RESUME SCREENING SYSTEM            
echo ==============================================================
echo.
echo [1] Checking dependencies...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js or run a local python server:
    echo "python -m http.server 8080"
    pause
    exit /b
)

echo [2] Starting local HTTP web server...
echo [3] Launching candidate screening portal in default browser...
start http://localhost:8080
echo.
echo Press Ctrl+C in this terminal window to stop the server.
echo.
npx -y http-server -p 8080
