Set-StrictMode -Version Latest

function Resolve-SbJavaRuntime {
    param([string]$RequestedHome)

    $userJdks = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.jdks'
    $discoveredJdks = if (Test-Path -LiteralPath $userJdks) {
        Get-ChildItem -LiteralPath $userJdks -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object FullName
    } else {
        @()
    }
    $pathJava = Get-Command $(if ($IsWindows) { 'java.exe' } else { 'java' }) `
        -ErrorAction SilentlyContinue
    $pathJavaHome = if ($pathJava) {
        Split-Path -Parent (Split-Path -Parent $pathJava.Source)
    } else {
        $null
    }
    if ($IsMacOS -and (Test-Path -LiteralPath '/usr/libexec/java_home' -PathType Leaf)) {
        $macJavaHome = (& /usr/libexec/java_home 2>$null | Select-Object -First 1)
    } else {
        $macJavaHome = $null
    }
    $candidates = @($RequestedHome, $env:JAVA_HOME, $macJavaHome, $pathJavaHome) + @($discoveredJdks)

    foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        $java = Join-Path $candidate $(if ($IsWindows) { 'bin\java.exe' } else { 'bin/java' })
        if (-not (Test-Path -LiteralPath $java -PathType Leaf)) {
            continue
        }

        $versionLine = (& $java --version 2>&1 | Select-Object -First 1).ToString()
        if ($versionLine -match '^(?:openjdk|java)(?: version)? "?(\d+)') {
            $major = [int]$Matches[1]
            if ($major -ge 21) {
                return [pscustomobject]@{ Home = $candidate; Java = $java; Major = $major }
            }
        }
    }

    throw 'Java 21 or newer was not found. Set JAVA_HOME or pass -JavaHome <jdk-path>.'
}

function Resolve-SbNode24Runtime {
    $nodeCandidates = @()
    $pathNode = Get-Command $(if ($IsWindows) { 'node.exe' } else { 'node' }) `
        -ErrorAction SilentlyContinue
    if ($pathNode) {
        $nodeCandidates += $pathNode.Source
    }

    $nvmRoots = @($env:NVM_HOME)
    $nvmCommand = Get-Command nvm.exe -ErrorAction SilentlyContinue
    if ($nvmCommand) {
        $nvmRoots += Split-Path -Parent $nvmCommand.Source
    }
    foreach ($nvmRoot in ($nvmRoots | Where-Object { $_ } | Select-Object -Unique)) {
        $nodeCandidates += Get-ChildItem -LiteralPath $nvmRoot -Directory -Filter 'v24.*' -ErrorAction SilentlyContinue |
            Sort-Object { [version]$_.Name.TrimStart('v') } -Descending |
            ForEach-Object { Join-Path $_.FullName 'node.exe' }
    }

    foreach ($node in ($nodeCandidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $node -PathType Leaf)) {
            continue
        }
        $version = (& $node --version).TrimStart('v')
        if ([version]$version -ge [version]'24.0.0' -and [version]$version -lt [version]'25.0.0') {
            return [pscustomobject]@{ Node = $node; Version = $version }
        }
    }

    throw 'Node.js 24 was not found. Install it, then run this command again.'
}

