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
