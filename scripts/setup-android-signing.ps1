#requires -Version 7.2
[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$Repository = 'frnkrm/anker',
    [string]$KeystorePath = "$env:USERPROFILE\.android\debug.keystore",
    [string]$KeyAlias = 'AndroidDebugKey'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-AnkerPrivateProcess {
    param([string]$Executable, [string[]]$Arguments, [AllowEmptyString()][string]$InputText = '', [hashtable]$ChildEnvironment = @{})
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Executable
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
    foreach ($argument in $Arguments) { [void]$start.ArgumentList.Add($argument) }
    foreach ($name in $ChildEnvironment.Keys) { $start.Environment[$name] = [string]$ChildEnvironment[$name] }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($InputText)
        $process.StandardInput.Close()
        $process.WaitForExit()
        $output = $outputTask.GetAwaiter().GetResult()
        $null = $errorTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Ein lokales Werkzeug konnte den Schritt nicht abschließen. Werkzeugausgaben mit möglichen Secretwerten werden nicht ausgegeben.' }
        return $output
    } finally {
        foreach ($name in $ChildEnvironment.Keys) { $start.Environment.Remove($name) | Out-Null }
        $process.Dispose()
    }
}

function Set-AnkerSigningSecrets {
    param([string]$GhExecutable, [string]$TargetRepository, [string]$KeystoreBase64, [string]$StorePassword, [string]$Alias, [string]$KeyPassword)
    if ($TargetRepository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Ungültiges GitHub-Repository.' }
    if ([string]::IsNullOrEmpty($KeystoreBase64) -or $KeystoreBase64.Length -gt 49152 -or [string]::IsNullOrEmpty($StorePassword) -or [string]::IsNullOrEmpty($Alias) -or [string]::IsNullOrEmpty($KeyPassword)) { throw 'Die vier Signierwerte müssen vollständig sein; das Base64-Secret darf höchstens 48 KiB groß sein.' }
    $values = [ordered]@{
        ANKER_ANDROID_KEYSTORE_BASE64 = $KeystoreBase64
        ANKER_ANDROID_STORE_PASSWORD = $StorePassword
        ANKER_ANDROID_KEY_ALIAS = $Alias
        ANKER_ANDROID_KEY_PASSWORD = $KeyPassword
    }
    try {
        foreach ($name in $values.Keys) {
            # gh verschlüsselt Secrets vor dem API-Upload. Nur stdin enthält den Wert.
            $null = Invoke-AnkerPrivateProcess -Executable $GhExecutable -Arguments @('secret', 'set', $name, '--repo', $TargetRepository) -InputText $values[$name]
        }
    } finally {
        $values.Clear()
    }
}

function Convert-AnkerSecureString {
    param([System.Security.SecureString]$Value)
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

# Tests dürfen die Übergabefunktionen mit ausschließlich künstlichen Werten laden.
if ($MyInvocation.InvocationName -eq '.') { return }

$expectedCertificate = '3f7545f5dd8e4f8a87bef38696fb16284b02a2d783a0f4a35f3b2bd084d3eaad'
$storeSecure = $null
$keySecure = $null
$storeText = $null
$keyText = $null
$keystoreBytes = $null
$encoded = $null
try {
    $gh = (Get-Command gh -CommandType Application -ErrorAction Stop).Source
    $keytool = (Get-Command keytool -CommandType Application -ErrorAction Stop).Source
    $null = Invoke-AnkerPrivateProcess -Executable $gh -Arguments @('auth', 'status')
    if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) { throw 'Der bestehende Keystore wurde nicht gefunden. Es wird kein neuer Schlüssel erzeugt.' }
    Write-Host "Dieses lokal gestartete Skript überträgt eine verschlüsselte Kopie des bestehenden Keystores und drei Signierwerte als GitHub Secrets nach $Repository."
    Write-Host 'Der Schlüssel ist danach zusätzlich bei GitHub gespeichert; er bleibt nicht ausschließlich auf diesem PC.'
    $storeSecure = Read-Host 'Passwort des vorhandenen Keystores (nicht im Chat eingeben)' -AsSecureString
    $keySecure = Read-Host 'Passwort des vorhandenen Schlüssels (kann gleich sein)' -AsSecureString
    $storeText = Convert-AnkerSecureString $storeSecure
    $keyText = Convert-AnkerSecureString $keySecure
    $certificatePem = Invoke-AnkerPrivateProcess -Executable $keytool -Arguments @('-exportcert', '-rfc', '-keystore', $KeystorePath, '-alias', $KeyAlias, '-storepass:env', 'ANKER_SETUP_STORE_PASSWORD') -ChildEnvironment @{ ANKER_SETUP_STORE_PASSWORD = $storeText }
    $match = [regex]::Match($certificatePem, '-----BEGIN CERTIFICATE-----\s*([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----')
    if (-not $match.Success) { throw 'Das öffentliche Schlüsselzertifikat konnte nicht gelesen werden.' }
    $der = [Convert]::FromBase64String(($match.Groups[1].Value -replace '\s', ''))
    $certificateHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($der)).ToLowerInvariant()
    if ($certificateHash -ne $expectedCertificate) { throw 'Der vorhandene Keystore passt nicht zum bestätigten öffentlichen Zertifikat. Es wurden keine Secrets übertragen.' }
    $keystoreBytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $KeystorePath))
    $encoded = [Convert]::ToBase64String($keystoreBytes)
    Set-AnkerSigningSecrets -GhExecutable $gh -TargetRepository $Repository -KeystoreBase64 $encoded -StorePassword $storeText -Alias $KeyAlias -KeyPassword $keyText
    Write-Host 'Vier Secrets über GitHub CLI verschlüsselt übertragen. Der Originalschlüssel bleibt unverändert auf diesem PC.'
    Write-Host 'Keine Werte kopieren oder im Chat senden. Jetzt erst eine manuelle Actions-Ausführung mit dem gewünschten grünen Codecommit starten.'
} finally {
    if ($null -ne $keystoreBytes) { [Array]::Clear($keystoreBytes, 0, $keystoreBytes.Length) }
    if ($null -ne $storeSecure) { $storeSecure.Dispose() }
    if ($null -ne $keySecure) { $keySecure.Dispose() }
    $storeText = $null
    $keyText = $null
    $encoded = $null
}
