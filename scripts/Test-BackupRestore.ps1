[CmdletBinding()]
param(
    [string]$JavaHome,
    [string]$PostgresBin,
    [string]$EvidencePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
$migrationVerification = Join-Path $repositoryRoot 'docs\10_MIGRATION_VERIFICATION.sql'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')
. (Join-Path $PSScriptRoot 'BackupRestoreSupport.ps1')

$sourceCluster = $null
$targetCluster = $null
$backendProcess = $null
$startedAt = [DateTimeOffset]::UtcNow
$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ('ServisimiBul-A13-' + [guid]::NewGuid())
$workspace = Assert-SbA13WorkspacePath -Path $workspace

function Invoke-A13Maven {
    param(
        [Parameter(Mandatory = $true)]$JavaRuntime,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    $mavenRuntime = Get-SbMavenRuntime -BackendDirectory $backendDirectory
    & $JavaRuntime.Java `
        "-Dmaven.home=$($mavenRuntime.Home)" `
        "-Dclassworlds.conf=$(Join-Path $mavenRuntime.Home 'bin\m2.conf')" `
        "-Dmaven.multiModuleProjectDirectory=$backendDirectory" `
        '-classpath' $mavenRuntime.Launcher `
        'org.codehaus.plexus.classworlds.launcher.Launcher' @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Invoke-A13Migration {
    param(
        [Parameter(Mandatory = $true)]$Cluster,
        [Parameter(Mandatory = $true)]$JavaRuntime,
        [Parameter(Mandatory = $true)][string]$TariffDirectory
    )

    $environment = @{
        JAVA_HOME = $JavaRuntime.Home
        SPRING_PROFILES_ACTIVE = 'migration'
        SB_DB_JDBC_URL = $Cluster.RuntimeJdbcUrl
        SB_DB_USER = $Cluster.RuntimeUser
        SB_DB_PASSWORD = $Cluster.RuntimePassword
        SPRING_DATASOURCE_URL = $Cluster.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $Cluster.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $Cluster.RuntimePassword
        SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
        SPRING_SQL_INIT_MODE = 'never'
        SB_FLYWAY_ENABLED = 'true'
        SB_DB_MIGRATION_JDBC_URL = $Cluster.AdminJdbcUrl
        SB_DB_MIGRATION_USER = $Cluster.AdminUser
        SB_DB_MIGRATION_PASSWORD = $Cluster.AdminPassword
        SPRING_FLYWAY_ENABLED = 'true'
        SPRING_FLYWAY_URL = $Cluster.AdminJdbcUrl
        SPRING_FLYWAY_USER = $Cluster.AdminUser
        SPRING_FLYWAY_PASSWORD = $Cluster.AdminPassword
        SB_ADMIN_BOOTSTRAP_ENABLED = 'false'
        SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED = 'false'
        SB_ADMIN_1_EMAIL = $null
        SB_ADMIN_1_PASSWORD = $null
        SB_ADMIN_2_EMAIL = $null
        SB_ADMIN_2_PASSWORD = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD = $null
        SB_MAIL_ENABLED = 'false'
        SERVISIMIBUL_EMAIL_ENABLED = 'false'
        SB_MAIL_USERNAME = $null
        SB_MAIL_PASSWORD = $null
        SPRING_MAIL_USERNAME = $null
        SPRING_MAIL_PASSWORD = $null
        SB_TARIFF_STORAGE_DIR = $TariffDirectory
        SERVISIMIBUL_TARIFF_STORAGE_DIR = $TariffDirectory
    }
    $previous = Set-SbTemporaryEnvironment -Values $environment
    try {
        Push-Location $backendDirectory
        try {
            Invoke-A13Maven -JavaRuntime $JavaRuntime `
                -Arguments @('--batch-mode', '-Dspring-boot.run.profiles=migration', 'spring-boot:run') `
                -FailureMessage 'The A-13 source migration process failed.'
        } finally {
            Pop-Location
        }
    } finally {
        Restore-SbEnvironment -Previous $previous
    }
}

function Invoke-A13TariffHarness {
    param(
        [Parameter(Mandatory = $true)][string]$Action,
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)]$JavaRuntime
    )

    $previous = Set-SbTemporaryEnvironment -Values @{ JAVA_HOME = $JavaRuntime.Home }
    try {
        Push-Location $backendDirectory
        try {
            Invoke-A13Maven -JavaRuntime $JavaRuntime -Arguments @(
                '--batch-mode',
                '-Dtest=TariffBackupRestoreVerificationTests',
                "-Dsb.a13.tariff.action=$Action",
                "-Dsb.a13.tariff.directory=$Directory",
                'test'
            ) -FailureMessage "The A-13 tariff $Action verification failed."
        } finally {
            Pop-Location
        }
    } finally {
        Restore-SbEnvironment -Previous $previous
    }
}

function Invoke-A13NativePostgresCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Password,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    $previousPassword = Get-Item -LiteralPath 'Env:PGPASSWORD' -ErrorAction SilentlyContinue
    try {
        $env:PGPASSWORD = $Password
        $output = @(& $Executable @Arguments 2>&1)
        if ($LASTEXITCODE -ne 0) {
            throw "$FailureMessage`n$($output -join [Environment]::NewLine)"
        }
        return $output
    } finally {
        if ($previousPassword) {
            $env:PGPASSWORD = $previousPassword.Value
        } else {
            Remove-Item -LiteralPath 'Env:PGPASSWORD' -ErrorAction SilentlyContinue
        }
    }
}

