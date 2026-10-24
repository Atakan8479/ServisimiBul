[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ReleaseCommit,
    [Parameter(Mandatory=$true)][string]$BackupEvidencePath,
    [Parameter(Mandatory=$true)][string]$RestoreEvidencePath,
    [ValidateRange(1,1440)][int]$MaximumBackupAgeMinutes=120
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')
. (Join-Path $PSScriptRoot 'SupabaseReleaseReadinessSupport.ps1')
$head=(& git -C $root rev-parse HEAD 2>$null).Trim()
if($LASTEXITCODE -ne 0 -or $head -cne $ReleaseCommit){
    throw 'Checked-out HEAD is not the explicitly reviewed release commit.'
}
& git -C $root diff --quiet HEAD -- 'servisimibul-backend' 'scripts' 'docs/10_MIGRATION_VERIFICATION.sql'
if($LASTEXITCODE -ne 0){
    throw 'Release inputs must be clean before readiness verification.'
}
$backup=Read-SbEvidenceJson -Path $BackupEvidencePath -Label 'Backup'
$restore=Read-SbEvidenceJson -Path $RestoreEvidencePath -Label 'Restore'
if(-not [IO.Path]::IsPathRooted([string]$backup.archivePath)){
    throw 'The backup archive path must be absolute.'
}
$repoPath=[IO.Path]::GetFullPath($root).TrimEnd('\','/')
foreach($path in @($backup.archivePath,$BackupEvidencePath,$RestoreEvidencePath)){
    $resolved=[IO.Path]::GetFullPath($path)
    if($resolved.StartsWith($repoPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
        throw 'Backup and rehearsal evidence must stay outside the repository.'
    }
}
if(-not(Test-Path -LiteralPath $backup.archivePath -PathType Leaf)){
    throw 'The referenced backup archive is missing.'
}
$hash=(Get-FileHash -LiteralPath $backup.archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$null=Assert-SbReleaseEvidencePair -Backup $backup -Restore $restore -ProjectRef $ProjectRef -ReleaseCommit $ReleaseCommit -ArchiveSha256 $hash -NowUtc ([DateTimeOffset]::UtcNow) -MaximumBackupAgeMinutes $MaximumBackupAgeMinutes
$tool=Get-Command pg_restore.exe -ErrorAction SilentlyContinue
if(-not $tool){$tool=Get-Command pg_restore -ErrorAction SilentlyContinue}
if(-not $tool){throw 'pg_restore must be installed for read-only archive verification.'}
$toc=@(& $tool.Source '--list' $backup.archivePath 2>&1)
if($LASTEXITCODE -ne 0){throw 'pg_restore cannot inspect the source archive.'}
$inventory=Get-SbBackupArchiveTocStatus -Lines ([string[]]$toc)
if(-not $inventory.ValidFormat -or -not $inventory.FlywayTable -or -not $inventory.FlywayData){
    throw 'Backup is not a complete custom-format Flyway history archive.'
}
Write-Host 'RELEASE READINESS EVIDENCE: PASS (V12 backup, V15 isolated rehearsal, SHA-256, and reviewed commit).'
Write-Host 'NOT AUTHORIZED TO APPLY: Independent approval, an exclusive database migration gate, a maintenance window and operator rollback review are still required.'
Write-Host 'No connection to shared Supabase was made.'
