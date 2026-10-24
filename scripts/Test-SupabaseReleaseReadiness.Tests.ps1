[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SupabaseReleaseReadinessSupport.ps1')
function Expect-Rejection {
    param([scriptblock]$Action,[string]$Pattern)
    $errorMessage=$null
    try{& $Action|Out-Null}catch{$errorMessage=$_.Exception.Message}
    if(-not $errorMessage -or $errorMessage -notmatch $Pattern){throw "Expected fail-closed rejection: $Pattern; actual=$errorMessage"}
}
$ref='abcdefghijklmnopqrst'
$sha='a'*40
$digest='b'*64
$now=[DateTimeOffset]::UtcNow
$backup=[pscustomobject]@{
 projectRef=$ref;database='postgres';postgresMajor=17;flywayVersion=12
 sourceSystemIdentifier='1234567890123456789';archiveSha256=$digest;releaseCommit=$sha
 createdAtUtc=$now.AddMinutes(-15).ToString('o');schema='public';format='custom'
}
$restore=[pscustomobject]@{
 projectRef=$ref;sourceSystemIdentifier=$backup.sourceSystemIdentifier
 disposableSystemIdentifier='9234567890123456789';backupSha256=$digest
 releaseCommit=$sha;rehearsalToolCommit=$sha;isolated=$true
 postgresMajor=17;flywayVersion=12;v12RestoreVerified=$true
 rehearsalTargetVersion=15;v15RehearsalVerified=$true;verificationChecksPassed=13
 testedAtUtc=$now.AddMinutes(-5).ToString('o')
}
$args=@{Backup=$backup;Restore=$restore;ProjectRef=$ref;ReleaseCommit=$sha;ArchiveSha256=$digest;NowUtc=$now;MaximumBackupAgeMinutes=120}
if(-not(Assert-SbReleaseEvidencePair @args)){throw 'Valid evidence rejected.'}
$restore.verificationChecksPassed=12
Expect-Rejection { Assert-SbReleaseEvidencePair @args } 'rehearsal evidence'
$restore.verificationChecksPassed=13
$restore.disposableSystemIdentifier=$backup.sourceSystemIdentifier
Expect-Rejection { Assert-SbReleaseEvidencePair @args } 'isolated restore'
$restore.disposableSystemIdentifier='9234567890123456789'
$restore.rehearsalToolCommit='c'*40
Expect-Rejection { Assert-SbReleaseEvidencePair @args } 'checked-out release'
$restore.rehearsalToolCommit=$sha
$backup.createdAtUtc=$now.AddMinutes(-130).ToString('o')
Expect-Rejection { Assert-SbReleaseEvidencePair @args } 'stale'
$backup.createdAtUtc=$now.AddMinutes(-15).ToString('o')
$restore.v15RehearsalVerified=$false
Expect-Rejection { Assert-SbReleaseEvidencePair @args } 'rehearsal evidence'
Write-Host 'OPS-01 release readiness evidence fail-closed tests passed.'
