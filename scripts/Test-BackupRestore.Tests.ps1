[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')
. (Join-Path $PSScriptRoot 'BackupRestoreSupport.ps1')

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function New-FakeCluster {
    param(
        [string]$HostName = '127.0.0.1',
        [int]$Port = 55432,
        [string]$InstanceId = 'a12_source',
        [string]$Root = 'C:\temp\source'
    )
    return [pscustomobject]@{
        AdminJdbcUrl = "jdbc:postgresql://${HostName}:$Port/servisimibul_a12"
        Database = 'servisimibul_a12'
        InstanceId = $InstanceId
        Port = $Port
        Root = $Root
    }
}

$remoteRejected = $false
try {
    Assert-SbBackupRestorePair `
        -Source (New-FakeCluster -HostName 'db.example.supabase.co') `
        -Target (New-FakeCluster -Port 55433 -InstanceId 'a12_target' -Root 'C:\temp\target')
} catch {
    $remoteRejected = $_.Exception.Message -match 'named loopback database'
}
Assert-Condition $remoteRejected 'A remote backup source was not rejected.'

$sameTargetRejected = $false
$sameCluster = New-FakeCluster
try {
    Assert-SbBackupRestorePair -Source $sameCluster -Target $sameCluster
} catch {
    $sameTargetRejected = $_.Exception.Message -match 'two different disposable'
}
Assert-Condition $sameTargetRejected 'Reusing the backup source as its restore target was not rejected.'

$unsafeWorkspaceRejected = $false
try {
    Remove-SbA13WorkspaceDirectory -Path $repositoryRoot
} catch {
    $unsafeWorkspaceRejected = $_.Exception.Message -match 'Refusing to use non-A-13 workspace'
}
Assert-Condition $unsafeWorkspaceRejected 'Unsafe A-13 cleanup did not fail closed.'

$tempSibling = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/') + '-outside'
$unsafeSiblingRejected = $false
try {
    Remove-SbA13WorkspaceDirectory -Path (Join-Path $tempSibling 'ServisimiBul-A13-fake')
} catch {
    $unsafeSiblingRejected = $_.Exception.Message -match 'Refusing to use non-A-13 workspace'
}
Assert-Condition $unsafeSiblingRejected 'A temp-prefix sibling path was not rejected.'

$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('ServisimiBul-A13-' + [guid]::NewGuid())
try {
    $volume = Join-Path $workspace 'tariffs'
    New-Item -ItemType Directory -Path $volume | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $volume 'current.json'), '{"version":"v1"}')
    $manifest = @(Get-SbFileManifest -Root $volume)
    Assert-SbFileManifest -Root $volume -Expected $manifest

    [System.IO.File]::WriteAllText((Join-Path $volume 'current.json'), '{"version":"tampered"}')
    $tamperRejected = $false
    try {
        Assert-SbFileManifest -Root $volume -Expected $manifest
    } catch {
        $tamperRejected = $_.Exception.Message -match 'manifest mismatch'
    }
    Assert-Condition $tamperRejected 'A modified tariff file was not rejected by its manifest.'

    $reconciliationPath = Join-Path $workspace 'restore-reconciliation.json'
    $archiveHash = 'a' * 64
    [System.IO.File]::WriteAllText($reconciliationPath, (@{
        schemaVersion = 1
        backupArchiveSha256 = $archiveHash
        entries = @(@{
            operationId = 'app12-test-operation'
            category = '4'
            recordType = 'email_verification_token'
            recordId = '00000000-0000-0000-0000-000000000701'
            action = 'DELETE'
        })
    } | ConvertTo-Json -Depth 5))
    $reconciliationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $reconciliationPath).Hash
    $manifest = Read-SbRestoreReconciliationManifest -Path $reconciliationPath `
        -ExpectedManifestSha256 $reconciliationHash -ExpectedArchiveSha256 $archiveHash
    Assert-Condition (@($manifest.entries).Count -eq 1) `
        'A valid restore reconciliation manifest was not accepted.'

    $wrongArchiveRejected = $false
    try {
        $null = Read-SbRestoreReconciliationManifest -Path $reconciliationPath `
            -ExpectedManifestSha256 $reconciliationHash -ExpectedArchiveSha256 ('b' * 64)
    } catch {
        $wrongArchiveRejected = $_.Exception.Message -match 'selected backup'
    }
    Assert-Condition $wrongArchiveRejected `
        'A reconciliation manifest for another backup was not rejected.'

    $missingReconciliationRejected = $false
    try {
        $null = Read-SbRestoreReconciliationManifest `
            -Path (Join-Path $workspace 'missing-reconciliation.json') `
            -ExpectedManifestSha256 $reconciliationHash -ExpectedArchiveSha256 $archiveHash
    } catch {
        $missingReconciliationRejected = $_.Exception.Message -match 'is missing'
    }
    Assert-Condition $missingReconciliationRejected `
        'A missing restore reconciliation manifest was not rejected.'

    [System.IO.File]::AppendAllText($reconciliationPath, ' ')
    $tamperedReconciliationRejected = $false
    try {
        $null = Read-SbRestoreReconciliationManifest -Path $reconciliationPath `
            -ExpectedManifestSha256 $reconciliationHash -ExpectedArchiveSha256 $archiveHash
    } catch {
        $tamperedReconciliationRejected = $_.Exception.Message -match 'checksum mismatch'
    }
    Assert-Condition $tamperedReconciliationRejected `
        'A tampered restore reconciliation manifest was not rejected.'
} finally {
    Remove-SbA13WorkspaceDirectory -Path $workspace
}

$mainScript = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'Test-BackupRestore.ps1')
Assert-Condition ($mainScript.Contains("'--exit-on-error', '--single-transaction', '--no-owner'")) `
    'The restore command does not enforce transactional, owner-independent failure handling.'
Assert-Condition (-not $mainScript.Contains("'--clean'")) `
    'The restore drill must not clean an existing target.'
Assert-Condition ($mainScript.Contains('Assert-SbDisposableClusterIdentity')) `
    'The recovery drill does not verify disposable cluster identity.'

Write-Host 'A-13 backup/restore safety tests passed.'
