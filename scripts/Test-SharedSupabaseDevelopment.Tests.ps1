[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'SharedSupabaseDevelopmentSupport.ps1')

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ('ServisimiBul-shared-env-' + [guid]::NewGuid() + '.txt')
try {
    [System.IO.File]::WriteAllText($fixture, @"
# synthetic test values only
SB_DB_JDBC_URL='jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
SB_DB_USER=servisimibul_app.project-ref
SB_DB_PASSWORD="synthetic=password"
"@)
    $values = Read-SbRuntimeEnvironmentFile -Path $fixture
    Assert-SbSharedRuntimeEnvironment -Values $values
    Assert-Condition ($values['SB_DB_PASSWORD'] -ceq 'synthetic=password') `
        'The .env parser did not preserve a value containing an equals sign.'
} finally {
    Remove-Item -LiteralPath $fixture -Force -ErrorAction SilentlyContinue
}

$unsafeRejected = $false
try {
    Assert-SbSharedRuntimeEnvironment -Values @{
        SB_DB_JDBC_URL = 'jdbc:postgresql://127.0.0.1:5432/postgres?sslmode=require'
        SB_DB_USER = 'postgres'
        SB_DB_PASSWORD = 'synthetic'
    }
} catch {
    $unsafeRejected = $true
}
Assert-Condition $unsafeRejected 'An unsafe shared runtime configuration was accepted.'

$launcher = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'dev-supabase.ps1')
foreach ($required in @(
    "SB_FLYWAY_ENABLED'] = 'false'",
    "SPRING_FLYWAY_ENABLED'] = 'false'",
    "SB_ADMIN_BOOTSTRAP_ENABLED'] = 'false'",
    "SERVER_ADDRESS'] = '127.0.0.1'",
    "VITE_EMAIL_VERIFICATION_REQUIRED = 'false'"
)) {
    Assert-Condition ($launcher.Contains($required)) "Shared launcher safety setting missing: $required"
}
Assert-Condition (-not $launcher.Contains('Start-SbIsolatedPostgres')) `
    'The shared launcher still starts disposable PostgreSQL.'
Assert-Condition (-not $launcher.Contains('Invoke-LocalMigration')) `
    'The shared launcher can invoke migrations.'

Assert-Condition ($launcher.Contains('Wait-SbBackendReady -BackendProcess $backendProcess')) `
    'Shared launcher must await backend readiness.'
Assert-Condition ($launcher.Contains('SB_ADMIN_1_PASSWORD')) `
    'Shared launcher must clear admin bootstrap credentials.'
$badUserRejected = $false
try {
    Assert-SbSharedRuntimeEnvironment -Values @{
        SB_DB_JDBC_URL = 'jdbc:postgresql://db.example.internal:5432/postgres?sslmode=require'
        SB_DB_USER = 'postgres'
        SB_DB_PASSWORD = 'synthetic'
    }
} catch {
    $badUserRejected = $_.Exception.Message -match 'SB_DB_USER'
}
Assert-Condition $badUserRejected 'Unsafe role validation must guide the user.'

Write-Host 'Shared Supabase development launcher tests passed.'

. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')
Assert-Condition (Assert-SbLiveRuntimeV15Result -Output 'SB_LIVE|postgres|servisimibul_app|170011|5|f|f|39') 'Valid V15-compatible runtime rejected.'
foreach($bad in @('SB_LIVE|postgres|servisimibul_app|170011|0|t|t|39',
                   'SB_LIVE|postgres|postgres|170011|5|f|f|39',
                   'SB_LIVE|postgres|servisimibul_app|170011|5|f|f|38')) {
    $blocked=$false
    try{$null=Assert-SbLiveRuntimeV15Result -Output $bad}catch{$blocked=$true}
    Assert-Condition $blocked 'V12 or unsafe runtime must fail closed.'
}
$launcher=Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'dev-supabase.ps1')
Assert-Condition ($launcher.Contains('Assert-SbLiveRuntimeV15 -Values $backendEnvironment')) 'Shared backend must run read-only V15 gate.'

# Malformed URL diagnostics must never echo environment values or passwords.
foreach ($url in @(
    'jdbc:postgresql://<HOST>:5432/postgres?sslmode=require',
    'jdbc:postgresql://aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require extra',
    'jdbc:postgresql://aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require'
)) {
    $rejected=$false
    try {
        Assert-SbSharedRuntimeEnvironment -Values @{
            SB_DB_JDBC_URL=$url
            SB_DB_USER='servisimibul_app.whftdzfbvpchmghttjkg'
            SB_DB_PASSWORD='test-only-secret'
        }
    } catch {
        $rejected=$true
        Assert-Condition (-not $_.Exception.Message.Contains('test-only-secret')) 'Connection error leaked a credential.'
    }
    Assert-Condition $rejected 'Malformed JDBC URL must fail closed.'
}
