# User-level source installation. No firewall changes or Windows lock/shutdown.
param([switch]$NoAutostart)
$ErrorActionPreference = 'Stop'

function Get-AnkerPayloadFiles {
    return @('Einrichten.cmd', 'Start.cmd', 'install.ps1', 'uninstall.ps1', 'requirements.txt', 'README.md', 'PROTOCOL.md',
        'anker_companion/__init__.py', 'anker_companion/__main__.py', 'anker_companion/engine.py',
        'anker_companion/protocol.py', 'anker_companion/server.py', 'anker_companion/storage.py',
        'anker_companion/ui.py', 'anker_companion/vault.py', 'anker_companion/windows.py')
}

function Assert-AnkerSourceManifest([string]$Source) {
    $ankerManifestPath = Join-Path $Source 'package-manifest.json'
    if (-not (Test-Path -LiteralPath $ankerManifestPath -PathType Leaf)) {
        if (-not (Test-Path -LiteralPath (Join-Path (Split-Path $Source -Parent) '.git'))) {
            throw 'Paketmanifest fehlt. Das offizielle ZIP erneut herunterladen und vollstaendig entpacken.'
        }
        return [pscustomobject]@{ protocolVersion = 3; stateSchemaVersion = 1; version = '0.1.0'; sourceCheckout = $true }
    }
    $ankerManifest = Get-Content -LiteralPath $ankerManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not ($ankerManifest.schemaVersion -is [int] -or $ankerManifest.schemaVersion -is [long]) -or
        -not ($ankerManifest.protocolVersion -is [int] -or $ankerManifest.protocolVersion -is [long]) -or
        -not ($ankerManifest.stateSchemaVersion -is [int] -or $ankerManifest.stateSchemaVersion -is [long]) -or
        $ankerManifest.schemaVersion -ne 1 -or $ankerManifest.artifact -cne 'anker-pc-companion-source' -or
        $ankerManifest.protocolVersion -ne 3 -or $ankerManifest.stateSchemaVersion -ne 1 -or
        $ankerManifest.version -notmatch '^\d+\.\d+\.\d+$' -or $ankerManifest.sourceCommit -notmatch '^[a-f0-9]{40}$') {
        throw 'Paketversion oder Protokoll passt nicht zu dieser Einrichtung. Nichts wurde ersetzt.'
    }
    $ankerRequired = @(Get-AnkerPayloadFiles | Sort-Object)
    $ankerFound = @($ankerManifest.files | ForEach-Object { $_.path } | Sort-Object)
    if ($ankerFound.Count -ne $ankerRequired.Count -or @(Compare-Object $ankerRequired $ankerFound -CaseSensitive).Count -ne 0) {
        throw 'Paketdateien sind unvollstaendig, doppelt oder unerwartet. Nichts wurde ersetzt.'
    }
    foreach ($ankerEntry in $ankerManifest.files) {
        if ($ankerEntry.sha256 -notmatch '^[a-f0-9]{64}$' -or
            -not (($ankerEntry.bytes -is [int]) -or ($ankerEntry.bytes -is [long])) -or $ankerEntry.bytes -lt 0) {
            throw 'Ungueltiger Dateinachweis im Paket.'
        }
        $ankerPath = Join-Path $Source $ankerEntry.path
        $ankerItem = Get-Item -LiteralPath $ankerPath -ErrorAction Stop
        $ankerParent = Get-Item -LiteralPath (Split-Path $ankerPath -Parent) -ErrorAction Stop
        if ($ankerItem.PSIsContainer -or ($ankerItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            ($ankerParent.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $ankerItem.Length -ne $ankerEntry.bytes -or
            (Get-FileHash -LiteralPath $ankerPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ankerEntry.sha256) {
            throw ('Dateipruefung fehlgeschlagen: ' + $ankerEntry.path + '. Paket erneut herunterladen; nichts wurde ersetzt.')
        }
    }
    foreach ($ankerFile in Get-ChildItem -LiteralPath $Source -Recurse -File) {
        $ankerRelative = $ankerFile.FullName.Substring($Source.TrimEnd('\', '/').Length + 1).Replace('\', '/')
        # An installed repair may retain its own isolated runtime. Downloaded
        # packages never bundle or execute a second Python runtime.
        $ankerInstalled = Join-Path $env:LOCALAPPDATA 'AnkerPcCompanion/app'
        if ([IO.Path]::GetFullPath($Source).TrimEnd('\', '/') -ieq [IO.Path]::GetFullPath($ankerInstalled).TrimEnd('\', '/') -and
            ($ankerRelative.StartsWith('.venv/') -or $ankerRelative -match '^anker_companion/__pycache__/[^/]+\.pyc$')) { continue }
        if ($ankerFile.Extension -in @('.py', '.pyc', '.pyd', '.dll', '.exe', '.ps1', '.cmd') -and $ankerRelative -cnotin $ankerRequired) {
            throw 'Das entpackte Paket enthaelt fremde Programmdateien. Einen neuen leeren Zielordner verwenden.'
        }
    }
    return $ankerManifest
}

function Assert-AnkerInstalledCompatibility([string]$Target, $Incoming) {
    $ankerPrevious = Join-Path $Target 'package-manifest.json'
    if (Test-Path -LiteralPath $ankerPrevious -PathType Leaf) {
        $ankerOld = Get-Content -LiteralPath $ankerPrevious -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($ankerOld.protocolVersion -ne $Incoming.protocolVersion -or $ankerOld.stateSchemaVersion -ne $Incoming.stateSchemaVersion) {
            throw 'Die vorhandene Installation nutzt ein anderes Protokoll oder Datenformat. Daten bleiben erhalten; kein automatischer Austausch.'
        }
    } elseif (Test-Path -LiteralPath (Join-Path $Target 'anker_companion/__init__.py') -PathType Leaf) {
        $ankerOldVersion = Get-Content -LiteralPath (Join-Path $Target 'anker_companion/__init__.py') -Raw
        if ($ankerOldVersion -notmatch '__version__\s*=\s*["'']0\.1\.0["'']') {
            throw 'Die bisherige Quellinstallation ist nicht zugeordnet. Nichts wurde ersetzt oder geloescht.'
        }
    }
}

function Assert-AnkerNotRunning {
    $ankerMutex = $null
    try { $ankerRunning = [Threading.Mutex]::TryOpenExisting('Local\AnkerPcCompanion-v3', [ref]$ankerMutex) }
    catch { throw 'Der laufende Begleiter konnte nicht sicher geprueft werden. Zuerst im Fenster oder Tray Beenden waehlen.' }
    finally { if ($null -ne $ankerMutex) { $ankerMutex.Dispose() } }
    if ($ankerRunning) { throw 'Anker PC-Begleiter laeuft noch. Im Fenster oder Tray Beenden waehlen und Einrichten.cmd erneut starten.' }
}

function Get-AnkerPython {
    $ankerProbe = 'import sys, tkinter, venv; assert sys.version_info >= (3,11); print(sys.executable)'
    foreach ($ankerCandidate in @(@{ Name = 'py'; Prefix = @('-3') }, @{ Name = 'python'; Prefix = @() })) {
        $ankerCommand = Get-Command $ankerCandidate.Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -eq $ankerCommand) { continue }
        try {
            $ankerPrefix = @($ankerCandidate.Prefix)
            $ankerOutput = @(& $ankerCommand.Source @ankerPrefix -I -c $ankerProbe 2>$null)
            if ($LASTEXITCODE -eq 0 -and $ankerOutput.Count -gt 0 -and (Test-Path -LiteralPath ([string]$ankerOutput[-1]) -PathType Leaf)) {
                return [string]$ankerOutput[-1]
            }
        } catch { }
    }
    throw 'Python 3.11 oder neuer mit Tkinter fehlt. Empfohlen: Python 3.12 von python.org installieren, dann Einrichten.cmd erneut oeffnen.'
}

function Invoke-AnkerPython([string]$Executable, [string[]]$AnkerArguments) {
    & $Executable @AnkerArguments
    if ($LASTEXITCODE -ne 0) { throw 'Python-Einrichtung oder Abhaengigkeiten konnten nicht vollstaendig vorbereitet werden. Meldung oben pruefen und erneut versuchen.' }
}

function Get-AnkerUserId { return [Security.Principal.WindowsIdentity]::GetCurrent().Name }

function Install-AnkerProgram([string]$Source, [string]$Target, [switch]$SkipAutostart) {
    $ankerManifest = Assert-AnkerSourceManifest $Source
    Assert-AnkerInstalledCompatibility $Target $ankerManifest
    Assert-AnkerNotRunning
    $ankerBasePython = Get-AnkerPython
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    $ankerVenv = Join-Path $Target '.venv'
    $ankerPython = Join-Path $ankerVenv 'Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $ankerPython -PathType Leaf)) {
        Invoke-AnkerPython $ankerBasePython @('-I', '-m', 'venv', $ankerVenv)
    }
    Invoke-AnkerPython $ankerPython @('-I', '-c', 'import sys, tkinter; assert sys.version_info >= (3,11)')
    Invoke-AnkerPython $ankerPython @('-I', '-m', 'pip', 'install', '--disable-pip-version-check', '-r', (Join-Path $Source 'requirements.txt'))
    if (-not (Test-Path -LiteralPath (Join-Path $ankerVenv 'Scripts/pythonw.exe') -PathType Leaf)) {
        throw 'Die Python-Desktoplaufzeit fehlt. Python mit Tkinter reparieren und erneut versuchen.'
    }
    if ([IO.Path]::GetFullPath($Source).TrimEnd('\', '/') -ine [IO.Path]::GetFullPath($Target).TrimEnd('\', '/')) {
        foreach ($ankerRelative in Get-AnkerPayloadFiles) {
            $ankerDestination = Join-Path $Target $ankerRelative
            New-Item -ItemType Directory -Force -Path (Split-Path $ankerDestination -Parent) | Out-Null
            Copy-Item -LiteralPath (Join-Path $Source $ankerRelative) -Destination $ankerDestination -Force
        }
        if (Test-Path -LiteralPath (Join-Path $Source 'package-manifest.json') -PathType Leaf) {
            Copy-Item -LiteralPath (Join-Path $Source 'package-manifest.json') -Destination $Target -Force
        }
    }
    # The daemon is stopped. Discard only generated module bytecode, never data
    # or DPAPI material in the parent directory.
    $ankerBytecode = Join-Path $Target 'anker_companion/__pycache__'
    if (Test-Path -LiteralPath $ankerBytecode) {
        if ((Get-Item -LiteralPath $ankerBytecode).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Modulcache ist verknuepft. Programmordner pruefen; Daten bleiben erhalten.' }
        Remove-Item -LiteralPath $ankerBytecode -Recurse -Force
    }
    if (-not $SkipAutostart) {
        $ankerUserId = Get-AnkerUserId
        $ankerAction = New-ScheduledTaskAction -Execute (Join-Path $ankerVenv 'Scripts/pythonw.exe') -Argument '-m anker_companion' -WorkingDirectory $Target
        $ankerTrigger = New-ScheduledTaskTrigger -AtLogOn -User $ankerUserId
        $ankerPrincipal = New-ScheduledTaskPrincipal -UserId $ankerUserId -LogonType Interactive -RunLevel Limited
        $ankerSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName 'Anker PC-Begleiter' -Action $ankerAction -Trigger $ankerTrigger -Principal $ankerPrincipal -Settings $ankerSettings -Force | Out-Null
    }
    Write-Host 'Installiert. Start.cmd aus dem Download- oder Installationsordner oeffnet Anker. Bei der Firewall nur private Netzwerke erlauben.'
    Write-Host $Target
}

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Dieser Installer ist fuer Windows. Die Quellpaketpruefungen laufen separat ohne Systemaktionen.' }
Install-AnkerProgram -Source $PSScriptRoot -Target (Join-Path $env:LOCALAPPDATA 'AnkerPcCompanion/app') -SkipAutostart:$NoAutostart
