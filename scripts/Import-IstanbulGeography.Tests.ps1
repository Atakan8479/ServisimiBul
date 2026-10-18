[CmdletBinding()]
param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Test-IstanbulGeographySource.Tests.ps1') -DefinitionsOnly

$importer = Join-Path $PSScriptRoot 'Import-IstanbulGeography.ps1'
$migration = Join-Path $PSScriptRoot '..\servisimibul-backend\src\main\resources\db\migration\V1__create_geography_schema.sql'
$initdb = Join-Path $PostgresBin 'initdb.exe'
$pgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
$psql = Join-Path $PostgresBin 'psql.exe'
foreach ($tool in @($initdb, $pgCtl, $psql)) {
    if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
        throw "PostgreSQL 17 tool not found: $tool"
    }
}

$databaseName = 'servisimibul_a11'
$instanceId = 'a11_' + [guid]::NewGuid().ToString('N')
$port = Get-FreeTcpPort
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ServisimiBul-A11-' + [guid]::NewGuid())
$dataDirectory = Join-Path $testRoot 'data'
$serverLog = Join-Path $testRoot 'postgres.log'
$pgCtlOutput = Join-Path $testRoot 'pg-ctl.out'
$pgCtlError = Join-Path $testRoot 'pg-ctl.err'
$serverStarted = $false
$environmentNames = @(
    'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'SB_TEST_DB_DISPOSABLE', 'SB_TEST_DATABASE_NAME', 'SB_TEST_DB_INSTANCE_ID'
)
$savedEnvironment = @{}
foreach ($name in $environmentNames) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
}

function Invoke-TestPsql {
    param(
        [Parameter(Mandatory = $true)][string]$Database,
        [string]$Sql,
        [string]$File
    )

    $arguments = @(
        '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--no-align', '--tuples-only',
        '--host=127.0.0.1', "--port=$port", '--username=postgres', "--dbname=$Database"
    )
    if ($File) {
        $arguments += "--file=$File"
    } else {
        $arguments += @('--command', $Sql)
    }
    $output = @(& $psql @arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL test command failed: $($output -join [Environment]::NewLine)"
    }
    return @($output | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
}

function Invoke-ImporterFixture {
    param([switch]$Apply)

    $server = $null
    try {
        $server = Start-GeographyMockServer -Scenario 'Success' -RequestCount 4
        $arguments = @(
            '-NoLogo', '-NoProfile', '-File', $importer,
            '-BaseUri', $server.BaseUri,
            '-AllowHttpForLocalTest',
            '-PsqlPath', $psql
        )
        if ($Apply) {
            $arguments += '-Apply'
        }
        $output = @(& pwsh @arguments 2>&1)
        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = $output -join "`n"
        }
    } finally {
        Stop-GeographyMockServer -Server $server
    }
}

