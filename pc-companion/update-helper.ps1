# Trusted installed helper. No elevation, forced process termination or policy change.
[CmdletBinding()]
param(
    [string]$StageRoot,
    [int]$CurrentProcessId,
    [string]$CurrentStartFileTime,
    [string]$CurrentExecutable,
    [string]$HandoffToken
)
$ErrorActionPreference = 'Stop'

function Test-AnkerUpdateWindows { return [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT }

function Assert-AnkerUpdatePath([string]$Path, [switch]$AllowMissing) {
    $ankerCandidate = [IO.Path]::GetFullPath($Path)
    while ($ankerCandidate) {
        if (Test-Path -LiteralPath $ankerCandidate) {
            $ankerItem = Get-Item -LiteralPath $ankerCandidate -Force -ErrorAction Stop
            if ($ankerItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'path-unsafe' }
        } elseif (-not $AllowMissing) { throw 'path-unsafe' }
        $ankerParent = Split-Path -Path $ankerCandidate -Parent
        if ($ankerParent -eq $ankerCandidate) { break }
        $ankerCandidate = $ankerParent
    }
}

function Write-AnkerUpdateJson([string]$Path, $Value) {
    Assert-AnkerUpdatePath $Path -AllowMissing
    $ankerBytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Compress -Depth 5))
    $ankerStream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $ankerStream.Write($ankerBytes, 0, $ankerBytes.Length); $ankerStream.Flush($true) }
    finally { $ankerStream.Dispose() }
}

function Assert-AnkerUpdateTargets([string]$App) {
    Assert-AnkerUpdatePath $App
    $ankerFolders = [Collections.Generic.Stack[string]]::new()
    $ankerFolders.Push($App)
    while ($ankerFolders.Count) {
        $ankerFolder = $ankerFolders.Pop()
        Assert-AnkerUpdatePath $ankerFolder
        # Enumerate one level at a time. Never recurse into a junction first and
        # discover afterwards that copying/pip could have touched external data.
        foreach ($ankerItem in Get-ChildItem -LiteralPath $ankerFolder -Force -ErrorAction Stop) {
            Assert-AnkerUpdatePath $ankerItem.FullName
            if ($ankerItem.LinkType -eq 'HardLink') { throw 'path-unsafe' }
            if ($ankerItem.PSIsContainer) { $ankerFolders.Push($ankerItem.FullName) }
        }
    }
}

function Assert-AnkerUpdateStage([string]$App, [string]$Stage) {
    # -I ignores user site, PYTHONPATH and the staged working directory. Only the
    # already installed trusted module verifies B4, archive and every staged byte.
    $ankerPython = Join-Path $App '.venv/Scripts/python.exe'
    Assert-AnkerUpdatePath $ankerPython
    Assert-AnkerUpdatePath (Join-Path $App 'anker_companion/updater.py')
    $ankerVerifier = @'
import json, sys
sys.path.insert(0, sys.argv[1])
try:
    from anker_companion.updater import verify_staged_install
    result = verify_staged_install(sys.argv[2])
    print(json.dumps(result, separators=(',', ':')))
except Exception:
    print(json.dumps({'status': 'unavailable'}))
    sys.exit(2)
'@
    $ankerOutput = @(& $ankerPython -I -c $ankerVerifier $App $Stage 2>$null)
    if ($LASTEXITCODE -ne 0 -or $ankerOutput.Count -ne 1) { throw 'stage-invalid' }
    try { $ankerResult = $ankerOutput[0] | ConvertFrom-Json }
    catch { throw 'stage-invalid' }
    if ($ankerResult.status -cne 'verified' -or $ankerResult.version -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') { throw 'stage-invalid' }
    return [string]$ankerResult.version
}

function Get-AnkerUpdateParent([int]$Identifier, [string]$Started, [string]$Executable) {
    try {
        $ankerProcess = [Diagnostics.Process]::GetProcessById($Identifier)
        # Force opening and retain the exact process handle, preventing PID reuse
        # from turning this into a wait for a different future process.
        $null = $ankerProcess.Handle
        if ($ankerProcess.StartTime.ToFileTimeUtc().ToString([Globalization.CultureInfo]::InvariantCulture) -cne $Started -or
            [IO.Path]::GetFullPath($ankerProcess.MainModule.FileName) -ine [IO.Path]::GetFullPath($Executable)) { throw 'process-mismatch' }
        return $ankerProcess
    } catch { throw 'process-mismatch' }
}

function Wait-AnkerUpdateParent($Process, [string]$CancelPath) {
    $ankerTimer = [Diagnostics.Stopwatch]::StartNew()
    while ($ankerTimer.Elapsed.TotalSeconds -lt 30) {
        if (Test-Path -LiteralPath $CancelPath) { throw 'cancelled' }
        if ($Process.WaitForExit(100)) {
            if (Test-Path -LiteralPath $CancelPath) { throw 'cancelled' }
            return
        }
    }
    throw 'process-timeout'
}

function Invoke-AnkerUpdateInstall([string]$Stage, [string]$App) {
    Assert-AnkerUpdatePath (Join-Path $Stage 'package/install.ps1')
    & (Join-Path $Stage 'package/install.ps1') -NoAutostart | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'install-failed' }
    Assert-AnkerUpdatePath (Join-Path $App 'Start.cmd')
    & (Join-Path $App 'Start.cmd') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'restart-unconfirmed' }
}

