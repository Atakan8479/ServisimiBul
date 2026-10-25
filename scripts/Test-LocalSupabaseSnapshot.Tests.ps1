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
