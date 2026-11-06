param([string]$EvidenceDir = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$global:HarnessRoot = Join-Path $EvidenceDir 'cases'
New-Item -ItemType Directory -Path $global:HarnessRoot -Force | Out-Null
$results = [System.Collections.Generic.List[object]]::new()
$parsers = [System.Collections.Generic.List[object]]::new()

# These overrides resolve before application/executable lookup. The installer and uninstaller
# are parsed only; only the stop and abort exports are executed against synthetic LOCALAPPDATA.
function global:shutdown.exe {
  param([Parameter(ValueFromRemainingArguments = $true)][object[]]$Arguments)
  $global:HarnessEffects.shutdown.Add(@($Arguments))
}
function global:Invoke-RestMethod {
  param($Uri, $Headers, $TimeoutSec, $ErrorAction)
  $global:HarnessEffects.requests.Add([string]$Uri)
  if ($null -eq $global:HarnessOnline) { throw 'Synthetic offline response' }
  return $global:HarnessOnline
}

foreach ($name in @('pc-stop.ps1', 'pc-stop-abbrechen.ps1', 'install.ps1', 'uninstall.ps1')) {
  $tokens = $null; $errors = $null
  $path = Join-Path $EvidenceDir $name
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
  $parsers.Add([ordered]@{ file = $name; errors = @($errors | ForEach-Object { $_.Message }); tokens = $tokens.Count })
  if ($errors.Count) { throw "Parser errors in $name" }
}

$stopSource = Get-Content (Join-Path $EvidenceDir 'pc-stop.ps1') -Raw -Encoding UTF8
$abortSource = Get-Content (Join-Path $EvidenceDir 'pc-stop-abbrechen.ps1') -Raw -Encoding UTF8
$tokens = $null; $errors = $null
$stopAst = [System.Management.Automation.Language.Parser]::ParseInput($stopSource, [ref]$tokens, [ref]$errors)
$toast = @($stopAst.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Show-Toast' }, $true))
if ($toast.Count -ne 1) { throw 'Expected one toast seam' }
$body = $toast[0].Body.Extent
$toastStub = '{ $global:HarnessEffects.toasts.Add([ordered]@{ title = $title; text = $text }) }'
$stopSource = $stopSource.Substring(0, $body.StartOffset) + $toastStub + $stopSource.Substring($body.EndOffset)
foreach ($source in @($stopSource, $abortSource)) {
  if ([regex]::Matches($source, [regex]::Escape('[datetimeoffset]::UtcNow')).Count -ne 1) { throw 'Unexpected clock seam' }
}
$stopScript = [scriptblock]::Create($stopSource.Replace('[datetimeoffset]::UtcNow', '$global:HarnessNow'))
$abortScript = [scriptblock]::Create($abortSource.Replace('[datetimeoffset]::UtcNow', '$global:HarnessNow'))

function Assert($condition, [string]$message) { if (-not $condition) { throw $message } }
function Same($actual, $expected, [string]$message) { Assert ($actual -eq $expected) "$message (actual=$actual expected=$expected)" }
function New-Command([string]$Mode = 'scheduled', [string]$Stop = '2026-11-05T23:00:00+01:00', [string]$Date = '2026-11-05', [string]$Until = '2026-11-06T03:00:00Z') {
  $value = @{ version = 2; date = $Date; revision = 'synthetic-revision'; mode = $Mode; validUntil = $Until }
  if ($Mode -eq 'scheduled') { $value.stopAt = $Stop; $value.localTime = '23:00'; $value.extended = $false }
  return [pscustomobject]$value
}
function Config($patch = @{}) {
  $cfg = @{ endpoint = 'https://synthetic.invalid/pc-stop'; token = 'synthetic-token'; fallbackTime = '23:00'; offlinePolicy = 'pause'; protocolVersion = 2 }
  foreach ($key in $patch.Keys) { $cfg[$key] = $patch[$key] }
  $cfg | ConvertTo-Json | Set-Content (Join-Path $global:HarnessApp 'config.json')
}
function State($value) { $value | ConvertTo-Json | Set-Content (Join-Path $global:HarnessApp 'state.json') }
function Cache($value) { $value | ConvertTo-Json | Set-Content (Join-Path $global:HarnessApp 'cache.json') }
function Read-State { return Get-Content (Join-Path $global:HarnessApp 'state.json') -Raw | ConvertFrom-Json }
function Run([string]$At = '2026-11-05T22:00:00Z') { $global:HarnessNow = [datetimeoffset]::Parse($At); & $stopScript }
function Abort([string]$At) { $global:HarnessNow = [datetimeoffset]::Parse($At); & $abortScript }
function No-Shutdown { Same $global:HarnessEffects.shutdown.Count 0 'No shutdown expected' }
function Test([string]$name, [scriptblock]$test) {
  $caseDir = Join-Path $global:HarnessRoot ($name -replace '[^A-Za-z0-9-]', '-')
  $env:LOCALAPPDATA = $caseDir
  $global:HarnessApp = Join-Path $caseDir 'Anker'
  New-Item -ItemType Directory -Path $global:HarnessApp -Force | Out-Null
  foreach ($file in @('config.json', 'cache.json', 'state.json')) {
    $path = Join-Path $global:HarnessApp $file
    if (Test-Path $path) { Remove-Item $path }
  }
  $global:HarnessEffects = [ordered]@{ requests = [System.Collections.Generic.List[object]]::new(); shutdown = [System.Collections.Generic.List[object]]::new(); toasts = [System.Collections.Generic.List[object]]::new() }
  $global:HarnessOnline = $null
  $started = [datetimeoffset]::UtcNow
  try {
    Config
    & $test
    $results.Add([ordered]@{ name = $name; status = 'passed'; effects = $global:HarnessEffects; durationMs = ([datetimeoffset]::UtcNow - $started).TotalMilliseconds })
    Write-Host "PASS $name"
  } catch {
    $results.Add([ordered]@{ name = $name; status = 'failed'; error = $_.Exception.Message; location = $_.ScriptStackTrace; effects = $global:HarnessEffects })
    Write-Host "FAIL $name : $($_.Exception.Message)"
  }
}

Test 'online-paused-clears-old-shutdown-markers' {
  State @{ down = 'old'; w15 = 'old'; w5 = 'old'; kept = 'preserved' }
  $global:HarnessOnline = New-Command -Mode 'paused'
  Run
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 0 'Paused must not warn'
  Same (Read-State).kept 'preserved' 'Unrelated state preserved'
  Assert (-not (Read-State).PSObject.Properties['down']) 'Old shutdown marker must clear'
  Same ((Get-Content (Join-Path $global:HarnessApp 'cache.json') -Raw | ConvertFrom-Json).mode) 'paused' 'Pause cached'
}
Test 'current-day-cached-pause-survives-offline-fixed-fallback' {
  Config @{ offlinePolicy = 'fixed-time' }
  Cache (New-Command -Mode 'paused')
  State @{ down = 'old' }
  Run; Run '2026-11-05T22:10:00Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 0 'Cached pause takes priority over fixed fallback'
}
Test 'stale-date-cache-is-not-replayed' {
  Cache (New-Command -Date '2026-11-04' -Stop '2026-11-04T23:00:00+01:00')
  State @{ down = '2026-11-04T23:00:00.0000000+01:00' }
  Run; Run '2026-11-05T22:05:00Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 0 'Stale cache must not warn'
}
Test 'missing-server-and-legacy-v1-default-to-pause' {
  Config @{ offlinePolicy = $null }
  Run; Run '2026-11-05T22:05:00Z'
  $global:HarnessOnline = [pscustomobject]@{ version = 1; stopTime = '23:00' }
  Run '2026-11-05T22:10:00Z'; Run '2026-11-05T22:15:00Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 0 'No implicit fallback from server/v1'
}
Test 'explicit-fixed-fallback-has-grace-and-never-force' {
  Config @{ offlinePolicy = 'fixed-time' }
  Run
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 1 'First due run warns'
  Run '2026-11-05T22:05:00Z'
  Same $global:HarnessEffects.shutdown.Count 1 'Next five-minute run shuts down'
  Same ($global:HarnessEffects.shutdown[0] -join ' ') '/s /t 0 /c Anker: PC-Stopp' 'Only immediate non-forced shutdown arguments'
  Assert (-not ($global:HarnessEffects.shutdown[0] -contains '/f')) 'Never force'
}
Test 'explicit-after-midnight-fallback-remains-same-plan-day' {
  Config @{ endpoint = ''; offlinePolicy = 'fixed-time'; fallbackTime = '00:30' }
  Run '2026-11-05T23:30:00Z'
  No-Shutdown
  Run '2026-11-05T23:35:00Z'
  Same $global:HarnessEffects.shutdown.Count 1 'After-midnight fixed fallback is valid'
}
Test 'local-abort-before-midnight-blocks-next-date-until-plan-day-changes' {
  Abort '2026-11-05T22:59:00Z'
  Same (Read-State).pausedDate '2026-11-05' 'Abort stores Berlin plan date'
  Same ($global:HarnessEffects.shutdown[0] -join ' ') '/a' 'Abort invokes cancellation only'
  $global:HarnessEffects.shutdown.Clear()
  $global:HarnessOnline = New-Command -Stop '2026-11-06T00:05:00+01:00'
  Run '2026-11-05T23:10:00Z'; Run '2026-11-05T23:15:00Z'
  No-Shutdown
  Same $global:HarnessEffects.requests.Count 0 'Local day abort precedes network'
  $global:HarnessOnline = New-Command -Date '2026-11-06' -Stop '2026-11-06T04:00:00+01:00' -Until '2026-11-07T03:00:00Z'
  Run '2026-11-06T03:01:00Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 1 'New plan day starts a fresh grace period'
}
Test 'local-abort-after-midnight-still-pauses-previous-plan-day' {
  Abort '2026-11-05T23:20:00Z'
  Same (Read-State).pausedDate '2026-11-05' '00:20 belongs to previous plan day'
  $global:HarnessEffects.shutdown.Clear()
  $global:HarnessOnline = New-Command -Stop '2026-11-06T00:20:00+01:00'
  Run '2026-11-05T23:20:00Z'; Run '2026-11-05T23:25:00Z'
  No-Shutdown
}
Test 'previous-day-down-marker-cannot-skip-current-day-grace' {
  State @{ down = '2026-11-04T23:00:00.0000000+01:00' }
  $global:HarnessOnline = New-Command
  Run
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 1 'Fresh current-day warning required'
}
Test 'invalid-config-does-not-shut-down' {
  foreach ($time in @('25:00', '23:99', 'bad', '')) {
    Config @{ offlinePolicy = 'fixed-time'; fallbackTime = $time }
    Run; Run '2026-11-05T22:05:00Z'
  }
  '{malformed-json' | Set-Content (Join-Path $global:HarnessApp 'config.json')
  # Malformed JSON may terminate the script safely. The invariant is no shutdown, not a
  # particular diagnostic/error style across Windows PowerShell 5.1 and PowerShell 7.
  try { Run } catch { $global:HarnessEffects.invalidConfigError = $_.Exception.Message }
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 0 'Invalid config must not warn'
}
Test 'legacy-abort-paused-tag-remains-compatible' {
  $target = [datetimeoffset]::Parse('2026-11-05T23:00:00+01:00')
  State @{ paused = $target.ToLocalTime().ToString('yyyyMMddHHmm'); down = $target.ToString('o') }
  $global:HarnessOnline = New-Command
  Run; Run '2026-11-05T22:05:00Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 0 'Legacy per-target abort still respected'
}
Test 'expired-current-day-cache-does-not-shut-down' {
  Cache (New-Command -Until '2026-11-05T21:59:00Z')
  Run; Run '2026-11-05T22:05:00Z'
  No-Shutdown
}
Test 'online-schedule-warns-at-15-and-5-without-shutdown' {
  $global:HarnessOnline = New-Command
  Run '2026-11-05T21:46:00Z'; Run '2026-11-05T21:47:00Z'; Run '2026-11-05T21:56:00Z'; Run '2026-11-05T21:57:00Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 2 'Each warning appears once'
}
Test 'grace-period-must-last-five-minutes-even-if-trigger-runs-again-immediately' {
  $global:HarnessOnline = New-Command
  Run
  No-Shutdown
  Run '2026-11-05T22:00:01Z'
  No-Shutdown
}
Test 'non-iso-timestamp-command-must-not-trigger-shutdown' {
  foreach ($value in @('11/05/2026 23:00:00 +01:00', '2026-11-05T23:00:00', '2026-11-05')) {
    $global:HarnessOnline = New-Command -Stop $value
    Run; Run '2026-11-05T22:05:00Z'
    Cache $global:HarnessOnline
    $global:HarnessOnline = $null
    Run; Run '2026-11-05T22:05:00Z'
  }
  foreach ($value in @('11/06/2026 04:00:00 +01:00', '2026-11-06T04:00:00', 'tomorrow')) {
    $global:HarnessOnline = New-Command -Until $value
    Run; Run '2026-11-05T22:05:00Z'
    Cache $global:HarnessOnline
    $global:HarnessOnline = $null
    Run; Run '2026-11-05T22:05:00Z'
  }
  No-Shutdown
}
Test 'pause-resume-clears-warning-time-and-restarts-full-grace' {
  $global:HarnessOnline = New-Command
  Run
  Assert ((Read-State).PSObject.Properties['downAt']) 'First due run stores warning time'
  $global:HarnessOnline = New-Command -Mode 'paused'
  Run '2026-11-05T22:03:00Z'
  Assert (-not (Read-State).PSObject.Properties['downAt']) 'Pause clears warning time'
  $global:HarnessOnline = New-Command
  Run '2026-11-05T22:04:00Z'; Run '2026-11-05T22:08:59Z'
  No-Shutdown
  Run '2026-11-05T22:09:00Z'
  Same $global:HarnessEffects.shutdown.Count 1 'Five minutes after resume warning required'
  Same $global:HarnessEffects.toasts.Count 2 'Resume warns again'
}
Test 'legacy-down-marker-without-time-starts-new-grace' {
  $global:HarnessOnline = New-Command
  State @{ down = ([datetimeoffset]::Parse($global:HarnessOnline.stopAt)).ToString('o') }
  Run '2026-11-05T22:04:00Z'; Run '2026-11-05T22:08:59Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 1 'Legacy marker must warn again'
  Run '2026-11-05T22:09:00Z'
  Same $global:HarnessEffects.shutdown.Count 1 'Legacy marker waits five fresh minutes'
}
Test 'clock-rollback-restarts-grace-instead-of-using-future-warning-time' {
  $global:HarnessOnline = New-Command
  Run '2026-11-05T22:05:00Z'; Run '2026-11-05T22:00:00Z'; Run '2026-11-05T22:04:59Z'
  No-Shutdown
  Same $global:HarnessEffects.toasts.Count 2 'Rollback starts fresh warning'
  Run '2026-11-05T22:05:00Z'
  Same $global:HarnessEffects.shutdown.Count 1 'Rollback needs five minutes after fresh warning'
}
Test 'valid-current-day-json-cache-works-with-deserialized-iso-dates' {
  Cache (New-Command)
  Run
  No-Shutdown
  Run '2026-11-05T22:05:00Z'
  Same $global:HarnessEffects.shutdown.Count 1 'Valid cached timestamps and persisted warning remain usable'
}

$report = [ordered]@{
  runtime = $PSVersionTable.PSVersion.ToString(); platform = $PSVersionTable.Platform
  evidenceBoundary = 'PowerShell Linux parser and isolated business-logic harness only. No Windows Scheduler, WinRT toast delivery, real shutdown, endpoint or user path was used.'
  sourceManifest = Get-Content (Join-Path $EvidenceDir 'source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  transformations = @('clock-only UTC now seam', 'Show-Toast AST-body replaced with recorder', 'Invoke-RestMethod and shutdown.exe functions shadow real commands')
  parser = $parsers; tests = $results
}
$report | ConvertTo-Json -Depth 14 | Set-Content (Join-Path $EvidenceDir 'results.json') -Encoding UTF8
$failed = @($results | Where-Object status -eq 'failed').Count
Write-Host "$($results.Count - $failed)/$($results.Count) cases passed; 4 exported scripts parsed"
if ($failed) { exit 1 }
