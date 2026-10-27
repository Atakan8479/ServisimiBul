[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

$firstPassword = New-SbRandomPassword
$secondPassword = New-SbRandomPassword
Assert-Condition ($firstPassword -cmatch '^[A-Za-z0-9]{43}$') `
    'The generated password does not have the expected safe 43-character encoding.'
Assert-Condition ($firstPassword -ne $secondPassword) `
    'Two generated passwords unexpectedly matched.'

$remoteRejected = $false
try {
    Assert-SbLoopbackJdbcUrl `
        -JdbcUrl 'jdbc:postgresql://db.example.supabase.co:5432/servisimibul_a12' `
        -ExpectedDatabase 'servisimibul_a12'
} catch {
    $remoteRejected = $_.Exception.Message -match 'named loopback database'
}
Assert-Condition $remoteRejected 'A remote database URL was not rejected.'

$wrongDatabaseRejected = $false
try {
    Assert-SbLoopbackJdbcUrl `
        -JdbcUrl 'jdbc:postgresql://127.0.0.1:5432/postgres' `
        -ExpectedDatabase 'servisimibul_a12'
} catch {
    $wrongDatabaseRejected = $_.Exception.Message -match 'named loopback database'
}
Assert-Condition $wrongDatabaseRejected 'A different local database was not rejected.'

Assert-SbLoopbackJdbcUrl `
    -JdbcUrl 'jdbc:postgresql://127.0.0.1:55432/servisimibul_a12' `
    -ExpectedDatabase 'servisimibul_a12'

$unsafeDeleteRejected = $false
try {
    Remove-SbIsolatedDirectory -Path $repositoryRoot
} catch {
    $unsafeDeleteRejected = $_.Exception.Message -match 'Refusing to remove'
}
Assert-Condition $unsafeDeleteRejected 'Unsafe cleanup did not fail closed.'

$tempSibling = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/') + '-outside'
$unsafeSiblingRejected = $false
try {
    Remove-SbIsolatedDirectory -Path (Join-Path $tempSibling 'ServisimiBul-A12-fake')
} catch {
    $unsafeSiblingRejected = $_.Exception.Message -match 'Refusing to remove'
}
Assert-Condition $unsafeSiblingRejected 'A temp-prefix sibling path was not rejected.'

$supportSource = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')
Assert-Condition ($supportSource.Contains("if (`$SbIsWindows) { 'java.exe' } else { 'java' }")) `
    'Java discovery does not support the current platform executable name.'
Assert-Condition ($supportSource.Contains("if (`$SbIsWindows) { 'node.exe' } else { 'node' }")) `
    'Node discovery does not support the current platform executable name.'
Assert-Condition ($supportSource.Contains("if (`$SbIsWindows) { '.exe' } else { '' }")) `
    'PostgreSQL discovery does not support the current platform executable suffix.'
Assert-Condition ($supportSource.Contains("Stop-SbIsolatedPostgres -Cluster `$cluster -Mode 'immediate'")) `
    'Failed startup does not use the shared safe PostgreSQL cleanup.'
Assert-Condition (-not $supportSource.Contains('$null = $stopProcess.WaitForExit(15000)')) `
    'PostgreSQL cleanup can still abandon pg_ctl and delete a live cluster.'
Assert-Condition ($supportSource.Contains('-c max_connections=200')) `
    'The disposable PostgreSQL cluster cannot accommodate the complete cached Spring test suite.'

$devSource = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'dev.ps1')
Assert-Condition (-not $devSource.Contains('backendEnvPath')) `
    'dev.ps1 still references the former shared .env loader.'
Assert-Condition (-not $devSource.Contains('Read-EnvironmentFile')) `
    'dev.ps1 still reads the shared backend .env.'
Assert-Condition ($devSource.Contains("SB_DB_USER = `$cluster.RuntimeUser")) `
    'dev.ps1 does not explicitly select the disposable runtime role.'
Assert-Condition ($devSource.Contains("SPRING_DATASOURCE_URL = `$cluster.RuntimeJdbcUrl")) `
    'dev.ps1 does not override an inherited canonical datasource URL.'
Assert-Condition ($devSource.Contains("SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'")) `
    'dev.ps1 does not force Hibernate schema validation.'
Assert-Condition ($devSource.Contains("SERVER_ADDRESS = '127.0.0.1'")) `
    'dev.ps1 does not restrict the backend to loopback.'
Assert-Condition ($devSource.Contains("'--host', '127.0.0.1'")) `
    'dev.ps1 does not restrict the frontend to loopback.'
Assert-Condition ($devSource.Contains('SB_DB_MIGRATION_PASSWORD = $null')) `
    'dev.ps1 does not remove inherited migration credentials from the runtime process.'
Assert-Condition ($devSource.Contains('SPRING_FLYWAY_PASSWORD = $null')) `
    'dev.ps1 does not remove inherited canonical Flyway credentials from the runtime process.'
Assert-Condition ($devSource.Contains('SB_ADMIN_1_PASSWORD = $null')) `
    'dev.ps1 does not remove inherited bootstrap credentials from the runtime process.'
Assert-Condition ($devSource.Contains('SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD = $null')) `
    'dev.ps1 does not remove inherited canonical bootstrap credentials.'
Assert-Condition ($devSource.Contains('SB_MAIL_PASSWORD = $null')) `
    'dev.ps1 does not remove inherited SMTP credentials from the runtime process.'

$runtimeExample = Get-Content -Raw -LiteralPath `
    (Join-Path $repositoryRoot 'servisimibul-backend\.env.example')
Assert-Condition (-not $runtimeExample.Contains('SB_DB_MIGRATION_PASSWORD=')) `
    'The normal runtime example still co-locates migration credentials.'
Assert-Condition (-not $runtimeExample.Contains('SB_ADMIN_1_PASSWORD=')) `
    'The normal runtime example still co-locates ADMIN bootstrap credentials.'
Assert-Condition (Test-Path -LiteralPath `
    (Join-Path $repositoryRoot 'servisimibul-backend\.env.migration.example')) `
    'The controlled migration environment example is missing.'
Assert-Condition (Test-Path -LiteralPath `
    (Join-Path $repositoryRoot 'servisimibul-backend\.env.bootstrap.example')) `
    'The one-shot ADMIN bootstrap environment example is missing.'

$devSource = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'dev.ps1')
Assert-Condition ($devSource.Contains('Waiting for backend readiness before starting frontend')) `
    'Frontend may start before backend readiness.'
Assert-Condition ($devSource.Contains('[switch]$DemoData')) `
    'Opt-in disposable data mode missing.'
Assert-Condition ($devSource.Contains('[switch]$DemoAdmins')) `
    'Opt-in disposable administrator mode missing.'
Assert-Condition ($devSource.Contains('scripts\fixtures\j05\seed.sql')) `
    'Disposable demo geography fixture missing.'
Assert-Condition ($devSource.Contains('spring.main.web-application-type=none')) `
    'Administrator bootstrap must not expose a web server.'

$backendRunner = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'Test-IsolatedBackend.ps1')
Assert-Condition ($backendRunner.Contains("if (`$SbIsWindows) { '.\mvnw.cmd' } else { './mvnw' }")) `
    'The isolated backend runner does not select the platform Maven Wrapper.'

Write-Host 'A-12 isolated development safety tests passed.'
