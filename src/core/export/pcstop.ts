// Erzeugt das Windows-Paket für den PC-Stopp. Die Skripte laufen mit Windows PowerShell 5.1,
// ohne Zusatzmodule. Zeitzone: die des PCs (sollte Europe/Berlin sein).

export interface PcStopConfig {
  /** URL der Edge Function, leer = nur feste Zeit */
  endpoint: string
  token: string
  /** Feste Rückfallzeit "HH:MM", wenn nie eine Verbindung bestand */
  fallbackTime: string
}

export function configJson(c: PcStopConfig): string {
  return JSON.stringify({ endpoint: c.endpoint, token: c.token, fallbackTime: c.fallbackTime }, null, 2)
}

export const PC_STOP_PS1 = String.raw`# Anker PC-Stopp: holt die heutige Zeit, warnt 15 und 5 Minuten vorher, fährt dann herunter.
$ErrorActionPreference = 'SilentlyContinue'
$dir = Join-Path $env:LOCALAPPDATA 'Anker'
$cfg = Get-Content (Join-Path $dir 'config.json') -Raw | ConvertFrom-Json
$cacheFile = Join-Path $dir 'cache.json'
$stateFile = Join-Path $dir 'state.json'
$now = Get-Date

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

function Local-Target([string]$hhmm) {
  $t = [datetime]::ParseExact($hhmm, 'HH:mm', $null)
  $target = $now.Date.AddHours($t.Hour).AddMinutes($t.Minute)
  # Zeiten vor 12 Uhr gelten als "nach Mitternacht"
  if ($t.Hour -lt 12) { if ($now.Hour -ge 12) { $target = $target.AddDays(1) } }
  return $target
}

# 1) Zeit holen (online), sonst Cache, sonst feste Rückfallzeit
$target = $null
if ($cfg.endpoint) {
  try {
    $res = Invoke-RestMethod -Uri $cfg.endpoint -Headers @{ 'x-anker-token' = $cfg.token } -TimeoutSec 10
    if ($res.stopAt) {
      $target = ([datetimeoffset]::Parse($res.stopAt)).LocalDateTime
      @{ stopAt = $res.stopAt; localTime = $res.localTime; fetched = $now.ToString('o') } | ConvertTo-Json | Set-Content $cacheFile -Encoding UTF8
    }
  } catch { }
}
if (-not $target -and (Test-Path $cacheFile)) {
  $cache = Get-Content $cacheFile -Raw | ConvertFrom-Json
  $cached = ([datetimeoffset]::Parse($cache.stopAt)).LocalDateTime
  if (($now - $cached).TotalHours -lt 6 -and ($cached - $now).TotalHours -lt 18) { $target = $cached }
  elseif ($cache.localTime) { $target = Local-Target $cache.localTime }
}
if (-not $target) { $target = Local-Target $cfg.fallbackTime }

# 2) Warnen / herunterfahren. Aktiv bis 6 h nach dem PC-Stopp.
$state = @{}
if (Test-Path $stateFile) { (Get-Content $stateFile -Raw | ConvertFrom-Json).psobject.Properties | ForEach-Object { $state[$_.Name] = $_.Value } }
$tag = $target.ToString('yyyyMMddHHmm')
$left = ($target - $now).TotalMinutes

if ($left -le 15 -and $left -gt 5 -and $state['w15'] -ne $tag) {
  Show-Toast ("In " + [math]::Ceiling($left) + " Minuten PC-Stopp") ("Um " + $target.ToString('HH:mm') + " fährt der PC herunter. Runde in Ruhe beenden.")
  $state['w15'] = $tag
}
elseif ($left -le 5 -and $left -gt 0 -and $state['w5'] -ne $tag) {
  Show-Toast ("In " + [math]::Ceiling($left) + " Minuten PC-Stopp") 'Jetzt speichern. Gleich ist Feierabend für den PC.'
  $state['w5'] = $tag
  & shutdown.exe /s /t ([int]([math]::Max(60, $left * 60))) /c "Anker: PC-Stopp um $($target.ToString('HH:mm'))"
}
elseif ($left -le 0 -and $left -gt -360) {
  if ($state['down'] -ne $tag) { Show-Toast 'PC-Stopp' 'Der PC fährt in 2 Minuten herunter. Gute Nacht!' }
  $state['down'] = $tag
  & shutdown.exe /s /t 120 /c "Anker: PC-Stopp"
}
$state | ConvertTo-Json | Set-Content $stateFile -Encoding UTF8
`

export const INSTALL_PS1 = String.raw`# Anker PC-Stopp installieren (ohne Administratorrechte)
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $env:LOCALAPPDATA 'Anker'
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $src 'pc-stop.ps1') $dir -Force
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

export const UNINSTALL_PS1 = String.raw`# Anker PC-Stopp entfernen
Unregister-ScheduledTask -TaskName 'Anker PC-Stopp' -Confirm:$false -ErrorAction SilentlyContinue
& shutdown.exe /a 2>$null
Remove-Item -Recurse -Force (Join-Path $env:LOCALAPPDATA 'Anker') -ErrorAction SilentlyContinue
Write-Host 'Anker PC-Stopp wurde entfernt.' -ForegroundColor Green
`

export function readme(c: PcStopConfig): string {
  return [
    'ANKER PC-STOPP – Anleitung',
    '==========================',
    '',
    '1. ZIP-Datei entpacken, z. B. nach Downloads\\anker-pc-stopp.',
    '2. Im Ordner: Rechtsklick auf install.ps1 > "Mit PowerShell ausführen".',
    '   Falls Windows warnt: "Weitere Informationen" > "Trotzdem ausführen".',
    '3. Fertig. Alle 5 Minuten fragt der PC die heutige PC-Stopp-Zeit ab.',
    '   15 und 5 Minuten vorher kommt eine Windows-Benachrichtigung, dann fährt der PC herunter.',
    '',
    `Verbindung: ${c.endpoint ? 'mit der App verbunden (Verlängerungen kommen automatisch an)' : 'ohne Verbindung, feste Zeit'}`,
    `Rückfallzeit ohne Internet: ${c.fallbackTime} (bzw. die zuletzt bekannte Zeit).`,
    '',
    'Notfall: "shutdown /a" in der Eingabeaufforderung bricht ein laufendes Herunterfahren ab.',
    'Entfernen: uninstall.ps1 mit PowerShell ausführen.',
    '',
  ].join('\r\n')
}

/** Dateien für das ZIP-Paket. */
export function pcStopFiles(c: PcStopConfig): Record<string, string> {
  return {
    'install.ps1': INSTALL_PS1,
    'pc-stop.ps1': PC_STOP_PS1,
    'uninstall.ps1': UNINSTALL_PS1,
    'config.json': configJson(c),
    'ANLEITUNG.txt': readme(c),
  }
}