function Resolve-SbPostgres17Tools {
    param([string]$PostgresBin)

    $programFiles = [Environment]::GetFolderPath('ProgramFiles')
    $pathPostgres = Get-Command $(if ($IsWindows) { 'postgres.exe' } else { 'postgres' }) `
        -ErrorAction SilentlyContinue
    $pathPostgresBin = if ($pathPostgres) { Split-Path -Parent $pathPostgres.Source } else { $null }
    $candidates = @(
        $PostgresBin,
        $env:SB_POSTGRES_BIN,
        $pathPostgresBin,
        (Join-Path $programFiles 'PostgreSQL\17\bin'),
        (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'scoop\apps\postgresql17\current\bin'),
        (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'scoop\apps\postgresql\current\bin')
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($candidate in $candidates) {
        $executableSuffix = if ($IsWindows) { '.exe' } else { '' }
        $tools = [ordered]@{
            Bin = $candidate
            InitDb = Join-Path $candidate "initdb$executableSuffix"
            PgCtl = Join-Path $candidate "pg_ctl$executableSuffix"
            PgIsReady = Join-Path $candidate "pg_isready$executableSuffix"
            PgDump = Join-Path $candidate "pg_dump$executableSuffix"
            PgRestore = Join-Path $candidate "pg_restore$executableSuffix"
            Postgres = Join-Path $candidate "postgres$executableSuffix"
            Psql = Join-Path $candidate "psql$executableSuffix"
        }
        if (@($tools.Values | Where-Object { $_ -ne $candidate -and -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -gt 0) {
            continue
        }

        try {
            $version = (& $tools.Postgres --version 2>&1 | Select-Object -First 1).ToString()
        } catch {
            continue
        }
        if ($version -match 'PostgreSQL\) 17(?:\.|\s)') {
            return [pscustomobject]$tools
        }
    }

    throw 'PostgreSQL 17 binaries were not found. Install PostgreSQL 17 or pass -PostgresBin <path-to-bin>.'
}

function Get-SbFreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        0
    )
    try {
        $listener.Start()
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    } finally {
        $listener.Stop()
    }
}

function New-SbRandomPassword {
    $bytes = [byte[]]::new(32)
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    return [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'B').TrimEnd('=')
}

function Set-SbTemporaryEnvironment {
    param([hashtable]$Values)

    $previous = @{}
    foreach ($name in $Values.Keys) {
        $existing = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        $previous[$name] = @{
            Exists = $null -ne $existing
            Value = if ($existing) { $existing.Value } else { $null }
        }
        if ($null -eq $Values[$name]) {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        } else {
            Set-Item -LiteralPath "Env:$name" -Value $Values[$name]
        }
    }
    return $previous
}

function Restore-SbEnvironment {
    param([hashtable]$Previous)

    foreach ($name in $Previous.Keys) {
        if ($Previous[$name].Exists) {
            Set-Item -LiteralPath "Env:$name" -Value $Previous[$name].Value
        } else {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-SbPsql {
    param(
        [Parameter(Mandatory = $true)]$Cluster,
        [Parameter(Mandatory = $true)][string]$Database,
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][string]$Password,
        [string]$Sql,
        [string]$File
    )

    if ([string]::IsNullOrWhiteSpace($Sql) -eq [string]::IsNullOrWhiteSpace($File)) {
        throw 'Supply exactly one of -Sql or -File.'
    }
    $arguments = @(
        '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--no-align', '--tuples-only',
        '--host=127.0.0.1', "--port=$($Cluster.Port)",
        "--username=$Username", "--dbname=$Database"
    )
    if ($File) {
        $arguments += "--file=$File"
    } else {
        $arguments += @('--command', $Sql)
    }

    $previousPassword = Get-Item -LiteralPath 'Env:PGPASSWORD' -ErrorAction SilentlyContinue
    try {
        $env:PGPASSWORD = $Password
        $output = @(& $Cluster.Tools.Psql @arguments 2>&1)
        if ($LASTEXITCODE -ne 0) {
            throw "PostgreSQL command failed: $($output -join [Environment]::NewLine)"
        }
        return $output
    } finally {
        if ($previousPassword) {
            $env:PGPASSWORD = $previousPassword.Value
        } else {
            Remove-Item -LiteralPath 'Env:PGPASSWORD' -ErrorAction SilentlyContinue
        }
    }
}

function Assert-SbLoopbackJdbcUrl {
    param(
        [Parameter(Mandatory = $true)][string]$JdbcUrl,
        [Parameter(Mandatory = $true)][string]$ExpectedDatabase
    )

    if (-not $JdbcUrl.StartsWith('jdbc:postgresql://')) {
... (+225 lines) [see remaining: rtk proxy git show HEAD:scripts/WindowsDevelopmentSupport.ps1 | tail -n +226]
