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
    $candidates = @($RequestedHome, $env:JAVA_HOME) + @($discoveredJdks)

    foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        $java = Join-Path $candidate 'bin\java.exe'
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
    $pathNode = Get-Command node.exe -ErrorAction SilentlyContinue
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
    $candidates = @(
        $PostgresBin,
        $env:SB_POSTGRES_BIN,
        (Join-Path $programFiles 'PostgreSQL\17\bin'),
        (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'scoop\apps\postgresql17\current\bin'),
        (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'scoop\apps\postgresql\current\bin')
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($candidate in $candidates) {
        $tools = [ordered]@{
            Bin = $candidate
            InitDb = Join-Path $candidate 'initdb.exe'
            PgCtl = Join-Path $candidate 'pg_ctl.exe'
            PgIsReady = Join-Path $candidate 'pg_isready.exe'
            Postgres = Join-Path $candidate 'postgres.exe'
            Psql = Join-Path $candidate 'psql.exe'
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
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
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
        throw 'Isolated development requires a PostgreSQL JDBC URL.'
    }
    try {
        $uri = [Uri]$JdbcUrl.Substring('jdbc:'.Length)
    } catch {
        throw 'Isolated development JDBC URL is invalid.'
    }
    $database = $uri.AbsolutePath.TrimStart('/')
    if ($uri.Host -notin @('localhost', '127.0.0.1', '::1') -or $database -ne $ExpectedDatabase) {
        throw 'Isolated development may connect only to its named loopback database.'
    }
}

function Start-SbIsolatedPostgres {
    param([Parameter(Mandatory = $true)]$Tools)

    $database = 'servisimibul_a12'
    $instanceId = 'a12_' + [guid]::NewGuid().ToString('N')
    $port = Get-SbFreeTcpPort
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ('ServisimiBul-A12-' + [guid]::NewGuid())
    $data = Join-Path $root 'data'
    $log = Join-Path $root 'postgres.log'
    $pgCtlOutput = Join-Path $root 'pg-ctl.out'
    $pgCtlError = Join-Path $root 'pg-ctl.err'
    $adminPassword = New-SbRandomPassword
    $runtimePassword = New-SbRandomPassword
    $passwordFile = Join-Path $root 'init-password.txt'
    $provisionFile = Join-Path $root 'provision.sql'
    $started = $false

    New-Item -ItemType Directory -Path $root | Out-Null
    try {
        [System.IO.File]::WriteAllText($passwordFile, $adminPassword)
        $initOutput = @(& $Tools.InitDb "--pgdata=$data" '--username=postgres' `
            "--pwfile=$passwordFile" '--auth-host=scram-sha-256' '--auth-local=trust' `
            '--encoding=UTF8' '--no-locale' 2>&1)
        Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
        if ($LASTEXITCODE -ne 0) {
            throw "initdb failed: $($initOutput -join [Environment]::NewLine)"
        }

        $startArguments = '--pgdata="{0}" --log="{1}" --options="-p {2} -h 127.0.0.1" --wait start' -f `
            $data, $log, $port
        $startProcess = Start-Process -FilePath $Tools.PgCtl -ArgumentList $startArguments `
            -WindowStyle Hidden -PassThru -RedirectStandardOutput $pgCtlOutput `
            -RedirectStandardError $pgCtlError
        if (-not $startProcess.WaitForExit(15000) -or $startProcess.ExitCode -ne 0) {
            $errorText = Get-Content -LiteralPath $pgCtlError -Raw -ErrorAction SilentlyContinue
            throw "pg_ctl start failed: $errorText"
        }
        $started = $true

        $cluster = [pscustomobject]@{
            Tools = $Tools
            Root = $root
            DataDirectory = $data
            Port = $port
            Database = $database
            InstanceId = $instanceId
            AdminUser = 'postgres'
            AdminPassword = $adminPassword
            RuntimeUser = 'servisimibul_app'
            RuntimePassword = $runtimePassword
            AdminJdbcUrl = "jdbc:postgresql://127.0.0.1:$port/$database"
            RuntimeJdbcUrl = "jdbc:postgresql://127.0.0.1:$port/$database"
        }
        Assert-SbLoopbackJdbcUrl -JdbcUrl $cluster.AdminJdbcUrl -ExpectedDatabase $database

        $provisionSql = @"
CREATE ROLE servisimibul_app LOGIN PASSWORD '$runtimePassword'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE DATABASE $database;
\connect $database
REVOKE CONNECT ON DATABASE $database FROM PUBLIC;
GRANT CONNECT ON DATABASE $database TO servisimibul_app;
CREATE SCHEMA test_harness;
CREATE TABLE test_harness.database_instance (instance_id text PRIMARY KEY);
INSERT INTO test_harness.database_instance VALUES ('$instanceId');
REVOKE ALL ON SCHEMA test_harness FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA test_harness FROM PUBLIC;
GRANT USAGE ON SCHEMA test_harness TO servisimibul_app;
GRANT SELECT ON test_harness.database_instance TO servisimibul_app;
"@
        [System.IO.File]::WriteAllText($provisionFile, $provisionSql)
        $null = Invoke-SbPsql -Cluster $cluster -Database 'postgres' -Username 'postgres' `
            -Password $adminPassword -File $provisionFile
        Remove-Item -LiteralPath $provisionFile -Force -ErrorAction SilentlyContinue

        $identity = @(
            @(Invoke-SbPsql -Cluster $cluster -Database $database `
                -Username $cluster.RuntimeUser -Password $cluster.RuntimePassword -Sql @"
select current_database() || '|' || current_user || '|' || instance_id
from test_harness.database_instance;
"@) | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ }
        )
        $actualIdentity = if ($identity.Count -gt 0) { $identity[-1] } else { '<no row>' }
        if ($actualIdentity -ne "$database|servisimibul_app|$instanceId") {
            throw "Disposable PostgreSQL identity verification failed: $actualIdentity"
        }

        return $cluster
    } catch {
        Remove-Item -LiteralPath $passwordFile, $provisionFile -Force -ErrorAction SilentlyContinue
        if ($started) {
            $stopArguments = '--pgdata="{0}" --mode=immediate --wait stop' -f $data
            $stopProcess = Start-Process -FilePath $Tools.PgCtl -ArgumentList $stopArguments `
                -WindowStyle Hidden -PassThru
            $null = $stopProcess.WaitForExit(15000)
        }
        Remove-SbIsolatedDirectory -Path $root
        throw
    }
}

function Remove-SbIsolatedDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $leaf = [System.IO.Path]::GetFileName($resolvedPath)
    $parent = [System.IO.Path]::GetDirectoryName($resolvedPath)
    if (-not [string]::Equals($parent, $resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not $leaf.StartsWith('ServisimiBul-A12-', [System.StringComparison]::Ordinal)) {
        throw "Refusing to remove non-A-12 directory: $resolvedPath"
    }
    if (Test-Path -LiteralPath $resolvedPath) {
        Remove-Item -LiteralPath $resolvedPath -Recurse -Force
    }
}

function Stop-SbIsolatedPostgres {
    param([Parameter(Mandatory = $true)]$Cluster)

    if (Test-Path -LiteralPath $Cluster.DataDirectory) {
        $stopArguments = '--pgdata="{0}" --mode=fast --wait stop' -f $Cluster.DataDirectory
        $stopProcess = Start-Process -FilePath $Cluster.Tools.PgCtl -ArgumentList $stopArguments `
            -WindowStyle Hidden -PassThru
        if (-not $stopProcess.WaitForExit(15000) -or $stopProcess.ExitCode -ne 0) {
            throw 'Disposable PostgreSQL did not stop cleanly.'
        }
    }
    Remove-SbIsolatedDirectory -Path $Cluster.Root
}

function Get-SbMavenRuntime {
    param([Parameter(Mandatory = $true)][string]$BackendDirectory)

    $propertiesPath = Join-Path $BackendDirectory '.mvn\wrapper\maven-wrapper.properties'
    $properties = Get-Content -LiteralPath $propertiesPath -Raw | ConvertFrom-StringData
    $distributionName = [System.IO.Path]::GetFileNameWithoutExtension($properties.distributionUrl) -replace '-bin$', ''
    $mavenUserHome = if ($env:MAVEN_USER_HOME) {
        $env:MAVEN_USER_HOME
    } else {
        Join-Path ([Environment]::GetFolderPath('UserProfile')) '.m2'
    }
    $distributionRoot = Join-Path $mavenUserHome "wrapper\dists\$distributionName"
    $launcher = Get-ChildItem -LiteralPath $distributionRoot -Recurse `
        -Filter 'plexus-classworlds-*.jar' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $launcher) {
        & (Join-Path $BackendDirectory 'mvnw.cmd') --version
        if ($LASTEXITCODE -ne 0) {
            throw 'Maven Wrapper setup failed.'
        }
        $launcher = Get-ChildItem -LiteralPath $distributionRoot -Recurse `
            -Filter 'plexus-classworlds-*.jar' -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if (-not $launcher) {
        throw 'Maven runtime was not found after Maven Wrapper setup.'
    }

    return [pscustomobject]@{
        Home = Split-Path -Parent (Split-Path -Parent $launcher.FullName)
        Launcher = $launcher.FullName
    }
}

function Stop-SbProcessTree {
    param([System.Diagnostics.Process]$Process)

    if (-not $Process) {
        return
    }
    $Process.Refresh()
    if (-not $Process.HasExited) {
        & "$env:SystemRoot\System32\taskkill.exe" /PID $Process.Id /T /F 2>$null | Out-Null
    }
}
