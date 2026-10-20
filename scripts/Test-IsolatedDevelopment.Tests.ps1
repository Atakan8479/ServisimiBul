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

Write-Host 'A-12 isolated development safety tests passed.'
