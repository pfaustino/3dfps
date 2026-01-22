@echo off
echo Starting local server...
echo Try to go to http://localhost:3000 in your browser.

where npx >nul 2>nul
if %errorlevel% equ 0 (
    echo Using npx serve...
    call npx -y serve -l 3000
    goto end
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Using Python http.server...
    python -m http.server 3000
    goto end
)

echo Could not find npx or python to start a server.
echo Please install Node.js or Python.
pause

:end
pause
