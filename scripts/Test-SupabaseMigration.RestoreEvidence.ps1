[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupEvidencePath,
    [Parameter(Mandatory = $true)][string]$EvidenceOutputPath,
    [string]$PostgresBin,
    [string]$JavaHome
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')
. (Join-Path $PSScriptRoot 'BackupRestoreSupport.ps1')
. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')

function Assert-SbOps01RestoreInput {
    param([string]$InputPath, [string]$OutputPath, [string]$Root)
    $backup = Read-SbEvidenceJson -Path $InputPath -Label 'Backup'
    foreach ($key in @('projectRef','archivePath','archiveSha256','sourceSystemIdentifier','releaseCommit','database','postgresMajor','flywayVersion')) {
        if ($null -eq $backup.PSObject.Properties[$key]) {
            throw ('Backup evidence field missing: ' + $key)
        }
    }
    if ($backup.projectRef -cnotmatch '^[a-z0-9]{20}$' -or
        $backup.sourceSystemIdentifier -cnotmatch '^[0-9]{10,30}$' -or
        $backup.releaseCommit -cnotmatch '^[0-9a-f]{40}$' -or
        $backup.archiveSha256 -cnotmatch '^[0-9a-fA-F]{64}$' -or
        $backup.database -cne 'postgres' -or
        [int]$backup.postgresMajor -ne 17 -or [int]$backup.flywayVersion -ne 12) {
        throw 'Backup identity or release/version/digest metadata is invalid.'
    }
    if (-not [IO.Path]::IsPathRooted([string]$backup.archivePath) -or
        -not (Test-Path -LiteralPath $backup.archivePath -PathType Leaf)) {
        throw 'Backup archive must exist at an absolute local path.'
    }
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\','/')
    $archivePath = [IO.Path]::GetFullPath([string]$backup.archivePath)
    $outputPath = [IO.Path]::GetFullPath($OutputPath)
    foreach ($p in @($archivePath,$outputPath)) {
        if ($p.StartsWith($rootPath + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
            throw 'Archive and restore evidence must be kept outside the repository.'
        }
    }
    if (Test-Path -LiteralPath $outputPath) { throw 'Refusing to overwrite existing restore evidence.' }
    $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -cne ([string]$backup.archiveSha256).ToLowerInvariant()) { throw 'Backup checksum mismatch.' }
    $head = (& git -C $Root rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
        throw 'Could not read checked-out revision.'
    }
    $releasePaths = @('servisimibul-backend','.mvn','mvnw.cmd','scripts/WindowsDevelopmentSupport.ps1','scripts/BackupRestoreSupport.ps1')
    $v15Path = 'servisimibul-backend/src/main/resources/db/migration/V15__harden_runtime_privileges.sql'
    if ($head -cne $backup.releaseCommit) {
        & git -C $Root merge-base --is-ancestor $backup.releaseCommit HEAD
        if ($LASTEXITCODE -ne 0) { throw 'Backup revision is not an ancestor of checkout.' }
        $changes = @(& git -C $Root diff --name-only $backup.releaseCommit HEAD -- $releasePaths)
        if ($LASTEXITCODE -ne 0 -or @($changes | Where-Object { $_ -cne $v15Path }).Count -gt 0) {
            throw 'Changes beyond reviewed V15 migration were detected since the backup revision.'
        }
    }
    & git -C $Root diff --quiet HEAD -- $releasePaths
    if ($LASTEXITCODE -ne 0) { throw 'Reviewed release inputs have local modifications.' }
    return [pscustomobject]@{ Backup=$backup; Archive=$archivePath; Hash=$hash; Output=$outputPath; RehearsalCommit=$head }
}

function Initialize-SbOps01DisposableSupabaseRoles {
    param([Parameter(Mandatory = $true)]$Cluster)
    # The source public-schema dump contains ACL and default-ACL entries for
    # Supabase platform roles. Create only inert role names, inside the
    # verified disposable cluster. No login, privileges, or BYPASSRLS.
    Assert-SbDisposableClusterIdentity -Cluster $Cluster
    $sql = @'
CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
'@
    $null = Invoke-SbPsql -Cluster $Cluster -Database 'postgres' -Username $Cluster.AdminUser -Password $Cluster.AdminPassword -Sql $sql
    $checks = @'
SELECT count(*) || '|' || count(*) FILTER (WHERE rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
FROM pg_roles WHERE rolname IN ('service_role', 'supabase_admin');
'@
    $result = @(Invoke-SbPsql -Cluster $Cluster -Database 'postgres' -Username $Cluster.AdminUser -Password $Cluster.AdminPassword -Sql $checks)
    if (@($result | Where-Object { $_.ToString().Trim() -ceq '2|0' }).Count -ne 1) {
        throw 'Disposable Supabase compatibility roles are missing or elevated.'
    }
}

function Invoke-SbOps01DisposableMigration {
    param($Cluster,$JavaRuntime,[string]$TariffDir)
    $envMap = @{
        JAVA_HOME=$JavaRuntime.Home; SPRING_PROFILES_ACTIVE='migration'
        SB_DB_JDBC_URL=$Cluster.RuntimeJdbcUrl; SB_DB_USER=$Cluster.RuntimeUser; SB_DB_PASSWORD=$Cluster.RuntimePassword
        SPRING_DATASOURCE_URL=$Cluster.RuntimeJdbcUrl; SPRING_DATASOURCE_USERNAME=$Cluster.RuntimeUser; SPRING_DATASOURCE_PASSWORD=$Cluster.RuntimePassword
        SB_DB_MIGRATION_JDBC_URL=$Cluster.AdminJdbcUrl; SB_DB_MIGRATION_USER=$Cluster.AdminUser; SB_DB_MIGRATION_PASSWORD=$Cluster.AdminPassword
        SPRING_FLYWAY_URL=$Cluster.AdminJdbcUrl; SPRING_FLYWAY_USER=$Cluster.AdminUser; SPRING_FLYWAY_PASSWORD=$Cluster.AdminPassword
        SB_FLYWAY_ENABLED='true'; SPRING_FLYWAY_ENABLED='true'; SPRING_FLYWAY_TARGET=$null
        SPRING_JPA_HIBERNATE_DDL_AUTO='validate'; SPRING_SQL_INIT_MODE='never'
        SB_ADMIN_BOOTSTRAP_ENABLED='false'; SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED='false'
        SB_ADMIN_1_EMAIL=$null; SB_ADMIN_1_PASSWORD=$null; SB_ADMIN_2_EMAIL=$null; SB_ADMIN_2_PASSWORD=$null
        SB_MAIL_ENABLED='false'; SERVISIMIBUL_EMAIL_ENABLED='false'; SB_DEMAND_FEEDBACK_SCHEDULER_ENABLED='false'
        SB_TARIFF_STORAGE_DIR=$TariffDir
    }
    $prior = Set-SbTemporaryEnvironment -Values $envMap
    try {
        Push-Location $backendDirectory
        try {
            & '.\mvnw.cmd' --batch-mode '-Dspring-boot.run.profiles=migration' '-Dspring-boot.run.arguments=--spring.main.web-application-type=none' spring-boot:run
            if ($LASTEXITCODE -ne 0) { throw 'Disposable migration rehearsal failed; shared Supabase was not modified.' }
        } finally { Pop-Location }
    } finally { Restore-SbEnvironment -Previous $prior }
}

$input = Assert-SbOps01RestoreInput -InputPath $BackupEvidencePath -OutputPath $EvidenceOutputPath -Root $repositoryRoot
$tools = Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
$java = Resolve-SbJavaRuntime -RequestedHome $JavaHome
$list = @(& $tools.PgRestore '--list' $input.Archive 2>&1)
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL pg_restore could not read the backup.' }
$tocStatus = Get-SbBackupArchiveTocStatus -Lines ([string[]]$list)
if (-not $tocStatus.ValidFormat -or -not $tocStatus.FlywayTable -or -not $tocStatus.FlywayData) {
    throw 'Backup Flyway schema or data was not verified.'
}
$pgEnvironment = @{}
foreach ($entry in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)) {
    $pgEnvironment[$entry.Name] = $entry.Value
    Remove-Item -LiteralPath ('Env:'+$entry.Name) -ErrorAction SilentlyContinue
}
$cluster=$null
try {
    $cluster=Start-SbIsolatedPostgres -Tools $tools
    Assert-SbDisposableClusterIdentity -Cluster $cluster
    Initialize-SbOps01DisposableSupabaseRoles -Cluster $cluster
    $identifier=(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql 'SELECT system_identifier FROM pg_control_system();' | Select-Object -Last 1).ToString().Trim()
    if ($identifier -cnotmatch '^[0-9]{10,30}$' -or $identifier -ceq $input.Backup.sourceSystemIdentifier) {
        throw 'Could not prove a separate disposable PostgreSQL system identity.'
    }
    $env:PGPASSWORD=$cluster.AdminPassword
    $null=@(& $tools.PgRestore '--exit-on-error' '--single-transaction' '--no-owner' '--host=127.0.0.1' "--port=$($cluster.Port)" "--username=$($cluster.AdminUser)" "--dbname=$($cluster.Database)" '--schema=public' $input.Archive 2>&1)
    if ($LASTEXITCODE -ne 0) { throw 'Restore into disposable PostgreSQL failed. No live target was modified.' }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Assert-SbDisposableClusterIdentity -Cluster $cluster
    $sql=@'
SELECT coalesce(string_agg(version,',' ORDER BY installed_rank),'none') || '|' ||
(SELECT count(*) FROM public.flyway_schema_history WHERE NOT success)
FROM public.flyway_schema_history WHERE version IS NOT NULL AND success;
'@
    $history=(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql $sql | Select-Object -Last 1).ToString().Trim()
    if ($history -cne '1,2,3,4,5,6,7,8,9,10,11,12|0') { throw 'Restored V12 Flyway history is inconsistent.' }
    Write-Host 'V12 restoration verified in disposable PostgreSQL.'

    $tariffs=Join-Path $cluster.Root 'tariffs'
    $null=New-Item -ItemType Directory -Path $tariffs
    Invoke-SbOps01DisposableMigration -Cluster $cluster -JavaRuntime $java -TariffDir $tariffs
    Invoke-SbOps01DisposableMigration -Cluster $cluster -JavaRuntime $java -TariffDir $tariffs
    $final=(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql $sql | Select-Object -Last 1).ToString().Trim()
    if ($final -cne '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15|0') { throw 'V15 rehearsal produced unexpected history.' }
    $endpoint=[pscustomobject]@{Host='127.0.0.1';Port=$cluster.Port;Database=$cluster.Database;User=$cluster.AdminUser;SslMode=$null}
    $env:PGPASSWORD=$cluster.AdminPassword
    Assert-SbPostMigrationVerification -Endpoint $endpoint -Client $tools.Psql -VerificationFile (Join-Path $repositoryRoot 'docs\10_MIGRATION_VERIFICATION.sql')
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $evidence=[ordered]@{
        projectRef=$input.Backup.projectRef; sourceSystemIdentifier=$input.Backup.sourceSystemIdentifier
        disposableSystemIdentifier=$identifier; backupSha256=$input.Hash; releaseCommit=$input.Backup.releaseCommit
        isolated=$true; postgresMajor=17; flywayVersion=12; v12RestoreVerified=$true; rehearsalToolCommit=$input.RehearsalCommit
        rehearsalTargetVersion=15; v15RehearsalVerified=$true; verificationChecksPassed=13
        testedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
    }
    $evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $input.Output -Encoding UTF8
    Write-Host 'Restored V12, rehearsed V13-V15 twice and passed all 13 checks in a disposable database.'
    Write-Host 'Restore evidence saved outside the repository. No shared database was modified.'
} finally {
    try {
        if ($cluster) { Stop-SbIsolatedPostgres -Cluster $cluster }
    } finally {
    foreach ($entry in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)) {
        Remove-Item -LiteralPath ('Env:'+$entry.Name) -ErrorAction SilentlyContinue
    }
    foreach ($name in $pgEnvironment.Keys) {
        Set-Item -LiteralPath ('Env:'+$name) -Value $pgEnvironment[$name]
    }
    }
}
