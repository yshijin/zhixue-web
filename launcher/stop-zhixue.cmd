@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Zhixue One-Click Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-zhixue.ps1" %*
if errorlevel 1 pause
