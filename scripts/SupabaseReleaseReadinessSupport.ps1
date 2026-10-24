Set-StrictMode -Version Latest

function Assert-SbReleaseEvidencePair {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]$Backup,
        [Parameter(Mandatory=$true)]$Restore,
        [Parameter(Mandatory=$true)][string]$ProjectRef,
        [Parameter(Mandatory=$true)][string]$ReleaseCommit,
        [Parameter(Mandatory=$true)][string]$ArchiveSha256,
        [Parameter(Mandatory=$true)][DateTimeOffset]$NowUtc,
        [ValidateRange(1,1440)][int]$MaximumBackupAgeMinutes=120
    )
    if($ProjectRef -cnotmatch '^[a-z0-9]{20}$' -or $ReleaseCommit -cnotmatch '^[0-9a-f]{40}$' -or $ArchiveSha256 -cnotmatch '^[0-9a-f]{64}$'){
        throw 'Invalid explicit release identity or archive digest.'
    }
    foreach($field in @('projectRef','database','postgresMajor','flywayVersion','sourceSystemIdentifier','archiveSha256','releaseCommit','createdAtUtc','schema','format')){
        if($null -eq $Backup.PSObject.Properties[$field]){throw "Backup evidence missing required field: $field"}
    }
    foreach($field in @('projectRef','sourceSystemIdentifier','disposableSystemIdentifier','backupSha256','releaseCommit','rehearsalToolCommit','isolated','postgresMajor','flywayVersion','v12RestoreVerified','rehearsalTargetVersion','v15RehearsalVerified','verificationChecksPassed','testedAtUtc')){
        if($null -eq $Restore.PSObject.Properties[$field]){throw "Restore evidence missing required field: $field"}
    }
    if($Backup.projectRef -cne $ProjectRef -or $Restore.projectRef -cne $ProjectRef -or
       $Backup.database -cne 'postgres' -or $Backup.schema -cne 'public' -or $Backup.format -cne 'custom' -or
       [int]$Backup.postgresMajor -ne 17 -or [int]$Restore.postgresMajor -ne 17 -or
       [int]$Backup.flywayVersion -ne 12 -or [int]$Restore.flywayVersion -ne 12 -or
       $Backup.releaseCommit -cne $ReleaseCommit -or $Restore.releaseCommit -cne $ReleaseCommit -or
       $Restore.rehearsalToolCommit -cne $ReleaseCommit){
        throw 'Release evidence does not match the reviewed project, V12 source, or checked-out release.'
    }
    if(([string]$Backup.archiveSha256).ToLowerInvariant() -cne $ArchiveSha256 -or
       ([string]$Restore.backupSha256).ToLowerInvariant() -cne $ArchiveSha256){
        throw 'Backup and restore SHA-256 evidence does not match the archive.'
    }
    if([string]$Backup.sourceSystemIdentifier -cnotmatch '^[0-9]{10,30}$' -or
       [string]$Restore.sourceSystemIdentifier -cne [string]$Backup.sourceSystemIdentifier -or
       [string]$Restore.disposableSystemIdentifier -cnotmatch '^[0-9]{10,30}$' -or
       [string]$Restore.disposableSystemIdentifier -ceq [string]$Backup.sourceSystemIdentifier){
        throw 'A distinct isolated restore database identity has not been proved.'
    }
    if($Restore.isolated -cne $true -or $Restore.v12RestoreVerified -cne $true -or
       $Restore.v15RehearsalVerified -cne $true -or [int]$Restore.rehearsalTargetVersion -ne 15 -or
       [int]$Restore.verificationChecksPassed -ne 13){
        throw 'Disposable V12-to-V15 rehearsal evidence is missing or incomplete.'
    }
    $created=[DateTimeOffset]::MinValue
    $tested=[DateTimeOffset]::MinValue
    if(-not [DateTimeOffset]::TryParse([string]$Backup.createdAtUtc,[ref]$created) -or
       -not [DateTimeOffset]::TryParse([string]$Restore.testedAtUtc,[ref]$tested)){
        throw 'Release evidence timestamps are invalid.'
    }
    if($created -gt $tested -or $tested -gt $NowUtc.AddMinutes(2) -or
       $created -gt $NowUtc.AddMinutes(2) -or
       $NowUtc - $created -gt [TimeSpan]::FromMinutes($MaximumBackupAgeMinutes)){
        throw 'Backup is stale, future-dated, or newer than the restore rehearsal.'
    }
    return $true
}
