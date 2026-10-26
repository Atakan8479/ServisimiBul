[CmdletBinding()]
param(
    [string]$JavaHome,
    [string]$PostgresBin,
    [string]$Tests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')

$cluster = $null
try {
    $javaRuntime = Resolve-SbJavaRuntime -RequestedHome $JavaHome
    $postgresTools = Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
    $cluster = Start-SbIsolatedPostgres -Tools $postgresTools
    $tariffDirectory = Join-Path $cluster.Root 'tariffs'
    New-Item -ItemType Directory -Path $tariffDirectory | Out-Null

    $testEnvironment = @{
        JAVA_HOME = $javaRuntime.Home
        SPRING_PROFILES_ACTIVE = $null
        SB_TEST_DB_DISPOSABLE = 'true'
        SB_TEST_DATABASE_NAME = $cluster.Database
        SB_TEST_DB_INSTANCE_ID = $cluster.InstanceId
        SB_TEST_DB_ADMIN_JDBC_URL = $cluster.AdminJdbcUrl
        SB_TEST_DB_ADMIN_USER = $cluster.AdminUser
        SB_TEST_DB_ADMIN_PASSWORD = $cluster.AdminPassword
        SB_DB_JDBC_URL = $cluster.RuntimeJdbcUrl
        SB_DB_USER = $cluster.RuntimeUser
        SB_DB_PASSWORD = $cluster.RuntimePassword
        SPRING_DATASOURCE_URL = $cluster.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $cluster.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $cluster.RuntimePassword
        SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
        SPRING_SQL_INIT_MODE = 'never'
        SB_FLYWAY_ENABLED = 'true'
        SPRING_FLYWAY_ENABLED = 'true'
        SPRING_FLYWAY_URL = $cluster.AdminJdbcUrl
        SPRING_FLYWAY_USER = $cluster.AdminUser
        SPRING_FLYWAY_PASSWORD = $cluster.AdminPassword
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
        SB_TARIFF_STORAGE_DIR = $tariffDirectory
        SERVISIMIBUL_TARIFF_STORAGE_DIR = $tariffDirectory
    }
    $previous = Set-SbTemporaryEnvironment -Values $testEnvironment
    try {
        Push-Location $backendDirectory
        try {
            $mavenArguments = @('--batch-mode')
            if ($Tests) {
                $mavenArguments += "-Dtest=$Tests"
                $mavenArguments += 'test'
            } else {
                $mavenArguments += 'verify'
            }
            $wrapper = if ($SbIsWindows) { '.\mvnw.cmd' } else { './mvnw' }
            & $wrapper @mavenArguments
            if ($LASTEXITCODE -ne 0) {
                throw 'Backend verification failed.'
            }
        } finally {
            Pop-Location
        }
    } finally {
        Restore-SbEnvironment -Previous $previous
    }
    Write-Host 'A-12 isolated backend verification passed.'
} finally {
    if ($cluster) {
        Stop-SbIsolatedPostgres -Cluster $cluster
    }
}
