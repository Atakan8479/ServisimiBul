Set-StrictMode -Version Latest

function Read-SbRuntimeEnvironmentFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing $Path. Copy servisimibul-backend\.env.example to .env and configure it first."
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }

        $separator = $line.IndexOf('=')
        if ($separator -lt 1) {
            throw 'Invalid .env entry. Expected NAME=value.'
        }

        $name = $line.Substring(0, $separator).Trim().TrimStart([char]0xFEFF)
        $value = $line.Substring($separator + 1).Trim()
        if ($name -cnotmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Invalid environment variable name in .env: $name"
        }
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$name] = $value
    }

    # shortcut: the checked-in example uses single-line NAME=value entries.
    return $values
}

function Assert-SbSharedRuntimeEnvironment {
    param([Parameter(Mandatory = $true)][hashtable]$Values)

    foreach ($name in @('SB_DB_JDBC_URL', 'SB_DB_USER', 'SB_DB_PASSWORD')) {
        if (-not $Values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($Values[$name]) -or
            $Values[$name] -like '*replace-with*' -or $Values[$name] -like '*example.supabase.co*') {
            throw "Configure $name in servisimibul-backend\.env before using shared Supabase."
        }
    }

    $user = $Values['SB_DB_USER']
    if ($user -cne 'servisimibul_app' -and -not $user.StartsWith('servisimibul_app.')) {
        throw 'Set SB_DB_USER in servisimibul-backend/.env to servisimibul_app (direct) or servisimibul_app.<project-ref> (session pooler). Check Supabase Connect. Never use postgres for application runtime.'
    }

    $jdbcUrl = $Values['SB_DB_JDBC_URL']
    if (-not $jdbcUrl.StartsWith('jdbc:postgresql://')) {
        throw 'SB_DB_JDBC_URL must be a PostgreSQL JDBC URL.'
    }
    $endpointText = $jdbcUrl.Substring('jdbc:'.Length)
    if ($endpointText -match '\s' -or $endpointText.Contains('<') -or
        $endpointText.Contains('>') -or $endpointText.Contains('$') -or
        $endpointText.Contains('@')) {
        throw 'SB_DB_JDBC_URL contains whitespace, placeholders, or URL credentials. Configure the actual connection URL in servisimibul-backend/.env.'
    }
    try {
        $uri = [Uri]$endpointText
    } catch {
        throw 'SB_DB_JDBC_URL has malformed URI syntax. Expected jdbc:postgresql://aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require.'
    }
    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -cne 'postgresql' -or
        $uri.AbsolutePath -cne '/postgres' -or $uri.Port -ne 5432 -or
        $uri.Host -in @('localhost', '127.0.0.1', '::1')) {
        throw 'SB_DB_JDBC_URL must target a nonlocal PostgreSQL host on port 5432 and database /postgres.'
    }
    if ($uri.Query.TrimStart('?') -notmatch '(^|&)sslmode=require(&|$)') {
        throw 'The shared Supabase JDBC URL must include sslmode=require.'
    }
}

# Restricted runtime may not read Flyway history after V15 by design.
# Check V13/V14 schema presence, V15 privilege hardening, and geography.
function Assert-SbLiveRuntimeV15Result {
    param([Parameter(Mandatory=$true)][string]$Output)
    $lines=@($Output -split "\r?\n" | Where-Object { $_ -like 'SB_LIVE|*' })
    if($lines.Length -ne 1){throw 'Shared database preflight returned no unique status row.'}
    $parts=$lines[0].Trim().Split('|')
    if($parts.Length -ne 8 -or
       $parts[0] -cne 'SB_LIVE' -or
       $parts[1] -cne 'postgres' -or
       $parts[2] -cne 'servisimibul_app' -or
       $parts[3] -cnotmatch '^17[0-9]{4}$' -or
       $parts[4] -cne '5' -or
       $parts[5] -cne 'f' -or
       $parts[6] -cne 'f' -or
       $parts[7] -cne '39') {
        throw 'Shared Supabase is not V15-compatible with restricted runtime rights and 39 districts. Do not start this backend against V12; complete the approved V12-to-V15 migration first.'
    }
    return $true
}

function Assert-SbLiveRuntimeV15 {
    param(
        [Parameter(Mandatory=$true)][hashtable]$Values,
        [string]$PsqlPath
    )
    $endpoint=ConvertTo-SbSupabaseEndpoint -JdbcUrl $Values['SB_DB_JDBC_URL'] -ProjectRef 'whftdzfbvpchmghttjkg' -User $Values['SB_DB_USER'] -Role runtime
    if(-not $PsqlPath){
        $psql=Get-Command psql.exe -ErrorAction SilentlyContinue
        if(-not $psql){$psql=Get-Command psql -ErrorAction SilentlyContinue}
        if(-not $psql){throw 'PostgreSQL psql is required for the read-only shared V15 gate.'}
        $PsqlPath=$psql.Source
    }
    $previous=Get-Item -LiteralPath 'Env:PGPASSWORD' -ErrorAction SilentlyContinue
    try {
        $env:PGPASSWORD=$Values['SB_DB_PASSWORD']
        $output=Invoke-SbMigrationSql -Endpoint $endpoint -Client $PsqlPath -Sql @'
BEGIN TRANSACTION READ ONLY;
SELECT 'SB_LIVE|'||current_database()||'|'||current_user||'|'||
current_setting('server_version_num')||'|'||
(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND
 c.relname IN ('demand_service_feedback','demand_lifecycle_event',
              'content_report','moderation_case','moderation_audit_event'))||'|'||
CASE WHEN has_table_privilege(current_user,'public.flyway_schema_history','SELECT') THEN 't' ELSE 'f' END||'|'||
CASE WHEN has_sequence_privilege(current_user,'public.province_id_seq','UPDATE') THEN 't' ELSE 'f' END||'|'||
(SELECT count(*) FROM public.district);
COMMIT;
'@
    } finally {
        if($previous){$env:PGPASSWORD=$previous.Value}else{Remove-Item -LiteralPath 'Env:PGPASSWORD' -ErrorAction SilentlyContinue}
    }
    $null=Assert-SbLiveRuntimeV15Result -Output $output
    Write-Host 'Live Supabase V15 schema, restricted runtime privileges, and 39 districts verified (read-only).'
}
