param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference = 'Stop'
# Execute the actual installer functions, never its platform entry point. All
# Python, Task Scheduler and process boundaries below are explicit mocks.
$ankerParseErrors = $null; $ankerTokens = $null
$ankerAst = [Management.Automation.Language.Parser]::ParseFile((Join-Path $Source 'install.ps1'), [ref]$ankerTokens, [ref]$ankerParseErrors)
if ($ankerParseErrors.Count) { throw ('Installer parse error: ' + $ankerParseErrors[0]) }
$ankerFunctions = $ankerAst.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]}, $false)
foreach ($ankerFunction in $ankerFunctions) { Invoke-Expression $ankerFunction.Extent.Text }
$ankerGetPythonFunction = (Get-Item Function:Get-AnkerPython).ScriptBlock
$ankerRoot = Join-Path ([IO.Path]::GetTempPath()) ('anker-installer-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $ankerRoot | Out-Null
$ankerOldLocal = $env:LOCALAPPDATA
$env:LOCALAPPDATA = Join-Path $ankerRoot 'local'
$script:ankerCalls = @(); $script:ankerRunning = $false; $script:ankerMissingPython = $false; $script:ankerPipFails = $false
function Assert-True($Value, [string]$Message) { if (-not $Value) { throw $Message } }
function Assert-Rejected([scriptblock]$Action, [string]$Expected) {
    try { & $Action } catch { if ($_.Exception.Message -like ('*' + $Expected + '*')) { return }; throw }
    throw ('Expected rejection: ' + $Expected)
}
function Assert-AnkerNotRunning { if ($script:ankerRunning) { throw 'fixture-running' } }
function Get-AnkerPython { if ($script:ankerMissingPython) { throw 'fixture-python' }; return 'fixture-python.exe' }
function Invoke-AnkerPython([string]$Executable, [string[]]$AnkerArguments) {
    $script:ankerCalls += ,@($Executable, $AnkerArguments)
    if ($AnkerArguments -contains 'venv') {
        $ankerScripts = Join-Path $AnkerArguments[-1] 'Scripts'
        New-Item -ItemType Directory -Force -Path $ankerScripts | Out-Null
        [IO.File]::WriteAllBytes((Join-Path $ankerScripts 'python.exe'), [byte[]]@())
        [IO.File]::WriteAllBytes((Join-Path $ankerScripts 'pythonw.exe'), [byte[]]@())
    }
    if ($script:ankerPipFails -and $AnkerArguments -contains 'pip') { throw 'fixture-pip' }
}
function Get-AnkerUserId { return 'FIXTURE\SyntheticUser' }
function New-ScheduledTaskAction { param($Execute,$Argument,$WorkingDirectory) return @{Execute=$Execute; Argument=$Argument; WorkingDirectory=$WorkingDirectory} }
function New-ScheduledTaskTrigger { param([switch]$AtLogOn,$User) return @{User=$User} }
function New-ScheduledTaskPrincipal { param($UserId,$LogonType,$RunLevel) return @{UserId=$UserId; LogonType=$LogonType; RunLevel=$RunLevel} }
function New-ScheduledTaskSettingsSet { param([switch]$AllowStartIfOnBatteries,[switch]$DontStopIfGoingOnBatteries,$MultipleInstances) return @{} }
function Register-ScheduledTask {
    param($TaskName,$Action,$Trigger,$Principal,$Settings,[switch]$Force)
    Assert-True ($Principal.RunLevel -eq 'Limited' -and $Principal.UserId -eq 'FIXTURE\SyntheticUser') 'Unexpected elevated task'
    $script:ankerTask = $TaskName
}
function Fresh-Package([string]$Name) {
    $ankerPath = Join-Path $ankerRoot $Name
    New-Item -ItemType Directory -Path $ankerPath | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $ankerPath -Recurse
    return $ankerPath
}
function Change-Manifest([string]$Path, [scriptblock]$Change) {
    $ankerManifestPath = Join-Path $Path 'package-manifest.json'
    $ankerManifest = Get-Content -LiteralPath $ankerManifestPath -Raw | ConvertFrom-Json
    & $Change $ankerManifest
    [IO.File]::WriteAllText($ankerManifestPath, ($ankerManifest | ConvertTo-Json -Depth 8))
}
try {
    $ankerValid = Assert-AnkerSourceManifest $Source
    Assert-True ($ankerValid.protocolVersion -eq 3 -and $ankerValid.files.Count -eq 22) 'Manifest validation failed'
    $ankerTarget = Join-Path $env:LOCALAPPDATA 'AnkerPcCompanion/app'
    $ankerParent = Split-Path $ankerTarget -Parent
    New-Item -ItemType Directory -Force -Path $ankerParent | Out-Null
    $ankerState = Join-Path $ankerParent 'companion.state'
    [IO.File]::WriteAllBytes($ankerState, [byte[]]@(7,0,255,17,99))
    $ankerStateHash = (Get-FileHash -LiteralPath $ankerState).Hash

    # Real file links exercise the production target guard before compatibility
    # reads/Python/pip. Symlinks may need Windows Developer Mode; hard links do not.
    $ankerLinkPassed = 0; $ankerLinkSkipped = 0
    foreach ($ankerCase in @(
        @{ Name = 'hardlink-payload'; Kind = 'HardLink'; Relative = 'Start.cmd'; Directory = $false },
        @{ Name = 'hardlink-manifest'; Kind = 'HardLink'; Relative = 'package-manifest.json'; Directory = $false },
        @{ Name = 'hardlink-python'; Kind = 'HardLink'; Relative = '.venv/Scripts/python.exe'; Directory = $false },
        @{ Name = 'symlink-payload'; Kind = 'SymbolicLink'; Relative = 'README.md'; Directory = $false },
        @{ Name = 'symlink-parent'; Kind = 'SymbolicLink'; Relative = 'anker_companion'; Directory = $true },
        @{ Name = 'symlink-venv'; Kind = 'SymbolicLink'; Relative = '.venv'; Directory = $true }
    )) {
        $ankerLinkRoot = Join-Path $ankerRoot $ankerCase.Name
        $ankerLinkTarget = Join-Path $ankerLinkRoot 'app'
        $ankerOutside = Join-Path $ankerLinkRoot 'outside'
        New-Item -ItemType Directory -Path $ankerLinkTarget -Force | Out-Null
        if ($ankerCase.Directory) {
            New-Item -ItemType Directory -Path $ankerOutside | Out-Null
            $ankerOutsideFile = Join-Path $ankerOutside 'sentinel.txt'
        } else { $ankerOutsideFile = $ankerOutside }
        [IO.File]::WriteAllText($ankerOutsideFile, 'synthetic-outside-preserved')
        $ankerOutsideHash = (Get-FileHash -LiteralPath $ankerOutsideFile).Hash
        $ankerLinkPath = Join-Path $ankerLinkTarget $ankerCase.Relative
        New-Item -ItemType Directory -Path (Split-Path $ankerLinkPath -Parent) -Force | Out-Null
        try { New-Item -ItemType $ankerCase.Kind -Path $ankerLinkPath -Target $ankerOutside -ErrorAction Stop | Out-Null }
        catch {
            if ($ankerCase.Kind -eq 'SymbolicLink' -and [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
                $ankerLinkSkipped++
                Write-Warning ('SKIPPED real symlink fixture (Windows link creation unavailable): ' + $ankerCase.Name)
                continue
            }
            throw
        }
        if ($ankerCase.Kind -eq 'HardLink') {
            Assert-True ((Get-Item -LiteralPath $ankerLinkPath -Force).LinkType -eq 'HardLink') 'Hardlink fixture did not create a detected hard link'
        }
        $ankerCallsBeforeLink = $script:ankerCalls.Count
        $ankerTaskBeforeLink = $script:ankerTask
        Assert-Rejected { Install-AnkerProgram $Source $ankerLinkTarget } 'verknuepft'
        if ($ankerCase.Name -eq 'hardlink-manifest') {
            Assert-Rejected { Install-AnkerProgram $ankerLinkTarget $ankerLinkTarget } 'verknuepft'
        }
        Assert-True ($script:ankerCalls.Count -eq $ankerCallsBeforeLink) ('Unsafe target reached Python: ' + $ankerCase.Name)
        Assert-True ($script:ankerTask -eq $ankerTaskBeforeLink) 'Unsafe target changed autostart'
        Assert-True ((Get-FileHash -LiteralPath $ankerOutsideFile).Hash -eq $ankerOutsideHash) 'Linked external file changed'
        Assert-True ((Get-FileHash -LiteralPath $ankerState).Hash -eq $ankerStateHash) 'Linked target changed encrypted state'
        $ankerLinkPassed++
    }
    Assert-True ($ankerLinkPassed -ge 3 -and $ankerLinkPassed + $ankerLinkSkipped -eq 6) 'Mandatory hardlink fixtures did not complete'
    Write-Host ('Real target links: ' + $ankerLinkPassed + ' passed; ' + $ankerLinkSkipped + ' explicitly skipped symlink fixtures.')

    # A link introduced AFTER the batch preflight must also be rejected before
    # that individual Copy-Item. Only the first unrelated payload may be copied.
    $script:ankerRaceTarget = Join-Path $ankerRoot 'late-copy-link/app'
    $script:ankerRaceOutside = Join-Path $ankerRoot 'late-copy-link/outside.txt'
    New-Item -ItemType Directory -Path (Split-Path $script:ankerRaceOutside -Parent) -Force | Out-Null
    [IO.File]::WriteAllText($script:ankerRaceOutside, 'synthetic-late-outside-preserved')
    $ankerLateOutsideHash = (Get-FileHash -LiteralPath $script:ankerRaceOutside).Hash
    $ankerTaskBeforeRace = $script:ankerTask
    function Copy-Item {
        param($LiteralPath, $Destination, [switch]$Force)
        Microsoft.PowerShell.Management\Copy-Item -LiteralPath $LiteralPath -Destination $Destination -Force:$Force
        if ((Split-Path -Path $LiteralPath -Leaf) -ceq 'Einrichten.cmd') {
            New-Item -ItemType HardLink -Path (Join-Path $script:ankerRaceTarget 'Start.cmd') -Target $script:ankerRaceOutside | Out-Null
        }
    }
    try {
        Assert-Rejected { Install-AnkerProgram $Source $script:ankerRaceTarget } 'verknuepft'
        Assert-True ((Get-FileHash -LiteralPath $script:ankerRaceOutside).Hash -eq $ankerLateOutsideHash) 'Late link redirected a payload write'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $script:ankerRaceTarget 'install.ps1'))) 'Installer continued after late linked target'
        Assert-True ($script:ankerTask -eq $ankerTaskBeforeRace) 'Late linked target changed autostart'
        Assert-True ((Get-FileHash -LiteralPath $ankerState).Hash -eq $ankerStateHash) 'Late linked target changed encrypted state'
    } finally { Remove-Item Function:Copy-Item }
    # The late-link fixture intentionally reached mocked Python; subsequent
    # independent preflight fixtures start with their own empty call history.
    $script:ankerCalls = @()

    $ankerBad = Fresh-Package 'tampered'
    Add-Content -LiteralPath (Join-Path $ankerBad 'anker_companion/engine.py') -Value '# tampered'
    Assert-Rejected { Install-AnkerProgram $ankerBad $ankerTarget -SkipAutostart } 'Dateipruefung'
    Assert-True (-not (Test-Path $ankerTarget) -and $script:ankerCalls.Count -eq 0) 'Tampered source caused installation effects'

    foreach ($ankerKind in @('traversal', 'duplicate', 'string-schema', 'extra-code', 'missing')) {
        $ankerBad = Fresh-Package $ankerKind
        switch ($ankerKind) {
            'traversal' { Change-Manifest $ankerBad {param($m) $m.files[0].path = '../outside.cmd'} }
            'duplicate' { Change-Manifest $ankerBad {param($m) $m.files[0].path = $m.files[1].path} }
            'string-schema' { Change-Manifest $ankerBad {param($m) $m.schemaVersion = '1'} }
            'extra-code' { [IO.File]::WriteAllText((Join-Path $ankerBad 'evil.py'), 'raise Exception()') }
            'missing' { Remove-Item -LiteralPath (Join-Path $ankerBad 'package-manifest.json') }
        }
        $ankerRejected = $false
        try { Assert-AnkerSourceManifest $ankerBad | Out-Null } catch { $ankerRejected = $true }
        Assert-True $ankerRejected ('Package accepted: ' + $ankerKind)
    }
    $script:ankerRunning = $true
    Assert-Rejected { Install-AnkerProgram $Source $ankerTarget -SkipAutostart } 'fixture-running'
    $script:ankerRunning = $false; $script:ankerMissingPython = $true
    Assert-Rejected { Install-AnkerProgram $Source $ankerTarget -SkipAutostart } 'fixture-python'
    Assert-True (-not (Test-Path $ankerTarget) -and $script:ankerCalls.Count -eq 0) 'Preflight modified app'
    $script:ankerMissingPython = $false; $script:ankerPipFails = $true
    Assert-Rejected { Install-AnkerProgram $Source $ankerTarget -SkipAutostart } 'fixture-pip'
    Assert-True (-not (Test-Path (Join-Path $ankerTarget 'anker_companion/engine.py'))) 'Pip failure replaced runtime'
    $script:ankerPipFails = $false
    Install-AnkerProgram $Source $ankerTarget
    Assert-True ($script:ankerTask -eq 'Anker PC-Begleiter') 'User task not prepared'
    foreach ($ankerFile in Get-AnkerPayloadFiles) {
        Assert-True ((Get-FileHash (Join-Path $Source $ankerFile)).Hash -eq (Get-FileHash (Join-Path $ankerTarget $ankerFile)).Hash) ('Copy mismatch: ' + $ankerFile)
    }
    Assert-True ((Get-FileHash -LiteralPath $ankerState).Hash -eq $ankerStateHash) 'Encrypted state changed'
    # Re-running the installed setup is safe despite its own isolated .venv.
    $ankerBytecode = Join-Path $ankerTarget 'anker_companion/__pycache__'
    New-Item -ItemType Directory -Path $ankerBytecode | Out-Null
    [IO.File]::WriteAllText((Join-Path $ankerBytecode 'engine.cpython-312.pyc'), 'synthetic-bytecode')
    Install-AnkerProgram $ankerTarget $ankerTarget -SkipAutostart
    Assert-True (-not (Test-Path -LiteralPath $ankerBytecode)) 'Repair retained stale bytecode'
    Assert-True ((Get-FileHash -LiteralPath $ankerState).Hash -eq $ankerStateHash) 'Repair changed state'
    $ankerBefore = (Get-FileHash (Join-Path $ankerTarget 'anker_companion/engine.py')).Hash
    Change-Manifest $ankerTarget {param($m) $m.stateSchemaVersion = 2}
    $ankerBeforeCalls = $script:ankerCalls.Count
    Assert-Rejected { Install-AnkerProgram $Source $ankerTarget -SkipAutostart } 'anderes Protokoll oder Datenformat'
    Assert-True ($script:ankerCalls.Count -eq $ankerBeforeCalls -and (Get-FileHash (Join-Path $ankerTarget 'anker_companion/engine.py')).Hash -eq $ankerBefore) 'Incompatible update changed runtime'
    Assert-True ((Get-FileHash -LiteralPath $ankerState).Hash -eq $ankerStateHash) 'Rejected update changed state'

    # Real discovery function, mocked external command with exactly one output
    # line: PS5.1 must preserve the full path rather than take its last character.
    $ankerProbe = Join-Path $ankerRoot 'python-probe.ps1'
    $script:ankerProbePython = Join-Path $ankerTarget '.venv/Scripts/python.exe'
    $global:ankerTestProbePython = $script:ankerProbePython
    [IO.File]::WriteAllText($ankerProbe, '$global:LASTEXITCODE = 0; Write-Output $global:ankerTestProbePython')
    $script:ankerProbeCommand = $ankerProbe
    function Get-Command { param($Name,$CommandType,$ErrorAction) return [pscustomobject]@{Source=$script:ankerProbeCommand} }
    Set-Item Function:Get-AnkerPython $ankerGetPythonFunction
    Assert-True ((Get-AnkerPython) -ceq $script:ankerProbePython) 'Python discovery truncated its path'
    Write-Host 'Installer: manifest/tamper/traversal/duplicates/types/extra/missing, running/Python/pip gates, safe copy/repair/task, schema and state preservation, single-line Python discovery, real hardlink/symlink targets and per-copy late-link guard passed. No system actions.'
} finally {
    Remove-Variable -Name ankerTestProbePython -Scope Global -ErrorAction SilentlyContinue
    $env:LOCALAPPDATA = $ankerOldLocal
    Remove-Item -LiteralPath $ankerRoot -Recurse -Force
}
