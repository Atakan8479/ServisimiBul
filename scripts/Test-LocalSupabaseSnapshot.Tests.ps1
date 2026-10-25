[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$launcher=Join-Path $root 'dev-snapshot.ps1'
$support=Join-Path $PSScriptRoot 'LocalSupabaseSnapshotSupport.ps1'
foreach($path in @($launcher,$support)) {
    $parseErrors=$null
    $null=[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$null,[ref]$parseErrors)
    if(@($parseErrors).Count -gt 0) { throw ('Snapshot runner PowerShell parse failed: '+$path) }
}
# Verify mandatory helper functions are actually imported, not just mentioned.
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')
. (Join-Path $PSScriptRoot 'BackupRestoreSupport.ps1')
. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')
. (Join-Path $PSScriptRoot 'LocalSupabaseSnapshotSupport.ps1')
foreach($functionName in @('Assert-SbDisposableClusterIdentity',
                           'Get-SbBackupArchiveTocStatus',
                           'Read-SbEvidenceJson',
                           'Restore-SbV12SnapshotToDisposable')) {
    if(-not (Get-Command $functionName -CommandType Function -ErrorAction SilentlyContinue)) {
        throw ('Snapshot launcher dependency not available: '+$functionName)
    }
}
$runnerSource=Get-Content -Raw -LiteralPath $launcher
if(-not $runnerSource.Contains("scripts\BackupRestoreSupport.ps1")) {
    throw 'Snapshot launcher does not load the disposable identity helper.'
}
# Regression: single psql row must not be treated as a scalar lacking Count.
Assert-SbSnapshotV12History -HistoryRows @('1,2,3,4,5,6,7,8,9,10,11,12|0')
foreach($invalidRows in @(
    @(),
    @('1,2,3,4,5,6,7,8,9,10,11,12|1'),
    @('1,2,3,4,5,6,7,8,9,10,11,12|0', '1,2,3,4,5,6,7,8,9,10,11,12|0')
)) {
    $rejected=$false
    try { Assert-SbSnapshotV12History -HistoryRows $invalidRows } catch { $rejected=$true }
    if(-not $rejected) { throw 'Snapshot V12 history validator accepted invalid row cardinality/content.' }
}
$json='[{"id":1,"name":"İstanbul"}]'
$one=Convert-SbGeographyApiArray -Json $json -Label 'Province'
if(@($one).Length -ne 1 -or $one[0].id -ne 1){throw 'Single-province JSON array normalization failed.'}
$districtJson='[' + ((1..39 | ForEach-Object { '{"id":'+$_+',"provinceId":1,"name":"District '+$_+'"}' }) -join ',') + ']'
$allDistricts=Convert-SbGeographyApiArray -Json $districtJson -Label 'District'
if(@($allDistricts).Length -ne 39){throw 'District JSON array was flattened incorrectly.'}
$null=Assert-SbRealGeographyResponses -Provinces $one -Districts $allDistricts
$provinces=@([pscustomobject]@{id=1;name='İstanbul'})
$districts=@(1..39 | ForEach-Object { [pscustomobject]@{id=$_;provinceId=1;name=('District '+$_)} })
$null=Assert-SbRealGeographyResponses -Provinces $provinces -Districts $districts
$invalid=@($districts | Select-Object -Skip 1)
$rejected=$false
try { $null=Assert-SbRealGeographyResponses -Provinces $provinces -Districts $invalid } catch { $rejected=$true }
if(-not $rejected) { throw 'Real geography validation accepted missing districts.' }
$runner=Get-Content -Raw -LiteralPath $launcher
$source=Get-Content -Raw -LiteralPath $support
foreach($token in @('Restore-SbV12SnapshotToDisposable',
                      'Assert-SbVerifiedLocalSnapshotArchive',
                      'Start-SbIsolatedPostgres',
                      'Stop-SbIsolatedPostgres',
                      'Invoke-LocalMigration',
                      'Assert-SbDisposableClusterIdentity')) {
    if(-not $runner.Contains($token)) { throw ('Snapshot runner is missing safety gate: '+$token) }
}
foreach($token in @('archiveSha256','sourceSystemIdentifier','merge-base --is-ancestor',
                    'Get-SbBackupArchiveTocStatus','Assert-SbDisposableClusterIdentity',
                    '--host=127.0.0.1')) {
    if(-not $source.Contains($token)) { throw ('Snapshot restore is missing archive isolation guard: '+$token) }
}
if($runner.Contains('Read-SbRuntimeEnvironmentFile') -or
   $runner.Contains('SB_DEMO_PARENT_BOOTSTRAP_ENABLED = ''true''') -or
   $runner.Contains('SB_FLYWAY_ENABLED = ''true''') -and -not $runner.Contains('SPRING_PROFILES_ACTIVE = ''migration''')) {
    throw 'Snapshot runtime must not use shared configuration or privileged web Flyway.'
}
Write-Host 'OPS-01 private V12 snapshot local-launch offline guards passed.'
