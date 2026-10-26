[CmdletBinding()]
param(
    [string]$JavaHome,
    [string]$PostgresBin
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
$frontendDirectory = Join-Path $repositoryRoot 'servisimibul-frontend'
$fixtureDirectory = Join-Path $PSScriptRoot 'fixtures\j03'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')

$cluster = $null
$previousEnvironment = $null

function Invoke-J03Maven {
    param(
        [Parameter(Mandatory = $true)][string]$Profile,
        [Parameter(Mandatory = $true)][hashtable]$Environment
    )

    $previous = Set-SbTemporaryEnvironment -Values $Environment
    try {
        Push-Location $backendDirectory
        try {
            $wrapper = if ($IsWindows) { '.\mvnw.cmd' } else { './mvnw' }
            & $wrapper --batch-mode "-Dspring-boot.run.profiles=$Profile" spring-boot:run
            if ($LASTEXITCODE -ne 0) {
                throw "J-03 $Profile process failed."
            }
        } finally {
            Pop-Location
        }
    } finally {
        Restore-SbEnvironment -Previous $previous
    }
}

try {
    $javaRuntime = Resolve-SbJavaRuntime -RequestedHome $JavaHome
    $nodeRuntime = Resolve-SbNode24Runtime
    $postgresTools = Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
    $playwrightCli = Join-Path $frontendDirectory 'node_modules\@playwright\test\cli.js'
    if (-not (Test-Path -LiteralPath $playwrightCli -PathType Leaf)) {
        throw 'Frontend dependencies are missing. Run `npm ci` in servisimibul-frontend first.'
    }

    Write-Host 'Starting a fresh disposable PostgreSQL 17 instance for J-03...'
    $cluster = Start-SbIsolatedPostgres -Tools $postgresTools
    $tariffDirectory = Join-Path $cluster.Root 'tariffs'
    Copy-Item -LiteralPath (Join-Path $fixtureDirectory 'tariffs') `
        -Destination $tariffDirectory -Recurse

    $databaseEnvironment = @{
        JAVA_HOME = $javaRuntime.Home
        SPRING_PROFILES_ACTIVE = 'migration'
        SB_DB_JDBC_URL = $cluster.RuntimeJdbcUrl
        SB_DB_USER = $cluster.RuntimeUser
        SB_DB_PASSWORD = $cluster.RuntimePassword
        SPRING_DATASOURCE_URL = $cluster.RuntimeJdbcUrl
        SPRING_DATASOURCE_USERNAME = $cluster.RuntimeUser
        SPRING_DATASOURCE_PASSWORD = $cluster.RuntimePassword
        SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
        SPRING_SQL_INIT_MODE = 'never'
        SB_TARIFF_STORAGE_DIR = $tariffDirectory
        SERVISIMIBUL_TARIFF_STORAGE_DIR = $tariffDirectory
        SB_MAIL_ENABLED = 'false'
        SERVISIMIBUL_EMAIL_ENABLED = 'false'
        SB_MAIL_USERNAME = $null
        SB_MAIL_PASSWORD = $null
        SPRING_MAIL_USERNAME = $null
        SPRING_MAIL_PASSWORD = $null
    }

    Write-Host 'Applying Flyway migrations with the disposable administrator...'
    $migrationEnvironment = $databaseEnvironment.Clone()
    $migrationEnvironment.SB_FLYWAY_ENABLED = 'true'
    $migrationEnvironment.SPRING_FLYWAY_ENABLED = 'true'
    $migrationEnvironment.SB_DB_MIGRATION_JDBC_URL = $cluster.AdminJdbcUrl
    $migrationEnvironment.SB_DB_MIGRATION_USER = $cluster.AdminUser
    $migrationEnvironment.SB_DB_MIGRATION_PASSWORD = $cluster.AdminPassword
    $migrationEnvironment.SPRING_FLYWAY_URL = $cluster.AdminJdbcUrl
    $migrationEnvironment.SPRING_FLYWAY_USER = $cluster.AdminUser
    $migrationEnvironment.SPRING_FLYWAY_PASSWORD = $cluster.AdminPassword
    $migrationEnvironment.SB_ADMIN_BOOTSTRAP_ENABLED = 'false'
    $migrationEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED = 'false'
    $migrationEnvironment.SB_ADMIN_1_EMAIL = $null
    $migrationEnvironment.SB_ADMIN_1_PASSWORD = $null
    $migrationEnvironment.SB_ADMIN_2_EMAIL = $null
    $migrationEnvironment.SB_ADMIN_2_PASSWORD = $null
    $migrationEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL = $null
    $migrationEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $null
    $migrationEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL = $null
    $migrationEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD = $null
    $migrationEnvironment.SB_EMAIL_VERIFICATION_REQUIRED = 'true'
    $migrationEnvironment.APP_AUTH_EMAIL_VERIFICATION_REQUIRED = 'true'
    Invoke-J03Maven -Profile 'migration' -Environment $migrationEnvironment

    Write-Host 'Loading deterministic synthetic geography and school fixtures...'
    $null = Invoke-SbPsql -Cluster $cluster -Database $cluster.Database `
        -Username $cluster.RuntimeUser -Password $cluster.RuntimePassword `
        -File (Join-Path $fixtureDirectory 'seed.sql')

    $adminPassword = New-SbRandomPassword
    Write-Host 'Creating two synthetic ADMIN identities through the one-shot bootstrap...'
    $bootstrapEnvironment = $databaseEnvironment.Clone()
    $bootstrapEnvironment.SB_FLYWAY_ENABLED = 'false'
    $bootstrapEnvironment.SPRING_FLYWAY_ENABLED = 'false'
    $bootstrapEnvironment.SB_DB_MIGRATION_JDBC_URL = $null
    $bootstrapEnvironment.SB_DB_MIGRATION_USER = $null
    $bootstrapEnvironment.SB_DB_MIGRATION_PASSWORD = $null
    $bootstrapEnvironment.SPRING_FLYWAY_URL = $null
    $bootstrapEnvironment.SPRING_FLYWAY_USER = $null
    $bootstrapEnvironment.SPRING_FLYWAY_PASSWORD = $null
    $bootstrapEnvironment.SB_ADMIN_BOOTSTRAP_ENABLED = 'true'
    $bootstrapEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED = 'true'
    $bootstrapEnvironment.SB_ADMIN_1_EMAIL = 'j03.admin.one@example.test'
    $bootstrapEnvironment.SB_ADMIN_1_PASSWORD = $adminPassword
    $bootstrapEnvironment.SB_ADMIN_2_EMAIL = 'j03.admin.two@example.test'
    $bootstrapEnvironment.SB_ADMIN_2_PASSWORD = $adminPassword
    $bootstrapEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL = 'j03.admin.one@example.test'
    $bootstrapEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $adminPassword
    $bootstrapEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL = 'j03.admin.two@example.test'
    $bootstrapEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD = $adminPassword
    Invoke-J03Maven -Profile 'migration' -Environment $bootstrapEnvironment

    $backendPort = Get-SbFreeTcpPort
    $frontendPort = Get-SbFreeTcpPort
    $parentPassword = New-SbRandomPassword
    $runtimeEnvironment = $databaseEnvironment.Clone()
    $runtimeEnvironment.SPRING_PROFILES_ACTIVE = 'local'
    $runtimeEnvironment.SB_FLYWAY_ENABLED = 'false'
    $runtimeEnvironment.SPRING_FLYWAY_ENABLED = 'false'
    $runtimeEnvironment.SB_DB_MIGRATION_JDBC_URL = $null
    $runtimeEnvironment.SB_DB_MIGRATION_USER = $null
    $runtimeEnvironment.SB_DB_MIGRATION_PASSWORD = $null
    $runtimeEnvironment.SPRING_FLYWAY_URL = $null
    $runtimeEnvironment.SPRING_FLYWAY_USER = $null
    $runtimeEnvironment.SPRING_FLYWAY_PASSWORD = $null
    $runtimeEnvironment.SB_ADMIN_BOOTSTRAP_ENABLED = 'false'
    $runtimeEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED = 'false'
    $runtimeEnvironment.SB_ADMIN_1_EMAIL = $null
    $runtimeEnvironment.SB_ADMIN_1_PASSWORD = $null
    $runtimeEnvironment.SB_ADMIN_2_EMAIL = $null
    $runtimeEnvironment.SB_ADMIN_2_PASSWORD = $null
    $runtimeEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL = $null
    $runtimeEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $null
    $runtimeEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL = $null
    $runtimeEnvironment.SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD = $null
    $runtimeEnvironment.SB_COOKIE_SECURE = 'false'
    $runtimeEnvironment.SB_EMAIL_VERIFICATION_REQUIRED = 'false'
    $runtimeEnvironment.APP_AUTH_EMAIL_VERIFICATION_REQUIRED = 'false'
    $runtimeEnvironment.SB_PARENT_REGISTRATION_ENABLED = 'true'
    $runtimeEnvironment.SB_PARENT_EMAIL_VERIFICATION_REQUIRED = 'false'
    $runtimeEnvironment.OPERATOR_APPROVAL_REQUIRED = 'true'
    $runtimeEnvironment.APP_OPERATOR_APPROVAL_REQUIRED = 'true'
    $runtimeEnvironment.SB_TEST_DB_DISPOSABLE = 'true'
    $runtimeEnvironment.SB_DEMO_PARENT_BOOTSTRAP_ENABLED = 'false'
    $runtimeEnvironment.SB_DEMO_PARENT_EMAIL = $null
    $runtimeEnvironment.SB_DEMO_PARENT_PASSWORD = $null
    $runtimeEnvironment.SERVER_ADDRESS = '127.0.0.1'
... (+29 lines) [see remaining: rtk proxy git show HEAD:scripts/Test-RealFullStack.ps1 | tail -n +165]
