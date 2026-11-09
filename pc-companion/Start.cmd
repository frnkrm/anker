@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
  echo Bitte zuerst install.ps1 mit PowerShell ausfuehren.
  pause
  exit /b 1
)
start "Anker PC-Begleiter" ".venv\Scripts\pythonw.exe" -m anker_companion