New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    Write-Output 'Starting disposable PostgreSQL 17 cluster...'
    $initOutput = @(& $initdb --pgdata=$dataDirectory --username=postgres `
        --auth=trust --encoding=UTF8 --no-locale 2>&1)
    Assert-Condition ($LASTEXITCODE -eq 0) "initdb failed: $($initOutput -join [Environment]::NewLine)"

    $startArguments = '--pgdata="{0}" --log="{1}" --options="-p {2} -h 127.0.0.1" --wait start' -f `
        $dataDirectory, $serverLog, $port
    $startProcess = Start-Process -FilePath $pgCtl -ArgumentList $startArguments `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $pgCtlOutput `
        -RedirectStandardError $pgCtlError
    Assert-Condition ($startProcess.WaitForExit(15000)) 'pg_ctl start timed out.'
    Assert-Condition ($startProcess.ExitCode -eq 0) `
        "pg_ctl start failed: $(Get-Content $pgCtlError -Raw -ErrorAction SilentlyContinue)"
    $serverStarted = $true

    Write-Output 'Preparing isolated geography schema...'
    $null = Invoke-TestPsql -Database 'postgres' -Sql `
        "CREATE ROLE servisimibul_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;"
    $null = Invoke-TestPsql -Database 'postgres' -Sql "CREATE DATABASE $databaseName;"
    $null = Invoke-TestPsql -Database $databaseName -File $migration
    $null = Invoke-TestPsql -Database $databaseName -Sql @"
CREATE SCHEMA test_harness;
CREATE TABLE test_harness.database_instance (instance_id text PRIMARY KEY);
INSERT INTO test_harness.database_instance VALUES ('$instanceId');
"@

    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = [string]$port
    $env:PGDATABASE = $databaseName
    $env:PGUSER = 'postgres'
    $env:PGPASSWORD = 'local-test-only'
    $env:SB_TEST_DB_DISPOSABLE = 'true'
    $env:SB_TEST_DATABASE_NAME = $databaseName
    $env:SB_TEST_DB_INSTANCE_ID = $instanceId

    Write-Output 'Checking dry-run behavior...'
    $result = Invoke-ImporterFixture
    Assert-Condition ($result.ExitCode -eq 0) "Dry-run failed: $($result.Output)"
    Assert-Condition ($result.Output -match 'Missing: province=1 districts=39 neighborhoods=963') `
        "Dry-run counts were wrong: $($result.Output)"
    Assert-Condition ($result.Output -match 'DRY RUN: no database rows were changed') `
        'Dry-run did not report its no-write guarantee.'
    $emptyCounts = @(Invoke-TestPsql -Database $databaseName -Sql `
        "SELECT (SELECT count(*) FROM province) || '|' || (SELECT count(*) FROM district) || '|' || (SELECT count(*) FROM neighborhood);")[-1]
    Assert-Condition ($emptyCounts -eq '0|0|0') 'Dry-run changed geography rows.'

    Write-Output 'Checking first apply...'
    $result = Invoke-ImporterFixture -Apply
    Assert-Condition ($result.ExitCode -eq 0) "Apply failed: $($result.Output)"
    Assert-Condition ($result.Output -match 'APPLIED: province=1 districts=39 neighborhoods=963') `
        "Apply counts were wrong: $($result.Output)"
    $databaseChecks = @(Invoke-TestPsql -Database $databaseName -Sql @"
SELECT
    (SELECT count(*) FROM province WHERE code = '34') || '|' ||
    (SELECT encode(convert_to(name, 'UTF8'), 'hex') FROM province WHERE code = '34') || '|' ||
    (SELECT count(*) FROM district JOIN province ON province.id = district.province_id WHERE province.code = '34') || '|' ||
    (SELECT count(*) FROM neighborhood JOIN district ON district.id = neighborhood.district_id JOIN province ON province.id = district.province_id WHERE province.code = '34') || '|' ||
    (SELECT count(*) FROM district LEFT JOIN province ON province.id = district.province_id WHERE province.id IS NULL) || '|' ||
    (SELECT count(*) FROM neighborhood LEFT JOIN district ON district.id = neighborhood.district_id WHERE district.id IS NULL);
"@)[-1]
    Assert-Condition ($databaseChecks -eq '1|c4b07374616e62756c|39|963|0|0') `
        "Imported row or foreign-key counts were wrong: $databaseChecks"
    $idsBefore = @(Invoke-TestPsql -Database $databaseName -Sql @"
SELECT
    (SELECT string_agg(id::text, ',' ORDER BY id) FROM province WHERE code = '34') || '|' ||
    (SELECT string_agg(district.id::text, ',' ORDER BY district.id) FROM district JOIN province ON province.id = district.province_id WHERE province.code = '34') || '|' ||
    (SELECT string_agg(neighborhood.id::text, ',' ORDER BY neighborhood.id) FROM neighborhood JOIN district ON district.id = neighborhood.district_id JOIN province ON province.id = district.province_id WHERE province.code = '34');
"@)[-1]

    Write-Output 'Checking repeat apply and stable IDs...'
    $result = Invoke-ImporterFixture -Apply
    Assert-Condition ($result.ExitCode -eq 0) "Repeat apply failed: $($result.Output)"
    Assert-Condition ($result.Output -match 'APPLIED: province=0 districts=0 neighborhoods=0') `
        "Repeat apply was not idempotent: $($result.Output)"
    $idsAfter = @(Invoke-TestPsql -Database $databaseName -Sql @"
SELECT
    (SELECT string_agg(id::text, ',' ORDER BY id) FROM province WHERE code = '34') || '|' ||
    (SELECT string_agg(district.id::text, ',' ORDER BY district.id) FROM district JOIN province ON province.id = district.province_id WHERE province.code = '34') || '|' ||
    (SELECT string_agg(neighborhood.id::text, ',' ORDER BY neighborhood.id) FROM neighborhood JOIN district ON district.id = neighborhood.district_id JOIN province ON province.id = district.province_id WHERE province.code = '34');
"@)[-1]
    Assert-Condition ($idsAfter -eq $idsBefore) 'Repeat apply changed existing geography IDs.'

    Write-Output 'Checking non-loopback rejection...'
    $env:PGHOST = 'database.example.invalid'
    $unsafeOutput = @(& pwsh -NoLogo -NoProfile -File $importer -PsqlPath $psql 2>&1)
    Assert-Condition ($LASTEXITCODE -ne 0) 'A non-loopback database target unexpectedly passed.'
    Assert-Condition (($unsafeOutput -join "`n") -match 'named loopback database') `
        'The non-loopback failure was not explicit.'

    Write-Output 'Istanbul geography importer PostgreSQL 17 tests passed.'
} finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name])
    }
    if ($serverStarted) {
        $stopArguments = '--pgdata="{0}" --mode=fast --wait stop' -f $dataDirectory
        $stopProcess = Start-Process -FilePath $pgCtl -ArgumentList $stopArguments `
            -WindowStyle Hidden -PassThru
        $null = $stopProcess.WaitForExit(15000)
    }
    $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
    $resolvedSystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTestRoot.StartsWith($resolvedSystemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($resolvedTestRoot).StartsWith('ServisimiBul-A11-')) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}
