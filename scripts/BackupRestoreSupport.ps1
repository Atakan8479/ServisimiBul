Set-StrictMode -Version Latest

function Assert-SbBackupRestorePair {
    param(
        [Parameter(Mandatory = $true)]$Source,
        [Parameter(Mandatory = $true)]$Target
    )

    Assert-SbLoopbackJdbcUrl -JdbcUrl $Source.AdminJdbcUrl -ExpectedDatabase $Source.Database
    Assert-SbLoopbackJdbcUrl -JdbcUrl $Target.AdminJdbcUrl -ExpectedDatabase $Target.Database

    $sourceRoot = [System.IO.Path]::GetFullPath($Source.Root)
    $targetRoot = [System.IO.Path]::GetFullPath($Target.Root)
    if ([string]::Equals($sourceRoot, $targetRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        $Source.InstanceId -eq $Target.InstanceId -or
        $Source.Port -eq $Target.Port) {
        throw 'Backup and restore require two different disposable PostgreSQL instances.'
    }
}

function Assert-SbDisposableClusterIdentity {
    param([Parameter(Mandatory = $true)]$Cluster)

    Assert-SbLoopbackJdbcUrl -JdbcUrl $Cluster.AdminJdbcUrl -ExpectedDatabase $Cluster.Database
    $identityRows = @(
        @(Invoke-SbPsql -Cluster $Cluster -Database $Cluster.Database `
            -Username $Cluster.RuntimeUser -Password $Cluster.RuntimePassword -Sql @"
select current_database() || '|' || current_user || '|' || instance_id
from test_harness.database_instance;
"@) | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }
    )
    $actual = if ($identityRows.Count -gt 0) { $identityRows[-1] } else { '<no row>' }
    $expected = "$($Cluster.Database)|$($Cluster.RuntimeUser)|$($Cluster.InstanceId)"
    if ($actual -ne $expected) {
        throw "Disposable PostgreSQL identity verification failed: $actual"
    }
}

function Assert-SbA13WorkspacePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $leaf = [System.IO.Path]::GetFileName($resolvedPath)
    $parent = [System.IO.Path]::GetDirectoryName($resolvedPath)
    if (-not [string]::Equals($parent, $resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not $leaf.StartsWith('ServisimiBul-A13-', [System.StringComparison]::Ordinal)) {
        throw "Refusing to use non-A-13 workspace: $resolvedPath"
    }
    return $resolvedPath
}

function Remove-SbA13WorkspaceDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolvedPath = Assert-SbA13WorkspacePath -Path $Path
    if (Test-Path -LiteralPath $resolvedPath) {
        Remove-Item -LiteralPath $resolvedPath -Recurse -Force
    }
}

function Get-SbFileManifest {
    param([Parameter(Mandatory = $true)][string]$Root)

    $resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path.TrimEnd('\', '/')
    $files = @(Get-ChildItem -LiteralPath $resolvedRoot -File -Recurse | Sort-Object FullName)
    if ($files.Count -eq 0) {
        throw "Cannot create a manifest for an empty directory: $resolvedRoot"
    }

    return @($files | ForEach-Object {
        if (($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to hash a reparse-point file: $($_.FullName)"
        }
        $relativePath = $_.FullName.Substring($resolvedRoot.Length).TrimStart('\', '/') -replace '\\', '/'
        $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName
        [pscustomobject]@{
            Path = $relativePath
            Bytes = $_.Length
            Sha256 = $hash.Hash.ToLowerInvariant()
        }
    })
}

function Assert-SbFileManifest {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][object[]]$Expected
    )

    $actual = @(Get-SbFileManifest -Root $Root)
    $expectedRows = @($Expected)
    if ($actual.Count -ne $expectedRows.Count) {
        throw "File manifest count mismatch: expected $($expectedRows.Count), actual $($actual.Count)."
    }
    for ($index = 0; $index -lt $actual.Count; $index++) {
        $expectedRow = $expectedRows[$index]
        $actualRow = $actual[$index]
        if ($expectedRow.Path -ne $actualRow.Path -or
            [long]$expectedRow.Bytes -ne [long]$actualRow.Bytes -or
            $expectedRow.Sha256 -ne $actualRow.Sha256) {
            throw "File manifest mismatch at $($actualRow.Path)."
        }
    }
}

function Read-SbRestoreReconciliationManifest {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedManifestSha256,
        [Parameter(Mandatory = $true)][string]$ExpectedArchiveSha256
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Restore reconciliation manifest is missing: $Path"
    }
    $sha256Pattern = '^[0-9a-f]{64}$'
    $expectedManifestHash = $ExpectedManifestSha256.ToLowerInvariant()
    $expectedArchiveHash = $ExpectedArchiveSha256.ToLowerInvariant()
    if ($expectedManifestHash -notmatch $sha256Pattern -or
        $expectedArchiveHash -notmatch $sha256Pattern) {
        throw 'Restore reconciliation expected checksums must be SHA-256 values.'
    }
    $actualManifestHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
    if ($actualManifestHash -ne $expectedManifestHash) {
        throw 'Restore reconciliation manifest checksum mismatch.'
    }

    try {
        $manifest = Get-Content -Raw -LiteralPath $Path |
            ConvertFrom-Json -NoEnumerate -ErrorAction Stop
    } catch {
        throw "Restore reconciliation manifest is invalid JSON: $($_.Exception.Message)"
    }
    if ($manifest -is [array] -or $manifest -isnot [pscustomobject]) {
        throw 'Restore reconciliation manifest must be one JSON object.'
    }
    $manifestProperties = @($manifest.PSObject.Properties.Name | Sort-Object)
    $expectedManifestProperties = @('backupArchiveSha256', 'createdAtUtc', 'entries', 'schemaVersion')
    if (@(Compare-Object $expectedManifestProperties $manifestProperties -CaseSensitive).Count -ne 0) {
        throw 'Restore reconciliation manifest has missing or unsupported fields.'
    }
    if (($manifest.schemaVersion -isnot [int] -and $manifest.schemaVersion -isnot [long]) -or
        $manifest.schemaVersion -ne 1) {
        throw "Unsupported restore reconciliation schema version: $($manifest.schemaVersion)"
    }
    if ($manifest.backupArchiveSha256 -isnot [string] -or
        $manifest.backupArchiveSha256 -notmatch $sha256Pattern -or
        $manifest.backupArchiveSha256 -ne $expectedArchiveHash) {
        throw 'Restore reconciliation manifest does not belong to the selected backup.'
    }

    $createdAt = [DateTimeOffset]::MinValue
    $createdAtValid = if ($manifest.createdAtUtc -is [datetime]) {
        $createdAt = [DateTimeOffset]$manifest.createdAtUtc.ToUniversalTime()
        $true
    } elseif ($manifest.createdAtUtc -is [string]) {
        [DateTimeOffset]::TryParse([string]$manifest.createdAtUtc, [ref]$createdAt) -and
            $createdAt.Offset -eq [TimeSpan]::Zero
    } else {
        $false
    }
    if (-not $createdAtValid) {
        throw 'Restore reconciliation manifest createdAtUtc must be a UTC timestamp.'
    }

    if ($manifest.entries -isnot [array]) {
        throw 'Restore reconciliation manifest entries must be a JSON array.'
    }
    $entries = @($manifest.entries)
    if ($entries.Count -eq 0) {
        throw 'Restore reconciliation manifest contains no entries.'
    }
    $operationIds = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::Ordinal
    )
    $disposalTargets = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::Ordinal
    )
    $validatedEntries = @()
    foreach ($entry in $entries) {
        if ($entry -isnot [pscustomobject]) {
            throw 'Restore reconciliation manifest contains a malformed entry.'
        }
        $entryProperties = @($entry.PSObject.Properties.Name | Sort-Object)
        $expectedEntryProperties = @('action', 'category', 'operationId', 'recordId', 'recordType')
        if (@(Compare-Object $expectedEntryProperties $entryProperties -CaseSensitive).Count -ne 0) {
            throw 'Restore reconciliation entry has missing or unsupported fields.'
        }
        $recordId = [guid]::Empty
        if ($entry.operationId -isnot [string] -or
            $entry.operationId -cnotmatch '^[a-z0-9][a-z0-9._-]{0,63}$' -or
            -not $operationIds.Add([string]$entry.operationId) -or
            $entry.category -isnot [string] -or
            $entry.category -cne '4' -or
            $entry.recordType -isnot [string] -or
            $entry.recordType -cne 'email_verification_token' -or
            $entry.action -isnot [string] -or
            $entry.action -cne 'DELETE' -or
            $entry.recordId -isnot [string] -or
            -not [guid]::TryParseExact([string]$entry.recordId, 'D', [ref]$recordId)) {
            throw 'Restore reconciliation manifest contains a malformed, unsupported, or duplicate operation.'
        }
        $canonicalRecordId = $recordId.ToString('D').ToLowerInvariant()
        $target = "$($entry.recordType)|$canonicalRecordId"
        if (-not $disposalTargets.Add($target)) {
            throw 'Restore reconciliation manifest contains a duplicate disposal target.'
        }
        $validatedEntries += [pscustomobject]@{
            operationId = [string]$entry.operationId
            category = [string]$entry.category
            recordType = [string]$entry.recordType
            recordId = $canonicalRecordId
            action = [string]$entry.action
        }
    }
    return [pscustomobject]@{
        schemaVersion = 1
        backupArchiveSha256 = $expectedArchiveHash
        createdAtUtc = $createdAt.ToUniversalTime().ToString('o')
        entries = $validatedEntries
    }
}

function Assert-SbRestoreReconciliationComplete {
    param(
        [Parameter(Mandatory = $true)][int]$ExpectedEntries,
        [Parameter(Mandatory = $true)][int]$RestoredRowsDetected,
        [Parameter(Mandatory = $true)][int]$FirstPassDeleted,
        [Parameter(Mandatory = $true)][int]$RetryDeleted,
        [Parameter(Mandatory = $true)][int]$RemainingRows
    )

    if ($ExpectedEntries -le 0 -or
        $RestoredRowsDetected -ne $ExpectedEntries -or
        $FirstPassDeleted -ne $ExpectedEntries -or
        $RetryDeleted -ne 0 -or
        $RemainingRows -ne 0) {
        throw 'Restore reconciliation did not complete safely; restored backend startup is blocked.'
    }
}