function Copy-A13DirectoryContents {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (Test-Path -LiteralPath $Destination) {
        if (@(Get-ChildItem -LiteralPath $Destination -Force).Count -gt 0) {
            throw "Restore destination must be empty: $Destination"
        }
    } else {
        New-Item -ItemType Directory -Path $Destination | Out-Null
    }
    foreach ($item in @(Get-ChildItem -LiteralPath $Source -Force)) {
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to copy a reparse point: $($item.FullName)"
        }
        Copy-Item -LiteralPath $item.FullName -Destination $Destination -Recurse -ErrorAction Stop
    }
}

function Wait-A13HttpSuccess {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process,
        [int]$TimeoutSeconds = 120
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        $Process.Refresh()
        if ($Process.HasExited) {
            throw "The restored backend stopped before $Uri became ready."
        }
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                return $response
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Timed out waiting for $Uri."
}

function Start-A13RestoredBackend {
    param(
        [Parameter(Mandatory = $true)]$Cluster,
        [Parameter(Mandatory = $true)]$JavaRuntime,
        [Parameter(Mandatory = $true)][string]$TariffDirectory,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$StandardOutput,
        [Parameter(Mandatory = $true)][string]$StandardError
    )

    $environment = @{
        JAVA_HOME = $JavaRuntime.Home
        SPRING_PROFILES_ACTIVE = 'local'
        SB_DB_JDBC_URL = $Cluster.RuntimeJdbcUrl
        SB_DB_USER = $Cluster.RuntimeUser
        SB_DB_PASSWORD = $Cluster.RuntimePassword
        SPRING_DATASOURCE_URL = $Cluster.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $Cluster.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $Cluster.RuntimePassword
        SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
        SPRING_SQL_INIT_MODE = 'never'
        SB_FLYWAY_ENABLED = 'false'
        SPRING_FLYWAY_ENABLED = 'false'
        SB_DB_MIGRATION_JDBC_URL = $null
        SB_DB_MIGRATION_USER = $null
        SB_DB_MIGRATION_PASSWORD = $null
        SPRING_FLYWAY_URL = $null
        SPRING_FLYWAY_USER = $null
        SPRING_FLYWAY_PASSWORD = $null
        SB_ADMIN_BOOTSTRAP_ENABLED = 'false'
        SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED = 'false'
        SB_ADMIN_1_EMAIL = $null
        SB_ADMIN_1_PASSWORD = $null
        SB_ADMIN_2_EMAIL = $null
        SB_ADMIN_2_PASSWORD = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD = $null
        SB_COOKIE_SECURE = 'false'
        SERVER_SERVLET_SESSION_COOKIE_SECURE = 'false'
        SB_EMAIL_VERIFICATION_REQUIRED = 'true'
        APP_AUTH_EMAIL_VERIFICATION_REQUIRED = 'true'
        OPERATOR_APPROVAL_REQUIRED = 'true'
        APP_OPERATOR_APPROVAL_REQUIRED = 'true'
        SB_MAIL_ENABLED = 'false'
        SERVISIMIBUL_EMAIL_ENABLED = 'false'
        SB_MAIL_USERNAME = $null
        SB_MAIL_PASSWORD = $null
        SPRING_MAIL_USERNAME = $null
        SPRING_MAIL_PASSWORD = $null
        SB_TARIFF_STORAGE_DIR = $TariffDirectory
        SERVISIMIBUL_TARIFF_STORAGE_DIR = $TariffDirectory
        SERVER_ADDRESS = '127.0.0.1'
        SERVER_PORT = $Port.ToString()
    }
    $mavenRuntime = Get-SbMavenRuntime -BackendDirectory $backendDirectory
    $previous = Set-SbTemporaryEnvironment -Values $environment
    try {
        return Start-Process -FilePath $JavaRuntime.Java -ArgumentList @(
            "-Dmaven.home=$($mavenRuntime.Home)",
            "-Dclassworlds.conf=$(Join-Path $mavenRuntime.Home 'bin\m2.conf')",
            "-Dmaven.multiModuleProjectDirectory=$backendDirectory",
            '-classpath', $mavenRuntime.Launcher,
            'org.codehaus.plexus.classworlds.launcher.Launcher',
            'spring-boot:run'
        ) -WorkingDirectory $backendDirectory -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $StandardOutput -RedirectStandardError $StandardError
    } finally {
        Restore-SbEnvironment -Previous $previous
    }
}

