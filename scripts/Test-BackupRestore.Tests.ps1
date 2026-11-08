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

function New-ReconciliationManifest {
    return [ordered]@{
        schemaVersion = 1
        backupArchiveSha256 = 'a' * 64
        createdAtUtc = '2026-11-08T09:00:00.0000000+00:00'
        entries = @([ordered]@{
            operationId = 'app12-test-operation'
            category = '4'
            recordType = 'email_verification_token'
            recordId = '00000000-0000-0000-0000-000000000701'
            action = 'DELETE'
        })
    }
}

function Write-ReconciliationManifest {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Content,
        [switch]$RawJson
    )

    $json = if ($RawJson) { [string]$Content } else { $Content | ConvertTo-Json -Depth 8 }
    [System.IO.File]::WriteAllText($Path, $json)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function Assert-ReconciliationRejectedWithoutDeletion {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Content,
        [Parameter(Mandatory = $true)][string]$MessagePattern,
        [string]$ExpectedArchiveSha256 = ('a' * 64),
        [switch]$RawJson
    )

    $manifestHash = Write-ReconciliationManifest -Path $Path -Content $Content -RawJson:$RawJson
    $deletionTriggered = $false
    $expectedFailure = $false
    try {
        $null = Read-SbRestoreReconciliationManifest -Path $Path `
            -ExpectedManifestSha256 $manifestHash `
            -ExpectedArchiveSha256 $ExpectedArchiveSha256
        $deletionTriggered = $true
    } catch {
        $expectedFailure = $_.Exception.Message -match $MessagePattern
    }
    Assert-Condition (-not $deletionTriggered) "$Name reached the deletion boundary."
    Assert-Condition $expectedFailure "$Name did not fail closed with the expected error."
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
    $validReconciliation = New-ReconciliationManifest
    $reconciliationHash = Write-ReconciliationManifest `
        -Path $reconciliationPath -Content $validReconciliation
    $manifest = Read-SbRestoreReconciliationManifest -Path $reconciliationPath `
        -ExpectedManifestSha256 $reconciliationHash -ExpectedArchiveSha256 $archiveHash
    Assert-Condition (@($manifest.entries).Count -eq 1 -and
        $manifest.entries[0].recordId -eq '00000000-0000-0000-0000-000000000701') `
        'A valid restore reconciliation manifest was not accepted.'

    $validMultipleTargets = New-ReconciliationManifest
    $validMultipleTargets.entries += [ordered]@{
        operationId = 'app12-test-operation-2'
        category = '4'
        recordType = 'email_verification_token'
        recordId = '00000000-0000-0000-0000-000000000702'
        action = 'DELETE'
    }
    $multipleTargetsHash = Write-ReconciliationManifest `
        -Path $reconciliationPath -Content $validMultipleTargets
    $multipleTargets = Read-SbRestoreReconciliationManifest -Path $reconciliationPath `
        -ExpectedManifestSha256 $multipleTargetsHash -ExpectedArchiveSha256 $archiveHash
    Assert-Condition (@($multipleTargets.entries).Count -eq 2) `
        'Distinct disposal targets were not accepted.'

    Assert-ReconciliationRejectedWithoutDeletion -Name 'Wrong backup manifest' `
        -Path $reconciliationPath -Content (New-ReconciliationManifest) `
        -ExpectedArchiveSha256 ('b' * 64) -MessagePattern 'selected backup'

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

    Assert-ReconciliationRejectedWithoutDeletion -Name 'Malformed JSON manifest' `
        -Path $reconciliationPath -Content '{' -RawJson -MessagePattern 'invalid JSON'

    $unsupportedVersion = New-ReconciliationManifest
    $unsupportedVersion.schemaVersion = 2
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Unsupported schema version' `
        -Path $reconciliationPath -Content $unsupportedVersion -MessagePattern 'schema version'

    $duplicateOperation = New-ReconciliationManifest
    $duplicateOperation.entries += [ordered]@{
        operationId = 'app12-test-operation'
        category = '4'
        recordType = 'email_verification_token'
        recordId = '00000000-0000-0000-0000-000000000702'
        action = 'DELETE'
    }
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Duplicate operation ID' `
        -Path $reconciliationPath -Content $duplicateOperation -MessagePattern 'duplicate operation'

    $duplicateTarget = New-ReconciliationManifest
    $duplicateTarget.entries += [ordered]@{
        operationId = 'app12-test-operation-2'
        category = '4'
        recordType = 'email_verification_token'
        recordId = '00000000-0000-0000-0000-000000000701'
        action = 'DELETE'
    }
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Duplicate disposal target' `
        -Path $reconciliationPath -Content $duplicateTarget -MessagePattern 'duplicate disposal target'

    $invalidUuid = New-ReconciliationManifest
    $invalidUuid.entries[0].recordId = "00000000-0000-0000-0000-000000000701'; select 1; --"
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Invalid record UUID' `
        -Path $reconciliationPath -Content $invalidUuid -MessagePattern 'malformed'

    $missingField = New-ReconciliationManifest
    $null = $missingField.entries[0].Remove('action')
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Missing entry field' `
        -Path $reconciliationPath -Content $missingField -MessagePattern 'missing or unsupported fields'

    $nullField = New-ReconciliationManifest
    $nullField.entries[0].recordType = $null
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Null entry field' `
        -Path $reconciliationPath -Content $nullField -MessagePattern 'malformed'

    $emptyOperation = New-ReconciliationManifest
    $emptyOperation.entries[0].operationId = ' '
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Empty operation ID' `
        -Path $reconciliationPath -Content $emptyOperation -MessagePattern 'malformed'

    $unsupportedAction = New-ReconciliationManifest
    $unsupportedAction.entries[0].action = 'UPDATE'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Unsupported action' `
        -Path $reconciliationPath -Content $unsupportedAction -MessagePattern 'unsupported'

    $wrongCaseAction = New-ReconciliationManifest
    $wrongCaseAction.entries[0].action = 'delete'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Wrong-case action' `
        -Path $reconciliationPath -Content $wrongCaseAction -MessagePattern 'unsupported'

    $unsupportedCategory = New-ReconciliationManifest
    $unsupportedCategory.entries[0].category = '15'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Unsupported category' `
        -Path $reconciliationPath -Content $unsupportedCategory -MessagePattern 'unsupported'

    $unsupportedRecordType = New-ReconciliationManifest
    $unsupportedRecordType.entries[0].recordType = 'app_user'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Unsupported record type' `
        -Path $reconciliationPath -Content $unsupportedRecordType -MessagePattern 'unsupported'

    $emptyEntries = New-ReconciliationManifest
    $emptyEntries.entries = @()
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Empty entries' `
        -Path $reconciliationPath -Content $emptyEntries -MessagePattern 'no entries'

    $malformedEntries = New-ReconciliationManifest
    $malformedEntries.entries = @('not-an-object')
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Malformed entry' `
        -Path $reconciliationPath -Content $malformedEntries -MessagePattern 'malformed entry'

    $unexpectedField = New-ReconciliationManifest
    $unexpectedField.entries[0].unexpected = 'value'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Unsupported entry field' `
        -Path $reconciliationPath -Content $unexpectedField `
        -MessagePattern 'missing or unsupported fields'

    $missingTopLevelField = New-ReconciliationManifest
    $null = $missingTopLevelField.Remove('createdAtUtc')
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Missing manifest field' `
        -Path $reconciliationPath -Content $missingTopLevelField `
        -MessagePattern 'missing or unsupported fields'

    $unexpectedTopLevelField = New-ReconciliationManifest
    $unexpectedTopLevelField.unexpected = 'value'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Unsupported manifest field' `
        -Path $reconciliationPath -Content $unexpectedTopLevelField `
        -MessagePattern 'missing or unsupported fields'

    $invalidArchiveChecksum = New-ReconciliationManifest
    $invalidArchiveChecksum.backupArchiveSha256 = 'not-a-sha256'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Invalid backup checksum field' `
        -Path $reconciliationPath -Content $invalidArchiveChecksum `
        -MessagePattern 'selected backup'

    $invalidCreatedAt = New-ReconciliationManifest
    $invalidCreatedAt.createdAtUtc = 'not-a-timestamp'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Invalid creation timestamp' `
        -Path $reconciliationPath -Content $invalidCreatedAt `
        -MessagePattern 'UTC timestamp'

    Assert-ReconciliationRejectedWithoutDeletion -Name 'Null manifest' `
        -Path $reconciliationPath -Content 'null' -RawJson -MessagePattern 'one JSON object'
    Assert-ReconciliationRejectedWithoutDeletion -Name 'Array manifest' `
        -Path $reconciliationPath -Content '[]' -RawJson -MessagePattern 'one JSON object'

    $reconciliationHash = Write-ReconciliationManifest `
        -Path $reconciliationPath -Content (New-ReconciliationManifest)
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

    $startupBlocked = $false
    try {
        Assert-SbRestoreReconciliationComplete -ExpectedEntries 1 -RestoredRowsDetected 1 `
            -FirstPassDeleted 0 -RetryDeleted 0 -RemainingRows 1
    } catch {
        $startupBlocked = $_.Exception.Message -match 'startup is blocked'
    }
    Assert-Condition $startupBlocked `
        'Incomplete reconciliation did not block restored backend startup.'
    Assert-SbRestoreReconciliationComplete -ExpectedEntries 1 -RestoredRowsDetected 1 `
        -FirstPassDeleted 1 -RetryDeleted 0 -RemainingRows 0
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
$reconciliationGate = $mainScript.IndexOf('Assert-SbRestoreReconciliationComplete')
$backendStartup = $mainScript.IndexOf("Write-Host 'Starting the backend against the restored database")
Assert-Condition ($reconciliationGate -ge 0 -and $backendStartup -gt $reconciliationGate) `
    'The restored backend can start before reconciliation completes.'
$cleanupCall = $mainScript.LastIndexOf('Remove-SbA13WorkspaceDirectory -Path $workspace')
$evidenceWrite = $mainScript.LastIndexOf('[System.IO.File]::WriteAllText(')
Assert-Condition ($cleanupCall -ge 0 -and $evidenceWrite -gt $cleanupCall) `
    'PASS evidence can be published before temporary database cleanup succeeds.'

Write-Host 'A-13 backup/restore safety tests passed.'
