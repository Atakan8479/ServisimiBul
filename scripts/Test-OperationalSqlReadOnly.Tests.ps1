[CmdletBinding()]
param(
    # Fail instead of skipping when the target database does not have the V22 schema.
    [switch]$RequireV22Schema
)

# Regression coverage for read-only enforcement in the operational SQL that runs against shared Supabase.
# Connection comes from libpq environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
# and must point to a DISPOSABLE PostgreSQL 17 database. Never run this against shared Supabase.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$operationalSql = @(
    (Join-Path $repositoryRoot 'docs/36_V22_VALIDATION.sql'),
    (Join-Path $repositoryRoot 'docs/10_MIGRATION_VERIFICATION.sql')
)
$beginReadOnly = 'begin transaction read only;'

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-TestPsql {
    param([string]$Sql, [string[]]$Arguments = @())
    $file = [IO.Path]::Combine([IO.Path]::GetTempPath(), "sb-readonly-$([Guid]::NewGuid().ToString('N')).sql")
    [IO.File]::WriteAllText($file, $Sql, (New-Object Text.UTF8Encoding($false)))
    # psql errors are expected in negative cases; judge by exit code and output, not by stderr records.
    $ErrorActionPreference = 'Continue'
    try {
        $output = @(& psql --no-psqlrc --set=ON_ERROR_STOP=1 --no-align --tuples-only --field-separator='|' `
                @Arguments --file $file 2>&1 | ForEach-Object { "$_" })
        return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
    } finally {
        Remove-Item -LiteralPath $file -Force
    }
}

function Get-GuardPrefix {
    param([string]$Sql)
    # Everything up to and including the read-only guard block (`$$;` that closes the DO statement).
    $guardEnd = $Sql.IndexOf('$$;', $Sql.IndexOf('do $$'))
    return $Sql.Substring(0, $guardEnd + 3)
}

# Static contract: the first statement opens a read-only transaction and the next one verifies it.
foreach ($path in $operationalSql) {
    $name = Split-Path -Leaf $path
    $sql = [IO.File]::ReadAllText($path)
    $statements = @(($sql -split "`n" | Where-Object { $_.Trim() -and -not $_.TrimStart().StartsWith('--') }))
    Assert-Condition ($statements[0].Trim() -eq $beginReadOnly) "$name must start with '$beginReadOnly'."
    Assert-Condition ($statements[1].Trim() -eq 'do $$') "$name must verify read-only state immediately after BEGIN."
    $guard = Get-GuardPrefix $sql
    Assert-Condition ($guard.Contains("current_setting('transaction_read_only') <> 'on'")) `
        "$name read-only guard must check transaction_read_only."
    Assert-Condition ($guard.Contains('raise exception')) "$name read-only guard must fail closed."
    Assert-Condition (-not ($sql -match '(?im)^\s*commit\s*;')) "$name must never commit."
    Assert-Condition ($sql -match '(?im)^\s*rollback\s*;\s*$') "$name must end its transaction with ROLLBACK."
    Assert-Condition (-not ($sql -match '(?i)PGOPTIONS\s*=')) "$name must not rely on PGOPTIONS."
}
Write-Host 'Static read-only contract: PASS'

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw 'psql is required for the database-backed read-only checks.'
}
$identity = Invoke-TestPsql -Sql 'select current_database();'
Assert-Condition ($identity.ExitCode -eq 0) "Cannot connect to the disposable test database: $($identity.Output -join ' ')"

foreach ($path in $operationalSql) {
    $name = Split-Path -Leaf $path
    $sql = [IO.File]::ReadAllText($path)
    $prefix = Get-GuardPrefix $sql
    $phase = @('--set=phase=post')

    # 1. The guard rejects a session that is not read-only, before any later query runs.
    $writable = Invoke-TestPsql -Sql ($prefix.Replace($beginReadOnly, 'begin;') + "`nselect 'guard-bypassed';`nrollback;") -Arguments $phase
    Assert-Condition ($writable.ExitCode -ne 0) "$name guard accepted a read-write transaction."
    Assert-Condition (($writable.Output -join "`n").Contains('transaction is not read-only')) `
        "$name guard failed for an unexpected reason: $($writable.Output -join ' ')"
    Assert-Condition (-not (($writable.Output -join "`n").Contains('guard-bypassed'))) "$name continued after the guard failed."

    # 2. The guard rejects a session-level read-write default even if the client tried to force one.
    $forced = Invoke-TestPsql -Sql ("set default_transaction_read_only = off;`n" + $prefix + "`nselect current_setting('transaction_read_only');`nrollback;") -Arguments $phase
    Assert-Condition ($forced.ExitCode -eq 0) "$name failed although its own BEGIN is read-only: $($forced.Output -join ' ')"
    Assert-Condition ($forced.Output -contains 'on') "$name did not run in a read-only transaction."

    # 3. A write after the guard is rejected by PostgreSQL and leaves nothing behind.
    $probe = "sb_readonly_probe_$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
    $write = Invoke-TestPsql -Sql ($prefix + "`ncreate table public.$probe (id integer);`nrollback;") -Arguments $phase
    Assert-Condition ($write.ExitCode -ne 0) "$name allowed a write inside its transaction."
    Assert-Condition (($write.Output -join "`n").Contains('read-only transaction')) `
        "$name write was rejected for an unexpected reason: $($write.Output -join ' ')"
    $exists = Invoke-TestPsql -Sql "select to_regclass('public.$probe') is null;"
    Assert-Condition ($exists.Output -contains 't') "$name write probe left table $probe behind."
}
Write-Host 'Database-backed read-only enforcement: PASS'

# 4. The full V22 post-validation runs read-only and reports only passing checks on a V22 database.
$hasV22 = Invoke-TestPsql -Sql "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vehicle' and column_name = 'usage_history_complete');"
if ($hasV22.Output -notcontains 't') {
    if ($RequireV22Schema) { throw 'The disposable test database does not have the V22 schema.' }
    Write-Host 'V22 schema absent: full post-validation skipped.'
    return
}
$validation = Invoke-TestPsql -Sql ([IO.File]::ReadAllText($operationalSql[0])) -Arguments @('--set=phase=post')
Assert-Condition ($validation.ExitCode -eq 0) "V22 post-validation failed: $($validation.Output -join ' ')"
$identityRow = @($validation.Output | Where-Object { $_ -match '^[^|]+\|[^|]+\|[^|]+\|[tf]\|(on|off)$' })
Assert-Condition ($identityRow.Count -eq 1 -and $identityRow[0].EndsWith('|on')) 'V22 validation did not report transaction_read_only=on.'
$checks = @($validation.Output | Where-Object { $_ -match '^[tf]\|' })
$failed = @($checks | Where-Object { $_.StartsWith('f|') })
Assert-Condition ($checks.Count -eq 10) "Expected 10 V22 post-validation checks, found $($checks.Count): $($checks -join '; ')"
Assert-Condition ($failed.Count -eq 0) "V22 post-validation reported failures: $($failed -join '; ')"
Write-Host "V22 post-validation on disposable database: PASS ($($checks.Count)/$($checks.Count))"
