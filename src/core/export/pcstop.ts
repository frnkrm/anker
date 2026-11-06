// Erzeugt das Windows-Paket für den PC-Stopp. Die Skripte laufen mit Windows PowerShell 5.1,
// ohne Zusatzmodule. Zeitzone: die des PCs (sollte Europe/Berlin sein).

export interface PcStopConfig {
  /** URL der Edge Function, leer = nur feste Zeit */
  endpoint: string
  token: string
  /** Feste Rückfallzeit "HH:MM", wenn nie eine Verbindung bestand */
  fallbackTime: string
  /** Ohne heutigen Onlineauftrag sicher pausieren oder ausdrücklich feste Zeit verwenden. */
  offlinePolicy?: 'pause' | 'fixed-time'
}

export function configJson(c: PcStopConfig): string {
  return JSON.stringify({ endpoint: c.endpoint, token: c.token, fallbackTime: c.fallbackTime, protocolVersion: 2, offlinePolicy: c.offlinePolicy ?? (c.endpoint ? 'pause' : 'fixed-time') }, null, 2)
}

// Wichtig: "shutdown /s /t N" mit N > 0 schließt laut Windows-Doku Programme erzwungen (/f) und vernichtet
// Ungespeichertes. Deshalb erst warnen, eine Schonfrist lassen und dann ohne Zwang mit /t 0 herunterfahren:
// Programme mit offener Arbeit können das dann noch aufhalten. pc-stop-abbrechen.ps1 setzt für heute aus.
export const PC_STOP_PS1 = String.raw`# Anker PC-Stopp2: heutiger Auftrag, Pause und datumsgebundener Offlinecache.
$ErrorActionPreference = 'SilentlyContinue'
$ankerDir = Join-Path $env:LOCALAPPDATA 'Anker'
$ankerCfg = Get-Content (Join-Path $ankerDir 'config.json') -Raw | ConvertFrom-Json
$ankerCacheFile = Join-Path $ankerDir 'cache.json'
$ankerStateFile = Join-Path $ankerDir 'state.json'
$ankerNow = [datetimeoffset]::UtcNow
$ankerZone = [TimeZoneInfo]::FindSystemTimeZoneById('W. Europe Standard Time')
if (-not $ankerZone -or -not $ankerCfg) { return }
$ankerBerlin = [TimeZoneInfo]::ConvertTime($ankerNow, $ankerZone)
$ankerDate = $ankerBerlin.AddHours(-4).ToString('yyyy-MM-dd')

function Show-Toast([string]$title, [string]$text) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $tpl = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $nodes = $tpl.GetElementsByTagName('text')
    $nodes.Item(0).AppendChild($tpl.CreateTextNode($title)) | Out-Null
    $nodes.Item(1).AppendChild($tpl.CreateTextNode($text)) | Out-Null
    $toast = [Windows.UI.Notifications.ToastNotification]::new($tpl)
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
  } catch { }
}

function Test-AnkerCommand($command) {
  if (-not $command -or $command.version -ne 2 -or $command.date -ne $ankerDate -or -not $command.revision) { return $false }
  try {
    if ([datetimeoffset]::Parse($command.validUntil) -le $ankerNow) { return $false }
    if ($command.mode -eq 'paused') { return -not $command.stopAt }
    if ($command.mode -ne 'scheduled' -or -not $command.stopAt) { return $false }
    $null = [datetimeoffset]::Parse($command.stopAt)
    return $true
  } catch { return $false }
}

$ankerState = @{}
if (Test-Path $ankerStateFile) { (Get-Content $ankerStateFile -Raw | ConvertFrom-Json).psobject.Properties | ForEach-Object { $ankerState[$_.Name] = $_.Value } }
# Lokaler Abbruch gilt für den ganzen Plantag, auch nach neuer Veröffentlichung/Verlängerung.
if ($ankerState['pausedDate'] -eq $ankerDate) { return }

$ankerCommand = $null
if ($ankerCfg.endpoint) {
  try {
    $ankerOnline = Invoke-RestMethod -Uri $ankerCfg.endpoint -Headers @{ 'x-anker-token' = $ankerCfg.token } -TimeoutSec 10 -ErrorAction Stop
    if (Test-AnkerCommand $ankerOnline) {
      $ankerCommand = $ankerOnline
      $ankerOnline | ConvertTo-Json -Depth 6 | Set-Content $ankerCacheFile -Encoding UTF8
    }
  } catch { }
}
if (-not $ankerCommand -and (Test-Path $ankerCacheFile)) {
  $ankerCached = Get-Content $ankerCacheFile -Raw | ConvertFrom-Json
  if (Test-AnkerCommand $ankerCached) { $ankerCommand = $ankerCached }
}
if ($ankerCommand -and $ankerCommand.mode -eq 'paused') {
  $ankerState.Remove('down')
  $ankerState.Remove('w15')
  $ankerState.Remove('w5')
  $ankerState | ConvertTo-Json | Set-Content $ankerStateFile -Encoding UTF8
  return
}

$ankerTarget = $null
if ($ankerCommand) {
  try { $ankerTarget = [datetimeoffset]::Parse($ankerCommand.stopAt) } catch { return }
}
elseif ($ankerCfg.offlinePolicy -eq 'fixed-time' -or (-not $ankerCfg.endpoint -and -not $ankerCfg.offlinePolicy)) {
  # Nur ausdrücklich gewählte feste Offlinezeit, niemals gestrige Uhrzeit erneut aus einem Cache ableiten.
  if ($ankerCfg.fallbackTime -notmatch '^(?:[01]\d|2[0-3]):[0-5]\d$') { return }
  try {
    $ankerClock = [datetime]::ParseExact($ankerCfg.fallbackTime, 'HH:mm', $null)
    $ankerLocal = [datetime]::ParseExact($ankerDate, 'yyyy-MM-dd', $null).AddHours($ankerClock.Hour).AddMinutes($ankerClock.Minute)
    if ($ankerClock.Hour -lt 12) { $ankerLocal = $ankerLocal.AddDays(1) }
    $ankerTarget = [datetimeoffset]::new([TimeZoneInfo]::ConvertTimeToUtc($ankerLocal, $ankerZone))
  } catch { return }
}
if (-not $ankerTarget) { return }
$ankerTag = $ankerTarget.ToString('o')
$ankerLeft = ($ankerTarget - $ankerNow).TotalMinutes
if ($ankerState['paused'] -eq $ankerTag -or $ankerState['paused'] -eq $ankerTarget.ToLocalTime().ToString('yyyyMMddHHmm')) { return }
if ($ankerLeft -le 15 -and $ankerLeft -gt 5 -and $ankerState['w15'] -ne $ankerTag) {
  Show-Toast ("In " + [math]::Ceiling($ankerLeft) + " Minuten PC-Stopp") 'Speichere in Ruhe. Für heute aussetzen: pc-stop-abbrechen.ps1'
  $ankerState['w15'] = $ankerTag
}
elseif ($ankerLeft -le 5 -and $ankerLeft -gt 0 -and $ankerState['w5'] -ne $ankerTag) {
  Show-Toast ("In " + [math]::Ceiling($ankerLeft) + " Minuten PC-Stopp") 'Jetzt speichern. Danach bleiben noch 5 Minuten.'
  $ankerState['w5'] = $ankerTag
}
elseif ($ankerLeft -le 0 -and $ankerLeft -gt -360) {
  if ($ankerState['down'] -ne $ankerTag) {
    Show-Toast 'PC-Stopp: jetzt speichern' 'In etwa 5 Minuten folgt der nächste Lauf. Abbrechen: pc-stop-abbrechen.ps1'
    $ankerState['down'] = $ankerTag
  }
  else {
    # Ohne Zwang und ohne verzögerte shutdown-Option. Ungespeicherte Programme können das aufhalten.
    & shutdown.exe /s /t 0 /c "Anker: PC-Stopp"
  }
}
$ankerState | ConvertTo-Json | Set-Content $ankerStateFile -Encoding UTF8
`

