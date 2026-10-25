[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupEvidencePath,
    [string]$JavaHome,
    [string]$PostgresBin,
    [switch]$SmokeTest,
    [switch]$DemoData,
    [switch]$DemoAdmins
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
$frontendDirectory = Join-Path $repositoryRoot 'servisimibul-frontend'
. (Join-Path $repositoryRoot 'scripts\WindowsDevelopmentSupport.ps1')
. (Join-Path $repositoryRoot 'scripts\BackupRestoreSupport.ps1')
. (Join-Path $repositoryRoot 'scripts\SupabaseMigrationSupport.ps1')
. (Join-Path $repositoryRoot 'scripts\LocalSupabaseSnapshotSupport.ps1')

$backendProcess = $null
$frontendProcess = $null
$cluster = $null

function Invoke-LocalMigration {
    param(
        [Parameter(Mandatory = $true)]$Database,
        [Parameter(Mandatory = $true)]$JavaRuntime,
        [Parameter(Mandatory = $true)][string]$TariffDirectory
    )

    $migrationEnvironment = @{
        JAVA_HOME = $JavaRuntime.Home
        SPRING_PROFILES_ACTIVE = 'migration'
        SB_DB_JDBC_URL = $Database.RuntimeJdbcUrl
        SB_DB_USER = $Database.RuntimeUser
        SB_DB_PASSWORD = $Database.RuntimePassword
        SPRING_DATASOURCE_URL = $Database.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $Database.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $Database.RuntimePassword
        SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
        SPRING_SQL_INIT_MODE = 'never'
        SB_FLYWAY_ENABLED = 'true'
        SB_DB_MIGRATION_JDBC_URL = $Database.AdminJdbcUrl
        SB_DB_MIGRATION_USER = $Database.AdminUser
        SB_DB_MIGRATION_PASSWORD = $Database.AdminPassword
        SPRING_FLYWAY_ENABLED = 'true'
        SPRING_FLYWAY_URL = $Database.AdminJdbcUrl
        SPRING_FLYWAY_USER = $Database.AdminUser
        SPRING_FLYWAY_PASSWORD = $Database.AdminPassword
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
        SB_EMAIL_VERIFICATION_REQUIRED = 'true'
        SB_MAIL_ENABLED = 'false'
        SERVISIMIBUL_EMAIL_ENABLED = 'false'
        SB_MAIL_USERNAME = $null
        SB_MAIL_PASSWORD = $null
        SPRING_MAIL_USERNAME = $null
        SPRING_MAIL_PASSWORD = $null
        SB_TARIFF_STORAGE_DIR = $TariffDirectory
    }
    $previous = Set-SbTemporaryEnvironment -Values $migrationEnvironment
    try {
        Push-Location $backendDirectory
        try {
            & '.\mvnw.cmd' --batch-mode `
                '-Dspring-boot.run.profiles=migration' spring-boot:run
            if ($LASTEXITCODE -ne 0) {
                throw 'The isolated Flyway migration process failed.'
            }
        } finally {
            Pop-Location
        }
    } finally {
        Restore-SbEnvironment -Previous $previous
    }
}
function Wait-ForHttpSuccess {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][System.Diagnostics.Process[]]$Processes,
        [int]$TimeoutSeconds = 120
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        foreach ($process in $Processes) {
            $process.Refresh()
            if ($process.HasExited) {
                throw "A local application process stopped before $Uri became ready."
            }
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

try {
    if ($SmokeTest -or $DemoData -or $DemoAdmins) {
        throw 'Real snapshot mode does not accept synthetic seed, demo admin or smoke fixture flags.'
    }
    if ($SmokeTest -and ($DemoData -or $DemoAdmins)) {
        throw 'SmokeTest uses its own deterministic fixture; do not combine it with DemoData or DemoAdmins.'
    }
    $javaRuntime = Resolve-SbJavaRuntime -RequestedHome $JavaHome
    $nodeRuntime = Resolve-SbNode24Runtime
    $postgresTools = Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
    $viteEntryPoint = Join-Path $frontendDirectory 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteEntryPoint -PathType Leaf)) {
        throw 'Frontend dependencies are missing. Run `npm ci` in servisimibul-frontend first.'
    }

    $archivePath = Assert-SbVerifiedLocalSnapshotArchive -EvidencePath $BackupEvidencePath -RepositoryRoot $repositoryRoot -Tools $postgresTools
    Write-Host 'Starting disposable PostgreSQL 17 with private production V12 snapshot...'
    $cluster = Start-SbIsolatedPostgres -Tools $postgresTools
    Restore-SbV12SnapshotToDisposable -Cluster $cluster -ArchivePath $archivePath
    $tariffDirectory = Join-Path $cluster.Root 'tariffs'
    New-Item -ItemType Directory -Path $tariffDirectory | Out-Null

    Write-Host 'Applying Flyway migrations in an isolated one-shot process...'
    Invoke-LocalMigration -Database $cluster -JavaRuntime $javaRuntime `
        -TariffDirectory $tariffDirectory

    Assert-SbDisposableClusterIdentity -Cluster $cluster
    $version=@(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql 'SELECT max(version::int) FROM public.flyway_schema_history WHERE success;' | Select-Object -Last 1)
    if ($version.Count -ne 1 -or [string]$version[0] -cne '15') { throw 'Disposable migration did not reach Flyway V15.' }
    Write-Host 'Disposable snapshot Flyway V15 verified.'
    if ($SmokeTest) {
        $null = Invoke-SbPsql -Cluster $cluster -Database $cluster.Database `
            -Username $cluster.RuntimeUser -Password $cluster.RuntimePassword `
            -Sql "insert into province (code, name) values ('34', 'Istanbul')"
    }

    if ($DemoData) {
        Write-Host 'Loading disposable synthetic school geography...'
        $fixturePath = Join-Path $repositoryRoot 'scripts\fixtures\j05\seed.sql'
        $null = Invoke-SbPsql -Cluster $cluster -Database $cluster.Database `
            -Username $cluster.RuntimeUser -Password $cluster.RuntimePassword -File $fixturePath
    }

    $runtimeEnvironment = @{
        JAVA_HOME = $javaRuntime.Home
        SPRING_PROFILES_ACTIVE = 'local'
        SB_DB_JDBC_URL = $cluster.RuntimeJdbcUrl
        SB_DB_USER = $cluster.RuntimeUser
        SB_DB_PASSWORD = $cluster.RuntimePassword
        SPRING_DATASOURCE_URL = $cluster.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $cluster.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $cluster.RuntimePassword
        SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
        SPRING_SQL_INIT_MODE = 'never'
        SB_FLYWAY_ENABLED = 'false'
        SB_DEMAND_FEEDBACK_SCHEDULER_ENABLED = 'false'
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
        SB_EMAIL_VERIFICATION_REQUIRED = 'false'
        APP_AUTH_EMAIL_VERIFICATION_REQUIRED = 'false'
        OPERATOR_APPROVAL_REQUIRED = 'false'
        APP_OPERATOR_APPROVAL_REQUIRED = 'false'
        SB_MAIL_ENABLED = 'false'
        SERVISIMIBUL_EMAIL_ENABLED = 'false'
        SB_MAIL_USERNAME = $null
        SB_MAIL_PASSWORD = $null
        SPRING_MAIL_USERNAME = $null
        SPRING_MAIL_PASSWORD = $null
        SB_TARIFF_STORAGE_DIR = $tariffDirectory
        SERVISIMIBUL_TARIFF_STORAGE_DIR = $tariffDirectory
        SERVER_ADDRESS = '127.0.0.1'
        SERVER_PORT = '8080'
    }
    if ($DemoAdmins) {
        Write-Host 'Bootstrapping disposable ADMIN identities in a non-web process...'
        $adminOnePassword = New-SbRandomPassword
        $adminTwoPassword = New-SbRandomPassword
        $adminEnvironment = $runtimeEnvironment.Clone()
        $adminEnvironment['SB_ADMIN_BOOTSTRAP_ENABLED'] = 'true'
        $adminEnvironment['SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED'] = 'true'
        $adminEnvironment['SB_ADMIN_1_EMAIL'] = 'demo-admin-one@example.test'
        $adminEnvironment['SB_ADMIN_1_PASSWORD'] = $adminOnePassword
        $adminEnvironment['SB_ADMIN_2_EMAIL'] = 'demo-admin-two@example.test'
        $adminEnvironment['SB_ADMIN_2_PASSWORD'] = $adminTwoPassword
        $adminEnvironment['SB_DEMAND_FEEDBACK_SCHEDULER_ENABLED'] = 'false'
        $previousAdminEnvironment = Set-SbTemporaryEnvironment -Values $adminEnvironment
        try {
            Push-Location $backendDirectory
            try {
                & '.\mvnw.cmd' --batch-mode '-Dspring-boot.run.profiles=local' `
                    '-Dspring-boot.run.arguments=--spring.main.web-application-type=none' spring-boot:run
                if ($LASTEXITCODE -ne 0) {
                    throw 'Disposable non-web ADMIN bootstrap failed.'
                }
            } finally {
                Pop-Location
            }
        } finally {
            Restore-SbEnvironment -Previous $previousAdminEnvironment
        }
        Write-Host 'Disposable demo administrator 1: demo-admin-one@example.test'
        Write-Host "Temporary password 1: $adminOnePassword"
        Write-Host 'Disposable demo administrator 2: demo-admin-two@example.test'
        Write-Host "Temporary password 2: $adminTwoPassword"
        Write-Host 'These demo credentials are valid only while this disposable environment is running.'
    }

    $mavenRuntime = Get-SbMavenRuntime -BackendDirectory $backendDirectory
    $previousRuntimeEnvironment = Set-SbTemporaryEnvironment -Values $runtimeEnvironment
    try {
        $backendProcess = Start-Process -FilePath $javaRuntime.Java -ArgumentList @(
            "-Dmaven.home=$($mavenRuntime.Home)",
            "-Dclassworlds.conf=$(Join-Path $mavenRuntime.Home 'bin\m2.conf')",
            "-Dmaven.multiModuleProjectDirectory=$backendDirectory",
            '-classpath', $mavenRuntime.Launcher,
            'org.codehaus.plexus.classworlds.launcher.Launcher',
            'spring-boot:run'
        ) -WorkingDirectory $backendDirectory -NoNewWindow -PassThru
    } finally {
        Restore-SbEnvironment -Previous $previousRuntimeEnvironment
    }

    Write-Host 'Waiting for backend readiness before starting frontend...'
    $null = Wait-ForHttpSuccess -Uri 'http://127.0.0.1:8080/readyz' -Processes @($backendProcess)

    # Verify the HTTP API actually serves the real restored geography.
    $provincesResponse=Wait-ForHttpSuccess -Uri 'http://127.0.0.1:8080/api/v1/provinces' -Processes @($backendProcess)
    $provinces=Convert-SbGeographyApiArray -Json ([string]$provincesResponse.Content) -Label 'Province'
    $istanbul=@($provinces | Where-Object { $_.name -ceq 'İstanbul' })
    if($istanbul.Length -ne 1) { throw 'Real snapshot API does not expose Istanbul.' }
    $districtsResponse=Wait-ForHttpSuccess -Uri ("http://127.0.0.1:8080/api/v1/districts?provinceId="+$istanbul[0].id) -Processes @($backendProcess)
    $districts=Convert-SbGeographyApiArray -Json ([string]$districtsResponse.Content) -Label 'District'
    $geography=Assert-SbRealGeographyResponses -Provinces $provinces -Districts $districts
    Write-Host ("Real API geography verified: Istanbul ID {0}, {1} districts." -f $geography.ProvinceId,$geography.DistrictCount)

    $previousFrontendEnvironment = Set-SbTemporaryEnvironment -Values @{
        VITE_EMAIL_VERIFICATION_REQUIRED = 'false'
    }
    try {
        $frontendProcess = Start-Process -FilePath $nodeRuntime.Node `
            -ArgumentList @($viteEntryPoint, '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
            -WorkingDirectory $frontendDirectory -NoNewWindow -PassThru
    } finally {
        Restore-SbEnvironment -Previous $previousFrontendEnvironment
    }

    Write-Host "Using Java $($javaRuntime.Major), Node.js $($nodeRuntime.Version), and real V12 data in a disposable V15 PostgreSQL 17."
    Write-Host 'Frontend: http://127.0.0.1:5173'
    Write-Host 'Backend:  http://127.0.0.1:8080'

    if ($SmokeTest) {
        $processes = @($backendProcess, $frontendProcess)
        $null = Wait-ForHttpSuccess -Uri 'http://127.0.0.1:8080/readyz' -Processes $processes
        $null = Wait-ForHttpSuccess -Uri 'http://127.0.0.1:5173/' -Processes $processes
        $proxyResponse = Wait-ForHttpSuccess `
            -Uri 'http://127.0.0.1:5173/api/v1/provinces' -Processes $processes
        $provinces = $proxyResponse.Content | ConvertFrom-Json
        if (@($provinces).Count -ne 1 -or $provinces[0].code -ne '34') {
            throw 'The full-stack proxy smoke test did not return the disposable database fixture.'
        }
        Write-Host 'A-12 full-stack smoke test passed.'
    } else {
        Write-Host 'Press Ctrl+C to stop applications and delete the disposable copy. Changes are temporary, NOT written to shared Supabase.'
        while ($true) {
            Start-Sleep -Milliseconds 500
            $backendProcess.Refresh()
            $frontendProcess.Refresh()
            if ($backendProcess.HasExited) {
                throw 'Backend stopped. See its output above.'
            }
            if ($frontendProcess.HasExited) {
                throw 'Frontend stopped. See its output above.'
            }
        }
    }
} finally {
    Write-Host 'Stopping local processes and deleting disposable state...'
    Stop-SbProcessTree -Process $frontendProcess
    Stop-SbProcessTree -Process $backendProcess
    if ($cluster) {
        Stop-SbIsolatedPostgres -Cluster $cluster
    }
}
