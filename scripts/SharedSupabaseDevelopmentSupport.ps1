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
    try {
        $uri = [Uri]$jdbcUrl.Substring('jdbc:'.Length)
    } catch {
        throw 'SB_DB_JDBC_URL is invalid.'
    }
    if ($uri.Host -in @('localhost', '127.0.0.1', '::1')) {
        throw 'The shared Supabase launcher rejects loopback database targets.'
    }
    if ($uri.Query.TrimStart('?') -notmatch '(^|&)sslmode=require(&|$)') {
        throw 'The shared Supabase JDBC URL must include sslmode=require.'
    }
}