try {
    New-Item -ItemType Directory -Path $workspace | Out-Null
    $databaseBackupDirectory = Join-Path $workspace 'database-backup'
    $tariffSourceDirectory = Join-Path $workspace 'tariff-source'
    $tariffBackupDirectory = Join-Path $workspace 'tariff-backup'
    $tariffRestoreDirectory = Join-Path $workspace 'tariff-restored'
    New-Item -ItemType Directory -Path $databaseBackupDirectory | Out-Null

    $javaRuntime = Resolve-SbJavaRuntime -RequestedHome $JavaHome
    $postgresTools = Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
    Write-Host 'Starting isolated PostgreSQL 17 source and restore target...'
    $sourceCluster = Start-SbIsolatedPostgres -Tools $postgresTools
    $targetCluster = Start-SbIsolatedPostgres -Tools $postgresTools
    Assert-SbBackupRestorePair -Source $sourceCluster -Target $targetCluster
    Assert-SbDisposableClusterIdentity -Cluster $sourceCluster
    Assert-SbDisposableClusterIdentity -Cluster $targetCluster

    Write-Host 'Applying Flyway V1-V9 to the isolated source...'
    Invoke-A13Migration -Cluster $sourceCluster -JavaRuntime $javaRuntime `
        -TariffDirectory $tariffSourceDirectory

    Write-Host 'Creating relational and UKOME tariff fixtures...'
    $seedFile = Join-Path $workspace 'seed.sql'
    [System.IO.File]::WriteAllText($seedFile, @'
insert into province (id, code, name) overriding system value values (1, '34', 'Istanbul');
insert into district (id, province_id, name) overriding system value values
    (1, 1, 'Kadikoy'),
    (2, 1, 'Uskudar');
insert into neighborhood (id, district_id, name) overriding system value values
    (1, 1, 'A-13 School Neighborhood'),
    (2, 2, 'A-13 Pickup Neighborhood');
insert into school (id, neighborhood_id, name, address, source_name, source_code, is_active)
values ('00000000-0000-0000-0000-000000000101', 1, 'A-13 Recovery School',
        'Disposable source only', 'A13', 'SCHOOL-1', true);
insert into app_user (id, email, password_hash, role, is_enabled, email_verified_at)
values
    ('00000000-0000-0000-0000-000000000201', 'operator-a13@example.invalid', 'not-used-in-a13',
     'OPERATOR', true, now()),
    ('00000000-0000-0000-0000-000000000202', 'admin-a13@example.invalid', 'not-used-in-a13',
     'ADMIN', true, now());
insert into operator_profile
    (id, user_id, business_name, contact_phone, description, approval_status, is_active, is_publicly_visible)
values
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201',
     null, '+905551234567', 'A-13 restored operator', 'APPROVED', true, true);
insert into operator_application_review (id, operator_id, reviewed_by, decision, reason)
values
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000301',
     '00000000-0000-0000-0000-000000000202', 'APPROVED', null);
insert into operator_school (id, operator_id, school_id, is_active)
values
    ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301',
     '00000000-0000-0000-0000-000000000101', true);
insert into operator_school_coverage (id, operator_school_id, neighborhood_id)
values
    ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000401', 2);
insert into vehicle (id, operator_id, plate, capacity, is_active)
values
    ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301',
     '34A1301', 16, true);
insert into service_offering
    (id, operator_school_id, vehicle_id, available_seats, description, is_published)
values
    ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000401',
     '00000000-0000-0000-0000-000000000501', 4, 'A-13 restored offering', true);
insert into service_offering_coverage (id, service_offering_id, operator_school_coverage_id)
values
    ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000601',
     '00000000-0000-0000-0000-000000000402');
'@)
    $null = Invoke-SbPsql -Cluster $sourceCluster -Database $sourceCluster.Database `
        -Username $sourceCluster.RuntimeUser -Password $sourceCluster.RuntimePassword -File $seedFile
    Invoke-A13TariffHarness -Action 'seed' -Directory $tariffSourceDirectory `
        -JavaRuntime $javaRuntime

    Write-Host 'Creating and inspecting the custom-format PostgreSQL archive...'
    $archive = Join-Path $databaseBackupDirectory 'servisimibul-public.pgdump'
    $dumpArguments = @(
        '--format=custom', '--compress=9', '--schema=public',
        '--host=127.0.0.1', "--port=$($sourceCluster.Port)",
        "--username=$($sourceCluster.AdminUser)", "--dbname=$($sourceCluster.Database)",
        "--file=$archive"
    )
    $null = Invoke-A13NativePostgresCommand -Executable $postgresTools.PgDump `
        -Arguments $dumpArguments -Password $sourceCluster.AdminPassword `
        -FailureMessage 'pg_dump failed for the disposable source.'
    $archiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
    $archiveList = @(Invoke-A13NativePostgresCommand -Executable $postgresTools.PgRestore `
        -Arguments @('--list', $archive) -Password $sourceCluster.AdminPassword `
        -FailureMessage 'pg_restore could not inspect the A-13 archive.')
    if (($archiveList -join [Environment]::NewLine) -notmatch 'TABLE DATA public service_offering_coverage') {
        throw 'The database archive does not contain the expected V8 table data entry.'
    }

    Write-Host 'Backing up and validating the independent tariff volume...'
    $sourceTariffManifest = @(Get-SbFileManifest -Root $tariffSourceDirectory)
    Copy-A13DirectoryContents -Source $tariffSourceDirectory -Destination $tariffBackupDirectory
    Assert-SbFileManifest -Root $tariffBackupDirectory -Expected $sourceTariffManifest
    $manifestPath = Join-Path $workspace 'tariff-manifest.json'
    [System.IO.File]::WriteAllText(
        $manifestPath,
        ($sourceTariffManifest | ConvertTo-Json -Depth 4)
    )

    Write-Host 'Restoring into the second isolated PostgreSQL target...'
    Assert-SbBackupRestorePair -Source $sourceCluster -Target $targetCluster
    Assert-SbDisposableClusterIdentity -Cluster $targetCluster
    $existingPublicTables = @(
        @(Invoke-SbPsql -Cluster $targetCluster -Database $targetCluster.Database `
            -Username $targetCluster.AdminUser -Password $targetCluster.AdminPassword `
            -Sql "select tablename from pg_tables where schemaname = 'public';") |
            ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }
    )
    if ($existingPublicTables.Count -ne 0) {
        throw 'The disposable restore target public schema is not empty.'
    }
    # A custom-format schema archive contains CREATE SCHEMA public. The exact target
    # identity and empty inventory are re-verified immediately before this disposable-only reset.
    $null = Invoke-SbPsql -Cluster $targetCluster -Database $targetCluster.Database `
        -Username $targetCluster.AdminUser -Password $targetCluster.AdminPassword `
        -Sql 'drop schema public;'
    $restoreArguments = @(
        '--exit-on-error', '--single-transaction', '--no-owner',
        '--host=127.0.0.1', "--port=$($targetCluster.Port)",
        "--username=$($targetCluster.AdminUser)", "--dbname=$($targetCluster.Database)",
        $archive
    )
    $null = Invoke-A13NativePostgresCommand -Executable $postgresTools.PgRestore `
        -Arguments $restoreArguments -Password $targetCluster.AdminPassword `
        -FailureMessage 'pg_restore failed for the disposable target.'
    Assert-SbDisposableClusterIdentity -Cluster $targetCluster

    Write-Host 'Verifying Flyway history, inventory, RLS, grants, and restored relationships...'
    $verificationOutput = @(Invoke-SbPsql -Cluster $targetCluster -Database $targetCluster.Database `
        -Username $targetCluster.AdminUser -Password $targetCluster.AdminPassword `
        -File $migrationVerification)
    $verificationText = $verificationOutput -join [Environment]::NewLine
    $passCount = @($verificationOutput | Where-Object { $_.ToString() -match '\|PASS\|' }).Count
    if ($passCount -ne 13 -or $verificationText -match '\|FAIL\|') {
        throw "Migration verification expected 13 PASS rows and no failures.`n$verificationText"
    }
    $relationalRows = @(
        @(Invoke-SbPsql -Cluster $targetCluster -Database $targetCluster.Database `
            -Username $targetCluster.RuntimeUser -Password $targetCluster.RuntimePassword -Sql @'
select count(*) || '|' || count(distinct profile.id) || '|' || count(distinct relationship.id) || '|' ||
       count(distinct coverage.id) || '|' || count(distinct vehicle.id) || '|' ||
       count(distinct offering.id) || '|' || count(distinct offering_coverage.id)
from operator_profile profile
join operator_school relationship on relationship.operator_id = profile.id
join operator_school_coverage coverage on coverage.operator_school_id = relationship.id
join vehicle on vehicle.operator_id = profile.id
join service_offering offering on offering.operator_school_id = relationship.id
                             and offering.vehicle_id = vehicle.id
join service_offering_coverage offering_coverage
  on offering_coverage.service_offering_id = offering.id
 and offering_coverage.operator_school_coverage_id = coverage.id;
'@) | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }
    )
    $relationalEvidence = if ($relationalRows.Count -gt 0) { $relationalRows[-1] } else { '<no row>' }
    if ($relationalEvidence -ne '1|1|1|1|1|1|1') {
        throw "Restored relational fixture verification failed: $relationalEvidence"
    }
    $flywayAccessRejected = $false
    try {
        $null = Invoke-SbPsql -Cluster $targetCluster -Database $targetCluster.Database `
            -Username $targetCluster.RuntimeUser -Password $targetCluster.RuntimePassword `
            -Sql 'select count(*) from flyway_schema_history;'
    } catch {
        $flywayAccessRejected = $_.Exception.Message -match 'permission denied'
    }
    if (-not $flywayAccessRejected) {
        throw 'The restored runtime role could read Flyway history.'
    }

    Write-Host 'Restoring and validating the UKOME tariff volume...'
    Copy-A13DirectoryContents -Source $tariffBackupDirectory -Destination $tariffRestoreDirectory
    Assert-SbFileManifest -Root $tariffRestoreDirectory -Expected $sourceTariffManifest

    $backendPort = Get-SbFreeTcpPort
    $backendOutput = Join-Path $workspace 'backend.out.log'
    $backendError = Join-Path $workspace 'backend.err.log'
    Write-Host 'Starting the backend against the restored database and tariff volume...'
    $backendProcess = Start-A13RestoredBackend -Cluster $targetCluster `
        -JavaRuntime $javaRuntime -TariffDirectory $tariffRestoreDirectory -Port $backendPort `
        -StandardOutput $backendOutput -StandardError $backendError
    try {
        $baseUri = "http://127.0.0.1:$backendPort"
        $null = Wait-A13HttpSuccess -Uri "$baseUri/readyz" -Process $backendProcess
        $provinces = (Wait-A13HttpSuccess -Uri "$baseUri/api/v1/provinces" `
            -Process $backendProcess).Content | ConvertFrom-Json
        if (@($provinces).Count -ne 1 -or $provinces[0].code -ne '34') {
            throw 'The restored backend did not return the database fixture.'
        }
        $operators = (Wait-A13HttpSuccess `
            -Uri "$baseUri/api/v1/operators?schoolId=00000000-0000-0000-0000-000000000101&neighborhoodId=2" `
            -Process $backendProcess).Content | ConvertFrom-Json
        if ($operators.totalElements -ne 1 -or @($operators.content).Count -ne 1) {
            throw 'The restored backend did not return the relational discovery fixture.'
        }
        $tariff = (Wait-A13HttpSuccess -Uri "$baseUri/api/v1/tariffs?provinceCode=34" `
            -Process $backendProcess).Content | ConvertFrom-Json
        if ($tariff.version -ne 'a13-v2') {
            throw 'The restored backend did not validate the expected UKOME tariff version.'
        }
    } catch {
        $errorTail = Get-Content -LiteralPath $backendError -Tail 40 -ErrorAction SilentlyContinue
        if ($errorTail) {
            Write-Host ($errorTail -join [Environment]::NewLine)
        }
        throw
    } finally {
        Stop-SbProcessTree -Process $backendProcess
        $backendProcess = $null
    }

    Write-Host 'Verifying tariff rollback creates a new immutable version...'
    Invoke-A13TariffHarness -Action 'verify-and-rollback' -Directory $tariffRestoreDirectory `
        -JavaRuntime $javaRuntime
    $rollbackManifest = @(Get-SbFileManifest -Root $tariffRestoreDirectory)

    if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
        $EvidencePath = Join-Path $backendDirectory 'target\a13-backup-restore-evidence.json'
    }
    $evidenceDirectory = Split-Path -Parent $EvidencePath
    if (-not (Test-Path -LiteralPath $evidenceDirectory)) {
        New-Item -ItemType Directory -Path $evidenceDirectory | Out-Null
    }
    $finishedAt = [DateTimeOffset]::UtcNow
    $evidence = [ordered]@{
        task = 'A-13'
        result = 'PASS'
        startedAtUtc = $startedAt.ToString('o')
        finishedAtUtc = $finishedAt.ToString('o')
        durationSeconds = [math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
        postgresMajor = 17
        archiveSha256 = $archiveHash
        migrationChecksPassed = $passCount
        relationalFixture = $relationalEvidence
        runtimeFlywayAccessRejected = $flywayAccessRejected
        backendReady = $true
        publicDiscoveryCount = 1
        restoredTariffVersion = 'a13-v2'
        tariffBackupFiles = $sourceTariffManifest.Count
        tariffRollbackVersion = 'a13-rollback-v1'
        tariffFilesAfterRollback = $rollbackManifest.Count
        sourceAndTargetWereDisposableLoopbackInstances = $true
        sharedDatabaseTouched = $false
    }
    [System.IO.File]::WriteAllText($EvidencePath, ($evidence | ConvertTo-Json -Depth 5))
    Write-Host "A-13 backup/restore verification passed. Evidence: $EvidencePath"
} finally {
    Stop-SbProcessTree -Process $backendProcess
    if ($targetCluster) {
        Stop-SbIsolatedPostgres -Cluster $targetCluster
    }
    if ($sourceCluster) {
        Stop-SbIsolatedPostgres -Cluster $sourceCluster
    }
    Remove-SbA13WorkspaceDirectory -Path $workspace
}
