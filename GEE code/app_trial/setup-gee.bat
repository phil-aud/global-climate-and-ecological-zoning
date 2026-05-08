@echo off
REM Setup GEE Service Account - Windows Batch Wrapper
REM This file makes it easy to run the PowerShell setup script

echo.
echo ========================================
echo   GEE Service Account Setup
echo ========================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if errorlevel 1 (
    echo Error: PowerShell not found
    pause
    exit /b 1
)

REM Run the PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-gee.ps1"

pause
