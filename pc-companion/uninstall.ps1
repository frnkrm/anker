param([switch]$DeleteData)
$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'Anker PC-Begleiter' -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'Autostart entfernt. Beende den PC-Begleiter ueber sein Fenster, bevor du die Programmdateien loeschst.'
if ($DeleteData) {
  $ankerData = Join-Path $env:LOCALAPPDATA 'AnkerPcCompanion'
  Remove-Item (Join-Path $ankerData 'companion.state') -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ankerData 'pc-certificate.pem') -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $ankerData 'logs') -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host 'Begleiter-Daten geloescht. Das klassische Anker-PC-Stopp-Paket blieb erhalten.'
}
