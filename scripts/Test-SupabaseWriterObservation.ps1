[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9]{10,30}$')][string]$ExpectedSystemIdentifier,
    [Parameter(Mandatory=$true)][string]$MigrationJdbcUrl,
    [Parameter(Mandatory=$true)][string]$MigrationUser,
    [ValidateRange(1,20)][int]$Samples=3,
    [ValidateRange(1,60)][int]$IntervalSeconds=5
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')
. (Join-Path $PSScriptRoot 'SupabaseWriterObservationSupport.ps1')
$client=(Get-Command psql.exe -ErrorAction SilentlyContinue)
if(-not $client){$client=Get-Command psql -ErrorAction SilentlyContinue}
if(-not $client){throw 'PostgreSQL psql executable not found.'}
if(-not $env:PGPASSWORD){throw 'Set migration PGPASSWORD privately; do not pass passwords on command line.'}
$endpoint=ConvertTo-SbSupabaseEndpoint -JdbcUrl $MigrationJdbcUrl -ProjectRef $ProjectRef -User $MigrationUser -Role migration
$sql=@'
BEGIN TRANSACTION READ ONLY;
SELECT 'WRITERS|'||(SELECT system_identifier::text FROM pg_control_system())||'|'||
(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND usename='servisimibul_app')||'|'||
(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active' AND query ~* '(alter[[:space:]]+table|create[[:space:]]+table|flyway_schema_history)')||'|'||
(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='idle in transaction');
COMMIT;
'@
for($i=0;$i -lt $Samples;$i++){
    $text=Invoke-SbMigrationSql -Endpoint $endpoint -Client $client.Source -Sql $sql
    $rows=@($text -split "`r?`n" | Where-Object { $_ -like 'WRITERS|*' })
    if($rows.Count -ne 1){throw 'Writer observation is missing or ambiguous.'}
    $null=Assert-SbWriterActivitySnapshot -Row $rows[0] -ExpectedSystemIdentifier $ExpectedSystemIdentifier
    if($i -lt ($Samples - 1)){Start-Sleep -Seconds $IntervalSeconds}
}
Write-Host 'READ-ONLY writer activity observation completed without detected activity.'
Write-Host 'NOT A WRITE FREEZE: requires separately enforced application shutdown, job pause, external client coordination and independent operator review.'
