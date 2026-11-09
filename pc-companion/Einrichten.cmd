@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if errorlevel 1 (
  echo.
  echo Einrichtung nicht abgeschlossen. Die Meldung oben zeigt den naechsten Schritt.
  pause
  exit /b 1
)
echo.
echo Einrichtung fertig. Start.cmd oeffnet den installierten Begleiter.
pause
