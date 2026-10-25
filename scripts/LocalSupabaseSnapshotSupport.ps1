Set-StrictMode -Version Latest

function Assert-SbVerifiedLocalSnapshotArchive {
    param(
        [Parameter(Mandatory=$true)][string]$EvidencePath,
        [Parameter(Mandatory=$true)][string]$RepositoryRoot,
        [Parameter(Mandatory=$true)]$Tools
    )
    $backup=Read-SbEvidenceJson -Path $EvidencePath -Label 'Backup'
    foreach($field in @('projectRef','sourceSystemIdentifier','releaseCommit',
                        'database','schema','format','postgresMajor','flywayVersion',
                        'archivePath','archiveSha256')) {
        if($null -eq $backup.PSObject.Properties[$field]) {
            throw "Snapshot evidence missing: $field"
        }
    }
    if($backup.projectRef -cne 'whftdzfbvpchmghttjkg' -or
       [string]$backup.sourceSystemIdentifier -cne '7692130048193495360' -or
       $backup.database -cne 'postgres' -or $backup.schema -cne 'public' -or
       $backup.format -cne 'custom' -or [int]$backup.postgresMajor -ne 17 -or
       [int]$backup.flywayVersion -ne 12 -or
       [string]$backup.releaseCommit -cnotmatch '^[0-9a-f]{40}$' -or
       [string]$backup.archiveSha256 -cnotmatch '^[0-9a-fA-F]{64}$') {
        throw 'Snapshot evidence is not the verified production V12 public archive.'
    }
    if(-not [IO.Path]::IsPathRooted([string]$backup.archivePath) -or
       -not(Test-Path -LiteralPath $backup.archivePath -PathType Leaf)) {
        throw 'Snapshot archive does not exist at the evidence path.'
    }
    $repo=[IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\','/')
    $paths=@([IO.Path]::GetFullPath($EvidencePath),[IO.Path]::GetFullPath([string]$backup.archivePath))
    foreach($p in $paths) {
        if($p.StartsWith($repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
            throw 'Private snapshot files must not be stored inside the Git repository.'
        }
    }
    $checksum=(Get-FileHash -LiteralPath $backup.archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if($checksum -cne ([string]$backup.archiveSha256).ToLowerInvariant()) {
        throw 'Snapshot archive SHA-256 mismatch.'
    }
    & git -C $RepositoryRoot merge-base --is-ancestor $backup.releaseCommit HEAD
    if($LASTEXITCODE -ne 0) { throw 'The backup commit is not an ancestor of this checkout.' }
    & git -C $RepositoryRoot diff --quiet $backup.releaseCommit HEAD -- 'servisimibul-backend/src/main/resources/db/migration'
    if($LASTEXITCODE -ne 0) { throw 'Migration SQL was modified since the V12 snapshot.' }
    & git -C $RepositoryRoot diff --quiet HEAD -- 'servisimibul-backend/src/main/resources/db/migration'
    if($LASTEXITCODE -ne 0) { throw 'Migration SQL has uncommitted changes.' }
    $toc=@(& $Tools.PgRestore '--list' ([string]$backup.archivePath) 2>&1)
    if($LASTEXITCODE -ne 0) { throw 'Cannot inspect the source snapshot archive.' }
    $status=Get-SbBackupArchiveTocStatus -Lines ([string[]]$toc)
    if(-not $status.ValidFormat -or -not $status.FlywayTable -or -not $status.FlywayData) {
        throw 'Snapshot does not contain valid custom-format Flyway history.'
    }
    return [IO.Path]::GetFullPath([string]$backup.archivePath)
}

function Restore-SbV12SnapshotToDisposable {
    param(
        [Parameter(Mandatory=$true)]$Cluster,
        [Parameter(Mandatory=$true)][string]$ArchivePath
    )
    Assert-SbDisposableClusterIdentity -Cluster $Cluster
    $sql=@'
CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
'@
    $null=Invoke-SbPsql -Cluster $Cluster -Database 'postgres' -Username $Cluster.AdminUser -Password $Cluster.AdminPassword -Sql $sql

    # No ambient libpq overrides may select a different remote endpoint.
    $oldPg=@{}
    foreach($var in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)) {
        $oldPg[$var.Name]=$var.Value
        Remove-Item -LiteralPath ('Env:'+$var.Name) -ErrorAction SilentlyContinue
    }
    try {
        $env:PGPASSWORD=$Cluster.AdminPassword
        $args=@('--exit-on-error','--single-transaction','--no-owner',
            '--host=127.0.0.1',"--port=$($Cluster.Port)",
            "--username=$($Cluster.AdminUser)","--dbname=$($Cluster.Database)",
            '--schema=public',$ArchivePath)
        $null=@(& $Cluster.Tools.PgRestore @args 2>&1)
        if($LASTEXITCODE -ne 0) { throw 'Restoring the public snapshot into disposable PostgreSQL failed.' }
    } finally {
        foreach($var in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)) {
            Remove-Item -LiteralPath ('Env:'+$var.Name) -ErrorAction SilentlyContinue
        }
        foreach($name in $oldPg.Keys) {
            Set-Item -LiteralPath ('Env:'+$name) -Value $oldPg[$name]
        }
    }
    Assert-SbDisposableClusterIdentity -Cluster $Cluster
    $history=@(Invoke-SbPsql -Cluster $Cluster -Database $Cluster.Database -Username $Cluster.AdminUser -Password $Cluster.AdminPassword -Sql @'
SELECT coalesce(string_agg(version,',' ORDER BY installed_rank),'none') || '|' ||
       (SELECT count(*) FROM public.flyway_schema_history WHERE NOT success)
FROM public.flyway_schema_history WHERE version IS NOT NULL AND success;
'@) | Select-Object -Last 1
    if($history.Count -ne 1 -or [string]$history[0] -cne '1,2,3,4,5,6,7,8,9,10,11,12|0') {
        throw 'Disposable restore does not match expected Flyway V12 history.'
    }
    Write-Host 'Verified V12 public-schema snapshot restored only into disposable PostgreSQL.'
}
