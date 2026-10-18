[CmdletBinding()]
param(
    [switch]$Apply,

    [uri]$BaseUri = 'https://api.turkiyeapi.dev/v2',

    [string]$PsqlPath = 'psql',

    [switch]$AllowHttpForLocalTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$verifier = Join-Path $PSScriptRoot 'Test-IstanbulGeographySource.ps1'
$loopbackHosts = @('localhost', '127.0.0.1', '::1')

function Get-RequiredEnvironmentValue {
    param([Parameter(Mandatory = $true)][string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Unsafe isolated PostgreSQL configuration: $Name is required."
    }
    return $value
}

function Assert-SafeIdentifier {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$Description
    )

    if ($Value -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "Unsafe isolated PostgreSQL configuration: $Description is invalid."
    }
}

function ConvertTo-SqlLiteral {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value.Contains([char]0)) {
        throw 'Source data contains a null character.'
    }
    return "'$($Value.Replace("'", "''"))'"
}

function Invoke-CheckedPsql {
    param([Parameter(Mandatory = $true)][string]$Sql)

    $output = @($Sql | & $script:resolvedPsql --no-psqlrc --set=ON_ERROR_STOP=1 `
        --no-align --tuples-only --quiet --file=- 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw 'The isolated PostgreSQL command failed; review the local server and target configuration.'
    }
    return @($output | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
}

if ((Get-RequiredEnvironmentValue 'SB_TEST_DB_DISPOSABLE').ToLowerInvariant() -ne 'true') {
    throw 'Unsafe isolated PostgreSQL configuration: SB_TEST_DB_DISPOSABLE=true is required.'
}

$expectedDatabase = Get-RequiredEnvironmentValue 'SB_TEST_DATABASE_NAME'
$expectedMarker = Get-RequiredEnvironmentValue 'SB_TEST_DB_INSTANCE_ID'
$databaseHost = Get-RequiredEnvironmentValue 'PGHOST'
$databasePort = Get-RequiredEnvironmentValue 'PGPORT'
$databaseName = Get-RequiredEnvironmentValue 'PGDATABASE'
$databaseUser = Get-RequiredEnvironmentValue 'PGUSER'
$null = Get-RequiredEnvironmentValue 'PGPASSWORD'

Assert-SafeIdentifier -Value $expectedDatabase -Description 'SB_TEST_DATABASE_NAME'
Assert-SafeIdentifier -Value $expectedMarker -Description 'SB_TEST_DB_INSTANCE_ID'
Assert-SafeIdentifier -Value $databaseUser -Description 'PGUSER'
if ($databaseHost -notin $loopbackHosts -or $databaseName -ne $expectedDatabase -or
    $databasePort -notmatch '^\d{1,5}$' -or [int]$databasePort -lt 1 -or
    [int]$databasePort -gt 65535) {
    throw 'Unsafe isolated PostgreSQL configuration: target must be the named loopback database.'
}

$psqlCommand = Get-Command $PsqlPath -CommandType Application -ErrorAction SilentlyContinue
if ($null -eq $psqlCommand) {
    throw 'PostgreSQL psql client was not found.'
}
$resolvedPsql = $psqlCommand.Source
$clientVersion = & $resolvedPsql --version 2>$null
if ($LASTEXITCODE -ne 0 -or $clientVersion -notmatch 'PostgreSQL\) 17(?:\.|\s)') {
    throw 'PostgreSQL 17 psql client is required.'
}

$markerLiteral = ConvertTo-SqlLiteral $expectedMarker
$identityOutput = Invoke-CheckedPsql @"
SELECT concat(
    'IDENTITY|', current_database(), '|', current_user, '|',
    current_setting('server_version_num'), '|',
    (SELECT count(*) FROM test_harness.database_instance WHERE instance_id = $markerLiteral), '|',
    (to_regclass('public.province') IS NOT NULL), '|',
    (to_regclass('public.district') IS NOT NULL), '|',
    (to_regclass('public.neighborhood') IS NOT NULL)
);
"@
$identityLine = $identityOutput | Where-Object { $_ -match '^IDENTITY\|' } | Select-Object -Last 1
if ($null -eq $identityLine) {
    throw 'Unsafe isolated PostgreSQL configuration: database identity was not returned.'
}
$identity = $identityLine -split '\|'
if ($identity.Count -ne 8 -or $identity[1] -ne $expectedDatabase -or
    $identity[2] -ne $databaseUser -or [int]$identity[3] -lt 170000 -or
    [int]$identity[3] -ge 180000 -or $identity[4] -ne '1' -or
    $identity[5] -ne 't' -or $identity[6] -ne 't' -or $identity[7] -ne 't') {
    throw 'Unsafe isolated PostgreSQL configuration: identity, PostgreSQL version, marker, or schema did not match.'
}

$source = & $verifier -BaseUri $BaseUri -AllowHttpForLocalTest:$AllowHttpForLocalTest -PassThru
$districtRows = @($source.Districts | ForEach-Object {
    if (([string]$_.name).Length -gt 150) {
        throw 'A source district name exceeds the database limit.'
    }
    '({0},{1})' -f [int]$_.id, (ConvertTo-SqlLiteral ([string]$_.name))
}) -join ",`n        "
$neighborhoodRows = @($source.Neighborhoods | ForEach-Object {
    if (([string]$_.name).Length -gt 150) {
        throw 'A source neighborhood name exceeds the database limit.'
    }
    '({0},{1})' -f [int]$_.districtId, (ConvertTo-SqlLiteral ([string]$_.name))
}) -join ",`n        "

$previewTemplate = @'
BEGIN TRANSACTION READ ONLY;
WITH source_district(external_id, name) AS (
    VALUES
        __DISTRICT_ROWS__
), source_neighborhood(district_external_id, name) AS (
    VALUES
        __NEIGHBORHOOD_ROWS__
), exact_province AS (
    SELECT id FROM province WHERE code = '34' AND name = 'İstanbul'
)
SELECT concat(
    'PREVIEW|',
    CASE WHEN EXISTS (SELECT 1 FROM exact_province) THEN 0 ELSE 1 END, '|',
    (SELECT count(*) FROM source_district source
        WHERE NOT EXISTS (
            SELECT 1 FROM district target
            JOIN exact_province province ON province.id = target.province_id
            WHERE target.name = source.name
        )), '|',
    (SELECT count(*) FROM source_neighborhood source_neighborhood
        JOIN source_district source_district
          ON source_district.external_id = source_neighborhood.district_external_id
        WHERE NOT EXISTS (
            SELECT 1 FROM neighborhood target_neighborhood
            JOIN district target_district ON target_district.id = target_neighborhood.district_id
            JOIN exact_province province ON province.id = target_district.province_id
            WHERE target_district.name = source_district.name
              AND target_neighborhood.name = source_neighborhood.name
        )), '|',
    (SELECT count(*) FROM province
        WHERE (code = '34' OR name = 'İstanbul')
          AND NOT (code = '34' AND name = 'İstanbul')), '|',
    (SELECT count(*) FROM district target
        JOIN exact_province province ON province.id = target.province_id
        WHERE NOT EXISTS (SELECT 1 FROM source_district source WHERE source.name = target.name)), '|',
    (SELECT count(*) FROM neighborhood target_neighborhood
        JOIN district target_district ON target_district.id = target_neighborhood.district_id
        JOIN exact_province province ON province.id = target_district.province_id
        WHERE NOT EXISTS (
            SELECT 1 FROM source_neighborhood source_neighborhood
            JOIN source_district source_district
              ON source_district.external_id = source_neighborhood.district_external_id
            WHERE source_district.name = target_district.name
              AND source_neighborhood.name = target_neighborhood.name
        ))
);
ROLLBACK;
'@
$previewSql = $previewTemplate.Replace('__DISTRICT_ROWS__', $districtRows).
    Replace('__NEIGHBORHOOD_ROWS__', $neighborhoodRows)
$previewOutput = Invoke-CheckedPsql $previewSql
$previewLine = $previewOutput | Where-Object { $_ -match '^PREVIEW\|' } | Select-Object -Last 1
if ($null -eq $previewLine) {
    throw 'The isolated PostgreSQL preview did not return its result.'
}
$preview = $previewLine -split '\|'
if ($preview.Count -ne 7) {
    throw 'The isolated PostgreSQL preview returned an unexpected result.'
}
$missingProvince = [int]$preview[1]
$missingDistricts = [int]$preview[2]
$missingNeighborhoods = [int]$preview[3]
$provinceConflicts = [int]$preview[4]
$extraDistricts = [int]$preview[5]
$extraNeighborhoods = [int]$preview[6]

Write-Output "Target: disposable PostgreSQL 17 database '$expectedDatabase' on loopback"
Write-Output "Missing: province=$missingProvince districts=$missingDistricts neighborhoods=$missingNeighborhoods"
Write-Output "Unexpected existing rows: province=$provinceConflicts districts=$extraDistricts neighborhoods=$extraNeighborhoods"

if ($provinceConflicts -gt 0 -or $extraDistricts -gt 0 -or $extraNeighborhoods -gt 0) {
    throw 'Existing İstanbul geography conflicts with the verified source; investigate without overwriting.'
}
if (-not $Apply) {
    Write-Output 'DRY RUN: no database rows were changed. Re-run with -Apply only for this disposable target.'
    return
}

$applyTemplate = @'
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TEMP TABLE a11_source_district (
    external_id integer PRIMARY KEY,
    name varchar(150) NOT NULL UNIQUE
) ON COMMIT DROP;
CREATE TEMP TABLE a11_source_neighborhood (
    district_external_id integer NOT NULL REFERENCES a11_source_district(external_id),
    name varchar(150) NOT NULL,
    PRIMARY KEY (district_external_id, name)
) ON COMMIT DROP;
INSERT INTO a11_source_district (external_id, name) VALUES
    __DISTRICT_ROWS__;
INSERT INTO a11_source_neighborhood (district_external_id, name) VALUES
    __NEIGHBORHOOD_ROWS__;

LOCK TABLE province, district, neighborhood IN SHARE ROW EXCLUSIVE MODE;
DO $a11_guard$
BEGIN
    IF EXISTS (
        SELECT 1 FROM province
        WHERE (code = '34' OR name = 'İstanbul')
          AND NOT (code = '34' AND name = 'İstanbul')
    ) THEN
        RAISE EXCEPTION 'conflicting Istanbul province row';
    END IF;
    IF EXISTS (
        SELECT 1 FROM district target
        JOIN province ON province.id = target.province_id AND province.code = '34'
        WHERE NOT EXISTS (SELECT 1 FROM a11_source_district source WHERE source.name = target.name)
    ) OR EXISTS (
        SELECT 1 FROM neighborhood target_neighborhood
        JOIN district target_district ON target_district.id = target_neighborhood.district_id
        JOIN province ON province.id = target_district.province_id AND province.code = '34'
        WHERE NOT EXISTS (
            SELECT 1 FROM a11_source_neighborhood source_neighborhood
            JOIN a11_source_district source_district
              ON source_district.external_id = source_neighborhood.district_external_id
            WHERE source_district.name = target_district.name
              AND source_neighborhood.name = target_neighborhood.name
        )
    ) THEN
        RAISE EXCEPTION 'unexpected existing Istanbul geography rows';
    END IF;
END
$a11_guard$;

INSERT INTO province (code, name)
VALUES ('34', 'İstanbul')
ON CONFLICT (code) DO NOTHING;

INSERT INTO district (province_id, name)
SELECT province.id, source.name
FROM province
CROSS JOIN a11_source_district source
WHERE province.code = '34' AND province.name = 'İstanbul'
ON CONFLICT (province_id, name) DO NOTHING;

INSERT INTO neighborhood (district_id, name)
SELECT target_district.id, source_neighborhood.name
FROM a11_source_neighborhood source_neighborhood
JOIN a11_source_district source_district
  ON source_district.external_id = source_neighborhood.district_external_id
JOIN province ON province.code = '34' AND province.name = 'İstanbul'
JOIN district target_district
  ON target_district.province_id = province.id
 AND target_district.name = source_district.name
ON CONFLICT (district_id, name) DO NOTHING;

DO $a11_verify$
BEGIN
    IF (SELECT count(*) FROM district
        JOIN province ON province.id = district.province_id
        WHERE province.code = '34' AND province.name = 'İstanbul') <> 39
    OR (SELECT count(*) FROM neighborhood
        JOIN district ON district.id = neighborhood.district_id
        JOIN province ON province.id = district.province_id
        WHERE province.code = '34' AND province.name = 'İstanbul') <> 963
    OR EXISTS (
        SELECT 1 FROM a11_source_district source
        WHERE NOT EXISTS (
            SELECT 1 FROM district target
            JOIN province ON province.id = target.province_id
            WHERE province.code = '34' AND province.name = 'İstanbul'
              AND target.name = source.name
        )
    )
    OR EXISTS (
        SELECT 1 FROM a11_source_neighborhood source_neighborhood
        JOIN a11_source_district source_district
          ON source_district.external_id = source_neighborhood.district_external_id
        WHERE NOT EXISTS (
            SELECT 1 FROM neighborhood target_neighborhood
            JOIN district target_district ON target_district.id = target_neighborhood.district_id
            JOIN province ON province.id = target_district.province_id
            WHERE province.code = '34' AND province.name = 'İstanbul'
              AND target_district.name = source_district.name
              AND target_neighborhood.name = source_neighborhood.name
        )
    ) THEN
        RAISE EXCEPTION 'post-import Istanbul geography verification failed';
    END IF;
END
$a11_verify$;
COMMIT;
'@
$applySql = $applyTemplate.Replace('__DISTRICT_ROWS__', $districtRows).
    Replace('__NEIGHBORHOOD_ROWS__', $neighborhoodRows)
$null = Invoke-CheckedPsql $applySql

Write-Output "APPLIED: province=$missingProvince districts=$missingDistricts neighborhoods=$missingNeighborhoods"
Write-Output 'Verified totals: provinces=1 districts=39 neighborhoods=963'
