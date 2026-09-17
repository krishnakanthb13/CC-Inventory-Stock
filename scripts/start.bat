@echo off
chcp 65001 >nul
cls
echo =====================================================
echo   Crown ^& Cross - Windows Local Launcher
echo =====================================================
echo Running pre-flight builds and starting Crown ^& Cross...
echo.
node "%~dp0start.js"
pause
