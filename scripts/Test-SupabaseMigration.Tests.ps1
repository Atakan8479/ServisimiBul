[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'migrate-supabase.ps1'
$source = Get-Content -Raw -LiteralPath $path
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $path, [ref]$tokens, [ref]$errors
)
if ($errors.Count -ne 0) {
    throw ('Migration launcher has PowerShell syntax errors: ' + $errors.Count)
}
function Assert-SbCondition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}
Assert-SbCondition ($null -ne $ast) 'PowerShell parsing failed.'
Assert-SbCondition ($source.Contains("if (`$Apply) {")) 'Shared apply must be explicitly blocked in this first increment.'
Assert-SbCondition ($source.Contains('BEGIN READ ONLY;')) 'Preflight queries must use read-only transactions.'
Assert-SbCondition ($source.Contains("PGPASSWORD")) 'Preflight must use process-scoped PostgreSQL secret.'
Assert-SbCondition (-not $source.Contains('baselineOnMigrate=true')) 'Unsafe Flyway baseline setting detected.'
Assert-SbCondition (-not $source.Contains('flyway repair')) 'Unsafe Flyway repair detected.'
Assert-SbCondition (-not $source.Contains('pg_dump --')) 'Do not perform an unreviewed backup automatically.'
Assert-SbCondition ($source.Contains('V13/V14')) 'Migration mismatch should be documented.'

# Prove -Apply fails before target/credentials are inspected and without network access.
$previousPassword = Get-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
try {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $caught = $null
    try { & $path -Apply 2>&1 | Out-Null } catch { $caught = $_ }
    Assert-SbCondition ($null -ne $caught) '-Apply did not fail closed.'
    Assert-SbCondition ($caught.Exception.Message -match 'not implemented or authorized') '-Apply failure was not the intended safety gate.'
} finally {
    if ($previousPassword) { $env:PGPASSWORD = $previousPassword.Value }
}
Write-Host 'OPS-01 offline PowerShell syntax and safety tests passed.'