export const INSTALL_PS1 = String.raw`# Anker PC-Stopp installieren (ohne Administratorrechte)
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $env:LOCALAPPDATA 'Anker'
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $src 'pc-stop.ps1') $dir -Force
Copy-Item (Join-Path $src 'pc-stop-abbrechen.ps1') $dir -Force
Copy-Item (Join-Path $src 'config.json') $dir -Force

$script = Join-Path $dir 'pc-stop.ps1'
$argLine = "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " + '"' + $script + '"'
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument $argLine
$every = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Anker PC-Stopp' -Action $action -Trigger @($every, $logon) -Settings $settings -Principal $principal -Force | Out-Null

Write-Host 'Anker PC-Stopp ist eingerichtet. Test:' -ForegroundColor Green
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script
Write-Host 'Fertig. Die Aufgabe läuft alle 5 Minuten und bei der Anmeldung.'
`

export const ABORT_PS1 = String.raw`# Anker PC-Stopp: diesen Berliner Plantag ausdrücklich aussetzen.
$ankerDir = Join-Path $env:LOCALAPPDATA 'Anker'
$ankerStateFile = Join-Path $ankerDir 'state.json'
$ankerState = @{}
if (Test-Path $ankerStateFile) { (Get-Content $ankerStateFile -Raw | ConvertFrom-Json).psobject.Properties | ForEach-Object { $ankerState[$_.Name] = $_.Value } }
$ankerBerlin = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetimeoffset]::UtcNow, 'W. Europe Standard Time')
$ankerState['pausedDate'] = $ankerBerlin.AddHours(-4).ToString('yyyy-MM-dd')
$ankerState | ConvertTo-Json | Set-Content $ankerStateFile -Encoding UTF8
& shutdown.exe /a 2>$null
Write-Host 'PC-Stopp ist für diesen Plantag ausgesetzt.' -ForegroundColor Green
`

