@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
  if exist "%LOCALAPPDATA%\AnkerPcCompanion\app\.venv\Scripts\pythonw.exe" (
    cd /d "%LOCALAPPDATA%\AnkerPcCompanion\app"
  ) else (
    echo Bitte zuerst Einrichten.cmd in diesem entpackten Ordner oeffnen.
    pause
    exit /b 1
  )
)
start "Anker PC-Begleiter" ".venv\Scripts\pythonw.exe" -m anker_companion
