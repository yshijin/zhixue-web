@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Zhixue One-Click Start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-zhixue.ps1" %*
if errorlevel 1 pause
