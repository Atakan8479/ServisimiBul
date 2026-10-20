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

Write-Host 'Shared Supabase development launcher tests passed.'
