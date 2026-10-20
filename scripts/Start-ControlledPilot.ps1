[CmdletBinding()]
param(
    [string]$JavaHome,
    [string]$PostgresBin,
    [switch]$SmokeTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
$frontendDirectory = Join-Path $repositoryRoot 'servisimibul-frontend'
$fixtureDirectory = Join-Path $PSScriptRoot 'fixtures\j05'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')

$backendProcess = $null
$frontendProcess = $null
$cluster = $null

function Invoke-J05Migration {
    param($Database, $JavaRuntime, [string]$TariffDirectory)

    $environment = @{
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
        SPRING_FLYWAY_ENABLED = 'true'
        SB_DB_MIGRATION_JDBC_URL = $Database.AdminJdbcUrl
        SB_DB_MIGRATION_USER = $Database.AdminUser
        SB_DB_MIGRATION_PASSWORD = $Database.AdminPassword
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
    $previous = Set-SbTemporaryEnvironment -Values $environment
    try {
        Push-Location $backendDirectory
        try {
            & '.\mvnw.cmd' --batch-mode '-Dspring-boot.run.profiles=migration' spring-boot:run
            if ($LASTEXITCODE -ne 0) { throw 'J-05 migration process failed.' }
        } finally { Pop-Location }
    } finally { Restore-SbEnvironment -Previous $previous }
}

function Invoke-J05ParentBootstrap {
    param($Database, $JavaRuntime, [string]$TariffDirectory, [string]$Email, [string]$Password)

    $environment = @{
        JAVA_HOME = $JavaRuntime.Home
        SPRING_PROFILES_ACTIVE = 'local'
        SB_DB_JDBC_URL = $Database.RuntimeJdbcUrl
        SB_DB_USER = $Database.RuntimeUser
        SB_DB_PASSWORD = $Database.RuntimePassword
        SPRING_DATASOURCE_URL = $Database.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $Database.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $Database.RuntimePassword
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
        SB_ADMIN_1_EMAIL = $null
        SB_ADMIN_1_PASSWORD = $null
        SB_ADMIN_2_EMAIL = $null
        SB_ADMIN_2_PASSWORD = $null
        SB_DEMO_PARENT_BOOTSTRAP_ENABLED = 'true'
        SB_TEST_DB_DISPOSABLE = 'true'
        SB_DEMO_PARENT_EMAIL = $Email
        SB_DEMO_PARENT_PASSWORD = $Password
        SB_MAIL_ENABLED = 'false'
        SB_MAIL_USERNAME = $null
        SB_MAIL_PASSWORD = $null
        SPRING_MAIL_USERNAME = $null
        SPRING_MAIL_PASSWORD = $null
        SB_TARIFF_STORAGE_DIR = $TariffDirectory
    }
    $previous = Set-SbTemporaryEnvironment -Values $environment
    try {
        Push-Location $backendDirectory
        try {
            & '.\mvnw.cmd' --batch-mode '-Dspring-boot.run.profiles=local' `
                '-Dspring-boot.run.arguments=--spring.main.web-application-type=none' spring-boot:run
            if ($LASTEXITCODE -ne 0) { throw 'J-05 parent bootstrap process failed.' }
        } finally { Pop-Location }
    } finally { Restore-SbEnvironment -Previous $previous }
}

function Wait-J05HttpSuccess {
    param([string]$Uri, [System.Diagnostics.Process[]]$Processes, [int]$TimeoutSeconds = 120)
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        foreach ($process in $Processes) {
            $process.Refresh()
            if ($process.HasExited) { throw "A J-05 process stopped before $Uri became ready." }
        }
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return $response }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    throw "Timed out waiting for $Uri."
}

try {
    $javaRuntime = Resolve-SbJavaRuntime -RequestedHome $JavaHome
    $nodeRuntime = Resolve-SbNode24Runtime
    $postgresTools = Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
    $viteEntryPoint = Join-Path $frontendDirectory 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteEntryPoint -PathType Leaf)) {
        throw 'Frontend dependencies are missing. Run `npm ci` in servisimibul-frontend first.'
    }

    Write-Host 'Starting a disposable PostgreSQL 17 environment for J-05...'
    $cluster = Start-SbIsolatedPostgres -Tools $postgresTools
    $tariffDirectory = Join-Path $cluster.Root 'tariffs'
    Copy-Item -LiteralPath (Join-Path $fixtureDirectory 'tariffs') -Destination $tariffDirectory -Recurse
    Invoke-J05Migration -Database $cluster -JavaRuntime $javaRuntime -TariffDirectory $tariffDirectory
    $null = Invoke-SbPsql -Cluster $cluster -Database $cluster.Database `
        -Username $cluster.RuntimeUser -Password $cluster.RuntimePassword `
        -File (Join-Path $fixtureDirectory 'seed.sql')
    $parentEmail = 'j05.parent@example.test'
    $parentPassword = New-SbRandomPassword
    Invoke-J05ParentBootstrap -Database $cluster -JavaRuntime $javaRuntime `
        -TariffDirectory $tariffDirectory -Email $parentEmail -Password $parentPassword

    $backendPort = Get-SbFreeTcpPort
    $frontendPort = Get-SbFreeTcpPort
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
        SPRING_FLYWAY_ENABLED = 'false'
        SB_DB_MIGRATION_JDBC_URL = $null
        SB_DB_MIGRATION_USER = $null
        SB_DB_MIGRATION_PASSWORD = $null
        SPRING_FLYWAY_URL = $null
        SPRING_FLYWAY_USER = $null
        SPRING_FLYWAY_PASSWORD = $null
        SB_ADMIN_BOOTSTRAP_ENABLED = 'false'
        SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED = 'false'
        SB_DEMO_PARENT_BOOTSTRAP_ENABLED = 'false'
        SB_DEMO_PARENT_EMAIL = $null
        SB_DEMO_PARENT_PASSWORD = $null
        SB_ADMIN_1_EMAIL = $null
        SB_ADMIN_1_PASSWORD = $null
        SB_ADMIN_2_EMAIL = $null
        SB_ADMIN_2_PASSWORD = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL = $null
        SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD = $null
        SB_COOKIE_SECURE = 'false'
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
        SERVER_PORT = [string]$backendPort
    }
    $mavenRuntime = Get-SbMavenRuntime -BackendDirectory $backendDirectory
    $previous = Set-SbTemporaryEnvironment -Values $runtimeEnvironment
    try {
        $backendProcess = Start-Process -FilePath $javaRuntime.Java -ArgumentList @(
            "-Dmaven.home=$($mavenRuntime.Home)",
            "-Dclassworlds.conf=$(Join-Path $mavenRuntime.Home 'bin\m2.conf')",
            "-Dmaven.multiModuleProjectDirectory=$backendDirectory",
            '-classpath', $mavenRuntime.Launcher,
            'org.codehaus.plexus.classworlds.launcher.Launcher',
            'spring-boot:run'
        ) -WorkingDirectory $backendDirectory -NoNewWindow -PassThru
    } finally { Restore-SbEnvironment -Previous $previous }

    $previous = Set-SbTemporaryEnvironment -Values @{
        BACKEND_PROXY_TARGET = "http://127.0.0.1:$backendPort"
        VITE_EMAIL_VERIFICATION_REQUIRED = 'false'
    }
    try {
        $frontendProcess = Start-Process -FilePath $nodeRuntime.Node -ArgumentList @(
            $viteEntryPoint, '--host', '127.0.0.1', '--port', [string]$frontendPort, '--strictPort'
        ) -WorkingDirectory $frontendDirectory -NoNewWindow -PassThru
    } finally { Restore-SbEnvironment -Previous $previous }

    $processes = @($backendProcess, $frontendProcess)
    $null = Wait-J05HttpSuccess -Uri "http://127.0.0.1:$backendPort/readyz" -Processes $processes
    $null = Wait-J05HttpSuccess -Uri "http://127.0.0.1:$frontendPort/" -Processes $processes
    $schools = Wait-J05HttpSuccess `
        -Uri "http://127.0.0.1:$frontendPort/api/v1/schools?provinceId=34&page=0&size=10" `
        -Processes $processes
    if (($schools.Content | ConvertFrom-Json).content.Count -ne 3) {
        throw 'J-05 smoke check did not find all three synthetic schools.'
    }

    Write-Host "J-05 controlled pilot is ready at http://127.0.0.1:$frontendPort"
    Write-Host 'All state is synthetic and will be deleted when this command stops.'
    if ($SmokeTest) {
        Write-Host 'J-05 controlled-pilot smoke test passed.'
    } else {
        Write-Host "Synthetic parent email: $parentEmail"
        Write-Host "Synthetic parent password: $parentPassword"
        Write-Host 'Use docs/14_CONTROLLED_PILOT_UAT.md. Press Ctrl+C after the supervised session.'
        while ($true) {
            Start-Sleep -Milliseconds 500
            foreach ($process in $processes) {
                $process.Refresh()
                if ($process.HasExited) { throw 'A J-05 process stopped unexpectedly.' }
            }
        }
    }
} finally {
    Write-Host 'Stopping J-05 processes and deleting the disposable database, tariff volume, and credentials...'
    Stop-SbProcessTree -Process $frontendProcess
    Stop-SbProcessTree -Process $backendProcess
    if ($cluster) { Stop-SbIsolatedPostgres -Cluster $cluster }
}
