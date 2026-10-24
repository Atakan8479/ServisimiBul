[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
    [string]$MigrationJdbcUrl,
    [string]$MigrationUser,
    [string]$PsqlPath = 'psql.exe',
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# OPS-01 starts with a deliberately read-only implementation.
# Never use the normal runtime .env or silently elevate database privileges.
if ($Apply) {
    throw 'Shared database migration execution is not implemented or authorized. Complete OPS-01 backup/restore evidence and reviewed apply gate first.'
}

function ConvertTo-SbMigrationEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$JdbcUrl,
        [Parameter(Mandatory = $true)][string]$ExpectedProjectRef,
        [Parameter(Mandatory = $true)][string]$User
    )

    if ($JdbcUrl -notmatch '^jdbc:postgresql://') {
        throw 'Migration endpoint must be a PostgreSQL JDBC URL.'
    }
    try {
        $uri = [Uri]$JdbcUrl.Substring(5)
    } catch {
        throw 'Migration JDBC URL is invalid.'
    }
    if ($uri.UserInfo -or $uri.Fragment -or $uri.AbsolutePath -ne '/postgres' -or $uri.Port -ne 5432) {
        throw 'Migration connection must target the postgres database on port 5432 without URL credentials.'
    }
    if ($uri.Query.TrimStart('?') -notmatch '(^|&)sslmode=(require|verify-ca|verify-full)(&|$)') {
        throw 'TLS is required for migration database connections.'
    }

    $direct = 'db.' + $ExpectedProjectRef + '.supabase.co'
    $isDirect = $uri.Host -ceq $direct
    $isPooler = $uri.Host -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$'
    if (-not $isDirect -and -not $isPooler) {
        throw 'Migration host does not match the approved Supabase direct or session-pooler pattern.'
    }
    $expectedUser = if ($isDirect) { 'postgres' } else { 'postgres.' + $ExpectedProjectRef }
    if ($User -cne $expectedUser) {
        throw 'Migration identity does not match the approved direct or session-pooler admin connection.'
    }
    return [pscustomobject]@{
        Host = $uri.Host
        Port = $uri.Port
        Database = 'postgres'
        User = $User
        Mode = if ($isDirect) { 'direct' } else { 'session-pooler' }
    }
}

function Invoke-SbMigrationReadOnlySql {
    param(
        [Parameter(Mandatory = $true)]$Endpoint,
        [Parameter(Mandatory = $true)][string]$Sql,
        [Parameter(Mandatory = $true)][string]$Client
    )

    # The caller supplies PGPASSWORD in its own secret-managed process environment.
    # Neither SQL nor command arguments contain credentials.
    $args = @(
        '--no-psqlrc', '--no-password', '--set=ON_ERROR_STOP=1',
        '--no-align', '--tuples-only', '--quiet',
        '--host', $Endpoint.Host, '--port', [string]$Endpoint.Port,
        '--username', $Endpoint.User, '--dbname', $Endpoint.Database,
        '--command', $Sql
    )
    $output = @(& $Client @args 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw 'Read-only PostgreSQL preflight failed; inspect credentials and target outside this log.'
    }
    return (($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

function Invoke-SbMigrationPreflight {
    param(
        [Parameter(Mandatory = $true)]$Endpoint,
        [Parameter(Mandatory = $true)][string]$Client
    )

    $identity = Invoke-SbMigrationReadOnlySql -Endpoint $Endpoint -Client $Client -Sql @'
BEGIN READ ONLY;
SELECT current_database() || '|' || current_user || '|' || current_setting('server_version_num') || '|' || pg_is_in_recovery();
COMMIT;
'@
    $identityLine = @($identity -split "`n" | Where-Object { $_ -match '^[^|]+\|[^|]+\|[0-9]+\|[tf]$' })
    if ($identityLine.Count -ne 1) { throw 'Could not verify unique PostgreSQL target identity.' }
    $parts = $identityLine[0].Split('|')
    if ($parts[0] -ne 'postgres' -or $parts[1] -cne $Endpoint.User -or
        [int]$parts[2] -lt 170000 -or [int]$parts[2] -ge 180000 -or $parts[3] -ne 'f') {
        throw 'PostgreSQL database, role, server version or primary status does not match the migration contract.'
    }

    $history = Invoke-SbMigrationReadOnlySql -Endpoint $Endpoint -Client $Client -Sql @'
BEGIN READ ONLY;
SELECT CASE WHEN to_regclass('public.flyway_schema_history') IS NULL
  THEN 'missing' ELSE 'present' END;
COMMIT;
'@
    if (@($history -split "`n" | Where-Object { $_ -eq 'present' }).Count -ne 1) {
        throw 'Flyway schema history is missing or ambiguous; refusing to initialize a shared database.'
    }

    $versions = Invoke-SbMigrationReadOnlySql -Endpoint $Endpoint -Client $Client -Sql @'
BEGIN READ ONLY;
SELECT COALESCE(string_agg(version, ',' ORDER BY installed_rank), 'none')
FROM public.flyway_schema_history WHERE version IS NOT NULL AND success;
SELECT count(*) FROM public.flyway_schema_history WHERE NOT success;
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
('content_report','moderation_case','moderation_audit_event','demand_service_feedback');
COMMIT;
'@
    $rows = @($versions -split "`n" | Where-Object { $_ -match '^(none|[0-9]+(,[0-9]+)*|[0-9]+)$' })
    if ($rows.Count -ne 3 -or $rows[0] -cne '1,2,3,4,5,6,7,8,9,10,11,12' -or
        $rows[1] -ne '0' -or $rows[2] -ne '0') {
        throw 'Unexpected Flyway version, failed migration or pending-object collision. Stop for manual review.'
    }

    Write-Host 'Read-only preflight: verified PostgreSQL 17 primary, restricted V12 Flyway history and absent V13/V14 target objects.'
    Write-Host ('Target: ' + $Endpoint.Mode + ', project-scoped host verified, database=postgres.')
    Write-Host 'No schema, row, secret or migration state was changed.'
}

if (-not $ProjectRef -or -not $MigrationJdbcUrl -or -not $MigrationUser) {
    throw 'Provide -ProjectRef, -MigrationJdbcUrl and -MigrationUser. Credentials must come from a secret-managed PGPASSWORD environment.'
}
if (-not $env:PGPASSWORD) {
    throw 'PGPASSWORD is required in the invoking process; never supply passwords in arguments.'
}
$endpoint = ConvertTo-SbMigrationEndpoint -JdbcUrl $MigrationJdbcUrl -ExpectedProjectRef $ProjectRef -User $MigrationUser
Invoke-SbMigrationPreflight -Endpoint $endpoint -Client $PsqlPath
