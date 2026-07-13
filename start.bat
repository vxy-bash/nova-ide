@echo off
title Nova IDE
echo.
echo  ============================================
echo   Nova IDE - Starting...
echo  ============================================
echo.

:: Get the directory where this script is located
set "PROJECT_DIR=%~dp0"

:: Start Electron App
echo Starte Electron App...
cd /d "%PROJECT_DIR%"
npm start
