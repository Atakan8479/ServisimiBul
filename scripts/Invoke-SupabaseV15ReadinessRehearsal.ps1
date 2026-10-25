[CmdletBinding()]
param(
    [string]$BackupDirectory = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'ServisimiBul-Backups'),
    [ValidateRange(1,1440)][int]$MaximumBackupAgeMinutes = 120,
    [string]$PostgresBin,
    [string]$JavaHome
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Fixed, previously read-only-verified shared Supabase identity. No -Apply path.
$projectRef = 'whftdzfbvpchmghttjkg'
$systemIdentifier = '7692130048193495360'
$root = Split-Path -Parent $PSScriptRoot

$head = (& git -C $root rev-parse HEAD 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $head -cnotmatch '^[0-9a-f]{40}$') {
    throw 'Could not identify the release commit.'
}
$branch = (& git -C $root branch --show-current 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -cne 'codex/ops-01-guarded-supabase-migration') {
    throw 'Checkout the reviewed OPS-01 branch before release rehearsal.'
}
& git -C $root diff --quiet HEAD -- 'servisimibul-backend' 'scripts' 'docs/10_MIGRATION_VERIFICATION.sql'
if ($LASTEXITCODE -ne 0) {
    throw 'Release inputs have local changes. Commit or discard only those changes before rehearsal.'
}
if (-not $env:SB_DB_MIGRATION_JDBC_URL -or -not $env:SB_DB_MIGRATION_USER -or
    -not $env:SB_DB_JDBC_URL -or -not $env:SB_DB_USER -or
    -not $env:PGPASSWORD -or -not $env:SB_DB_PASSWORD) {
    throw 'Missing database environment values. Set SB_DB_MIGRATION_JDBC_URL, SB_DB_MIGRATION_USER, SB_DB_JDBC_URL, SB_DB_USER, PGPASSWORD and SB_DB_PASSWORD privately; do not paste secrets in chat.'
}

$backupScript = Join-Path $PSScriptRoot 'Backup-SupabaseV12.ps1'
$restoreScript = Join-Path $PSScriptRoot 'Test-SupabaseMigration.RestoreEvidence.ps1'
$readinessScript = Join-Path $PSScriptRoot 'Test-SupabaseReleaseReadiness.ps1'
$offlineTests = Join-Path $PSScriptRoot 'Test-SupabaseMigration.Tests.ps1'
$readinessTests = Join-Path $PSScriptRoot 'Test-SupabaseReleaseReadiness.Tests.ps1'

if (-not (Test-Path -LiteralPath $BackupDirectory -PathType Container)) {
    $null = New-Item -ItemType Directory -Path $BackupDirectory -Force
}
$backupDirFull = (Resolve-Path -LiteralPath $BackupDirectory).Path
$rootFull = (Resolve-Path -LiteralPath $root).Path.TrimEnd('\', '/')
if ($backupDirFull.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    $backupDirFull -ceq $rootFull) {
    throw 'Do not store database backup data inside the Git repository.'
}
$runId = [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$archivePath = Join-Path $backupDirFull ("servisimibul-v12-$runId.pgdump")
$backupEvidencePath = Join-Path $backupDirFull ("servisimibul-v12-$runId-backup.json")
$restoreEvidencePath = Join-Path $backupDirFull ("servisimibul-v15-$runId-restore-proof.json")

Write-Host 'Running offline safety tests before touching the read-only backup source.'
# PowerShell script invocations do not reset LASTEXITCODE; expected negative
# native-command tests can leave a nonzero value even when a .ps1 passed.
& $offlineTests
if (-not $?) { throw 'Migration offline tests did not pass.' }
& $readinessTests
if (-not $?) { throw 'Release readiness offline tests did not pass.' }

$backupParameters = @{
    ProjectRef = $projectRef
    ExpectedSystemIdentifier = $systemIdentifier
    MigrationJdbcUrl = $env:SB_DB_MIGRATION_JDBC_URL
    MigrationUser = $env:SB_DB_MIGRATION_USER
    RuntimeJdbcUrl = $env:SB_DB_JDBC_URL
    RuntimeUser = $env:SB_DB_USER
    ArchivePath = $archivePath
    EvidencePath = $backupEvidencePath
}
if ($PostgresBin) { $backupParameters.PostgresBin = $PostgresBin }
& $backupScript @backupParameters
if (-not (Test-Path -LiteralPath $backupEvidencePath -PathType Leaf)) {
    throw 'New V12 backup evidence was not produced. Stop; no restore was attempted.'
}

$restoreParameters = @{ BackupEvidencePath=$backupEvidencePath; EvidenceOutputPath=$restoreEvidencePath }
if ($PostgresBin) { $restoreParameters.PostgresBin = $PostgresBin }
if ($JavaHome) { $restoreParameters.JavaHome = $JavaHome }
& $restoreScript @restoreParameters
if (-not (Test-Path -LiteralPath $restoreEvidencePath -PathType Leaf)) {
    throw 'New disposable V15 rehearsal and V12 rollback evidence was not produced.'
}
& $readinessScript -ProjectRef $projectRef -ReleaseCommit $head -BackupEvidencePath $backupEvidencePath -RestoreEvidencePath $restoreEvidencePath -MaximumBackupAgeMinutes $MaximumBackupAgeMinutes

Write-Host 'V12 BACKUP / V15 MIGRATION REHEARSAL / V12 ROLLBACK: PASS.'
Write-Host 'Backups and JSON proof were retained outside the repository.'
Write-Host ("Backup evidence: " + $backupEvidencePath)
Write-Host ("Restore proof: " + $restoreEvidencePath)
Write-Host ("Reviewed commit: " + $head)
Write-Host 'Production Supabase was never migrated by this workflow. Independent go-live gates still apply.'
