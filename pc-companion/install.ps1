# User-level installation; never changes the firewall or executes a lock/shutdown.
param([switch]$NoAutostart)
$ErrorActionPreference = 'Stop'
$ankerSource = $PSScriptRoot
$ankerTarget = Join-Path $env:LOCALAPPDATA 'AnkerPcCompanion\app'
New-Item -ItemType Directory -Force -Path $ankerTarget | Out-Null
Copy-Item (Join-Path $ankerSource 'anker_companion') $ankerTarget -Recurse -Force
Copy-Item (Join-Path $ankerSource 'requirements.txt') $ankerTarget -Force
Copy-Item (Join-Path $ankerSource 'Start.cmd') $ankerTarget -Force
& py -3 -m venv (Join-Path $ankerTarget '.venv')
if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 oder neuer installieren und erneut versuchen.' }
$ankerPython = Join-Path $ankerTarget '.venv\Scripts\python.exe'
& $ankerPython -m pip install --disable-pip-version-check -r (Join-Path $ankerTarget 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Abhaengigkeiten wurden nicht vollstaendig installiert.' }
if (-not $NoAutostart) {
  $ankerPythonw = Join-Path $ankerTarget '.venv\Scripts\pythonw.exe'
  $ankerAction = New-ScheduledTaskAction -Execute $ankerPythonw -Argument '-m anker_companion' -WorkingDirectory $ankerTarget
  $ankerTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $ankerPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  $ankerSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName 'Anker PC-Begleiter' -Action $ankerAction -Trigger $ankerTrigger -Principal $ankerPrincipal -Settings $ankerSettings -Force | Out-Null
}
Write-Host 'Installiert. Start.cmd im Installationsordner oeffnen. Bei der Windows-Firewall nur private Netzwerke erlauben.'
Write-Host $ankerTarget