function Start-AnkerUpdate {
    $ankerReason = 'handoff-unavailable'
    $ankerUpdates = $null
    $ankerVersion = $null
    $ankerParentProcess = $null
    try {
        if (-not (Test-AnkerUpdateWindows) -or
            $CurrentProcessId -le 0 -or $CurrentStartFileTime -notmatch '^[0-9]{1,20}$' -or $HandoffToken -notmatch '^[a-f0-9]{32}$' -or
            [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'handoff-unavailable' }
        $ankerBase = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'AnkerPcCompanion'))
        $ankerUpdates = Join-Path $ankerBase 'updates'
        $ankerApp = Join-Path $ankerBase 'app'
        $ankerScripts = [IO.Path]::GetFullPath((Join-Path $ankerApp '.venv/Scripts')).TrimEnd('\', '/')
        $ankerStage = [IO.Path]::GetFullPath($StageRoot)
        $ankerStageId = Split-Path -Path $ankerStage -Leaf
        if ((Split-Path -Path $ankerStage -Parent) -ine $ankerUpdates -or $ankerStageId -notmatch '^stage-[a-f0-9]{32}$' -or
            [IO.Path]::GetFullPath($PSScriptRoot) -ine $ankerApp -or
            [IO.Path]::GetFullPath($CurrentExecutable) -inotmatch ('^' + [regex]::Escape($ankerScripts) + '[\\/]pythonw?\.exe$')) { throw 'path-unsafe' }
        Assert-AnkerUpdatePath $ankerStage
        Assert-AnkerUpdatePath $CurrentExecutable
        Assert-AnkerUpdateTargets $ankerApp
        $ankerParentProcess = Get-AnkerUpdateParent $CurrentProcessId $CurrentStartFileTime $CurrentExecutable
        $ankerVersion = Assert-AnkerUpdateStage $ankerApp $ankerStage
        $ankerCancel = Join-Path $ankerUpdates ('cancel-' + $HandoffToken + '.json')
        if (Test-Path -LiteralPath $ankerCancel) { throw 'cancelled' }
        Write-AnkerUpdateJson (Join-Path $ankerUpdates ('handoff-' + $HandoffToken + '.json')) ([ordered]@{
            status = 'ready'; stageId = $ankerStageId; processId = $CurrentProcessId; helperPid = $PID; startFileTime = $CurrentStartFileTime; token = $HandoffToken
        })
        Wait-AnkerUpdateParent $ankerParentProcess $ankerCancel
        # Reverify after waiting and immediately before any staged program runs.
        Assert-AnkerUpdateTargets $ankerApp
        $null = Assert-AnkerUpdateStage $ankerApp $ankerStage
        if (Test-Path -LiteralPath $ankerCancel) { throw 'cancelled' }
        $null = Invoke-AnkerUpdateInstall $ankerStage $ankerApp
        $ankerReason = 'installed-restart-requested'
    } catch {
        $ankerKnown = @('handoff-unavailable', 'path-unsafe', 'process-mismatch', 'process-timeout', 'cancelled', 'stage-invalid', 'install-failed', 'restart-unconfirmed')
        $ankerReason = if ($_.Exception.Message -cin $ankerKnown) { $_.Exception.Message } else { 'handoff-unavailable' }
    } finally {
        if ($null -ne $ankerParentProcess) { $ankerParentProcess.Dispose() }
        # Never recreate a data directory removed by a separately confirmed reset.
        if ($ankerUpdates -and (Test-Path -LiteralPath $ankerUpdates -PathType Container) -and $HandoffToken -match '^[a-f0-9]{32}$') {
            try {
                $ankerTemp = Join-Path $ankerUpdates ('install-result-' + $HandoffToken + '.tmp')
                $ankerResult = Join-Path $ankerUpdates 'install-result.json'
                Write-AnkerUpdateJson $ankerTemp ([ordered]@{ status = $ankerReason; version = $ankerVersion })
                Assert-AnkerUpdatePath $ankerResult -AllowMissing
                Move-Item -LiteralPath $ankerTemp -Destination $ankerResult -Force
            } catch { }
        }
    }
    return $ankerReason -ceq 'installed-restart-requested'
}

if ($MyInvocation.InvocationName -ne '.') {
    if (Start-AnkerUpdate) { exit 0 } else { exit 2 }
}