export const UNINSTALL_PS1 = String.raw`# Anker PC-Stopp entfernen
Unregister-ScheduledTask -TaskName 'Anker PC-Stopp' -Confirm:$false -ErrorAction SilentlyContinue
& shutdown.exe /a 2>$null
Remove-Item -Recurse -Force (Join-Path $env:LOCALAPPDATA 'Anker') -ErrorAction SilentlyContinue
Write-Host 'Anker PC-Stopp wurde entfernt.' -ForegroundColor Green
`

export function readme(c: PcStopConfig): string {
  return [
    'ANKER PC-STOPP2 – Anleitung',
    '==========================',
    '',
    '1. ZIP-Datei entpacken, z. B. nach Downloads\\anker-pc-stopp.',
    '2. Im Ordner: Rechtsklick auf install.ps1 > "Mit PowerShell ausführen".',
    '   Falls Windows warnt: "Weitere Informationen" > "Trotzdem ausführen".',
    '3. Fertig. Alle 5 Minuten fragt der PC die heutige PC-Stopp-Zeit ab.',
    '   15 und 5 Minuten vorher kommt eine Windows-Benachrichtigung. Zur Stopp-Zeit kommt noch eine,',
    '   etwa 5 Minuten später fährt der PC ohne Zwang herunter. Programme mit offener Arbeit können das aufhalten.',
    '',
    `Verbindung: ${c.endpoint ? 'Onlineabruf eingerichtet. Übernahme am PC wird der App nicht bestätigt.' : 'ohne Verbindung, ausdrücklich feste Zeit'}`,
    `Feste Zeit: ${c.fallbackTime}. Ohne heutigen Onlineauftrag: ${(c.offlinePolicy ?? (c.endpoint ? 'pause' : 'fixed-time')) === 'pause' ? 'sicher pausieren' : 'ausdrücklich feste Zeit verwenden'}.`,
    'Ein Cache gilt nur am gespeicherten Berliner Plantag. Eine veröffentlichte Pause bleibt auch offline erhalten.',
    'Dieses neue Windows-Paket installieren, damit eine offene Abendplanung tatsächlich pausieren kann.',
    'Alte installierte Skripte kennen die Pause nicht und können weiterhin ihre alte Abschaltzeit verwenden.',
    '',
    'Für heute aussetzen: pc-stop-abbrechen.ps1 mit PowerShell ausführen.',
    'Entfernen: uninstall.ps1 mit PowerShell ausführen.',
    '',
  ].join('\r\n')
}

/** Dateien für das ZIP-Paket. */
export function pcStopFiles(c: PcStopConfig): Record<string, string> {
  return {
    'install.ps1': INSTALL_PS1,
    'pc-stop.ps1': PC_STOP_PS1,
    'pc-stop-abbrechen.ps1': ABORT_PS1,
    'uninstall.ps1': UNINSTALL_PS1,
    'config.json': configJson(c),
    'ANLEITUNG.txt': readme(c),
  }
}
