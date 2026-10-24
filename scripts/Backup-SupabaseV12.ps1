[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9]{10,30}$')][string]$ExpectedSystemIdentifier,
    [Parameter(Mandatory=$true)][string]$MigrationJdbcUrl,
    [Parameter(Mandatory=$true)][string]$MigrationUser,
    [Parameter(Mandatory=$true)][string]$RuntimeJdbcUrl,
    [Parameter(Mandatory=$true)][string]$RuntimeUser,
    [Parameter(Mandatory=$true)][string]$ArchivePath,
    [Parameter(Mandatory=$true)][string]$EvidencePath,
    [string]$PostgresBin
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')

function Assert-SbBackupDestination {
    param([string]$Archive,[string]$Evidence,[string]$RepositoryRoot)
    if (-not [IO.Path]::IsPathRooted($Archive) -or -not [IO.Path]::IsPathRooted($Evidence)) {
        throw 'Backup archive and evidence paths must be absolute.'
    }
    $repo=[IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\','/')
    $normalized=@([IO.Path]::GetFullPath($Archive),[IO.Path]::GetFullPath($Evidence))
    if ([string]::Equals($normalized[0],$normalized[1],[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Backup and evidence must have different paths.'
    }
    foreach($p in $normalized) {
        if ($p.StartsWith($repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($p,$repo,[StringComparison]::OrdinalIgnoreCase) -or
            (Test-Path -LiteralPath $p)) {
            throw 'Destination already exists or is inside the repository; use new private paths.'
        }
        if (-not (Test-Path -LiteralPath (Split-Path -Parent $p) -PathType Container)) {
            throw 'Create a private backup destination directory first.'
        }
    }
    return [pscustomobject]@{Archive=$normalized[0];Evidence=$normalized[1]}
}

function Resolve-SbBackupClients {
    param([string]$Bin)
    if ($Bin) {
        $psql=Join-Path $Bin 'psql.exe'
        $dump=Join-Path $Bin 'pg_dump.exe'
        $restore=Join-Path $Bin 'pg_restore.exe'
        foreach($path in @($psql,$dump,$restore)) {
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
                throw 'PostgreSQL 17 tools missing in -PostgresBin.'
            }
        }
    } else {
        $psql=(Get-Command psql.exe -ErrorAction Stop).Source
        $dump=(Get-Command pg_dump.exe -ErrorAction Stop).Source
        $restore=(Get-Command pg_restore.exe -ErrorAction Stop).Source
    }
    foreach($tool in @($psql,$dump,$restore)) {
        $version=(& $tool --version 2>&1 | Select-Object -First 1).ToString()
        if ($LASTEXITCODE -ne 0 -or $version -notmatch '\b17(?:\.[0-9]+)?(?:\s|$)') {
            throw 'This backup requires PostgreSQL 17 client tools.'
        }
    }
    return [pscustomobject]@{Psql=$psql;Dump=$dump;Restore=$restore}
}

function Assert-SbReviewedBackupCommit {
    param([string]$RepositoryRoot)
    $head=(& git -C $RepositoryRoot rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or $head -cnotmatch '^[0-9a-f]{40}$') {
        throw 'Cannot identify the reviewed repository revision.'
    }
    & git -C $RepositoryRoot diff --quiet HEAD -- 'servisimibul-backend/src/main/resources/db/migration'
    if ($LASTEXITCODE -ne 0) {
        throw 'Migration SQL artifacts must match the checked-out commit.'
    }
    return $head
}

$dest=Assert-SbBackupDestination -Archive $ArchivePath -Evidence $EvidencePath -RepositoryRoot $root
$revision=Assert-SbReviewedBackupCommit -RepositoryRoot $root
$client=Resolve-SbBackupClients -Bin $PostgresBin
$migration=ConvertTo-SbSupabaseEndpoint -JdbcUrl $MigrationJdbcUrl -ProjectRef $ProjectRef -User $MigrationUser -Role migration
$runtime=ConvertTo-SbSupabaseEndpoint -JdbcUrl $RuntimeJdbcUrl -ProjectRef $ProjectRef -User $RuntimeUser -Role runtime
Assert-SbSameDatabaseTarget -MigrationEndpoint $migration -RuntimeEndpoint $runtime
if (-not $env:PGPASSWORD -or -not $env:SB_DB_PASSWORD) {
    throw 'Set process-scoped PGPASSWORD (migration) and SB_DB_PASSWORD (restricted runtime); never pass secrets in arguments.'
}
Assert-SbRuntimeConnection -Endpoint $runtime -Password $env:SB_DB_PASSWORD -Client $client.Psql
$artifacts=Get-SbMigrationArtifacts -RepositoryRoot $root
$before=Invoke-SbSupabaseMigrationPreflight -Endpoint $migration -RuntimeEndpoint $runtime -ExpectedSystemIdentifier $ExpectedSystemIdentifier -Artifacts $artifacts -Client $client.Psql
if ($before.Version -ne 12) {
    throw 'Only a fully verified V12 source can be backed up by this script.'
}
Write-Host 'Preflight passed. Creating a READ-ONLY PostgreSQL 17 custom-format backup of public schema.'
$tempArchive=$dest.Archive+'.incomplete-'+[guid]::NewGuid().ToString('N')
$previousPg=@{}
foreach($e in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)) {
    if ($e.Name -cne 'PGPASSWORD') {
        $previousPg[$e.Name]=$e.Value
        Remove-Item -LiteralPath ('Env:'+$e.Name) -ErrorAction SilentlyContinue
    }
}
try {
    $env:PGSSLMODE=$migration.SslMode
    $arguments=@('--format=custom','--compress=9','--schema=public','--no-password',
        '--host',$migration.Host,'--port',[string]$migration.Port,'--username',$migration.User,
        '--dbname',$migration.Database,'--file',$tempArchive)
    $null=@(& $client.Dump @arguments 2>&1)
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $tempArchive -PathType Leaf) -or
        (Get-Item -LiteralPath $tempArchive).Length -eq 0) {
        throw 'pg_dump could not produce a complete custom-format archive. No evidence generated.'
    }
} finally {
    foreach($e in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)) {
        if ($e.Name -cne 'PGPASSWORD') {
            Remove-Item -LiteralPath ('Env:'+$e.Name) -ErrorAction SilentlyContinue
        }
    }
    foreach($name in $previousPg.Keys) {
        Set-Item -LiteralPath ('Env:'+$name) -Value $previousPg[$name]
    }
}
try {
    $toc=@(& $client.Restore '--list' $tempArchive 2>&1)
    if ($LASTEXITCODE -ne 0 -or
        @($toc|Where-Object{[string]$_ -match '^;[[:space:]]*Format: CUSTOM'}).Count -ne 1 -or
        @($toc|Where-Object{[string]$_ -match '\bTABLE public flyway_schema_history\b'}).Count -lt 1) {
        throw 'Archive verification failed; required Flyway history table is absent.'
    }
    $after=Invoke-SbSupabaseMigrationPreflight -Endpoint $migration -RuntimeEndpoint $runtime -ExpectedSystemIdentifier $ExpectedSystemIdentifier -Artifacts $artifacts -Client $client.Psql
    if ($after.Version -ne $before.Version -or $after.SystemIdentifier -cne $before.SystemIdentifier) {
        throw 'Flyway state or database identity changed during backup. Stop and review.'
    }
    $hash=(Get-FileHash -LiteralPath $tempArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    Move-Item -LiteralPath $tempArchive -Destination $dest.Archive -ErrorAction Stop
    $record=[ordered]@{
        projectRef=$ProjectRef
        database='postgres'
        postgresMajor=17
        flywayVersion=12
        sourceSystemIdentifier=$before.SystemIdentifier
        releaseCommit=$revision
        archivePath=$dest.Archive
        archiveSha256=$hash
        archiveBytes=(Get-Item -LiteralPath $dest.Archive).Length
        createdAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
        schema='public'
        format='custom'
    }
    $record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $dest.Evidence -Encoding UTF8
    Write-Host 'V12 archive and SHA-256 evidence saved in the private destination.'
    Write-Host 'NEXT: verify restoration against disposable PostgreSQL 17. No shared schema changes performed.'
} finally {
    if (Test-Path -LiteralPath $tempArchive) {
        Remove-Item -LiteralPath $tempArchive -Force -ErrorAction SilentlyContinue
    }
}
