[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
    [string]$ExpectedSystemIdentifier,
    [string]$MigrationJdbcUrl,
    [string]$MigrationUser,
    [string]$RuntimeJdbcUrl,
    [string]$RuntimeUser,
    [string]$PsqlPath = 'psql.exe',
    [string]$ReleaseCommit,
    [string]$BackupEvidencePath,
    [string]$RestoreEvidencePath,
    [string]$ApprovalEvidencePath,
    [string]$ConfirmProjectRef,
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')

if (-not $ProjectRef -or -not $ExpectedSystemIdentifier -or -not $MigrationJdbcUrl -or
    -not $MigrationUser -or -not $RuntimeJdbcUrl -or -not $RuntimeUser) {
    throw 'Provide the project ref, database system identifier, and separate migration/runtime connection identities.'
}
if (-not $env:PGPASSWORD) {
    throw 'PGPASSWORD is required in the invoking process; never supply passwords in arguments.'
}
if (-not $env:SB_DB_PASSWORD) {
    throw 'SB_DB_PASSWORD is required only to verify the restricted runtime connection; never supply it in arguments.'
}
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationEndpoint = ConvertTo-SbSupabaseEndpoint -JdbcUrl $MigrationJdbcUrl `
    -ProjectRef $ProjectRef -User $MigrationUser -Role migration
$runtimeEndpoint = ConvertTo-SbSupabaseEndpoint -JdbcUrl $RuntimeJdbcUrl `
    -ProjectRef $ProjectRef -User $RuntimeUser -Role runtime
Assert-SbSameDatabaseTarget -MigrationEndpoint $migrationEndpoint -RuntimeEndpoint $runtimeEndpoint
Assert-SbRuntimeConnection -Endpoint $runtimeEndpoint -Password $env:SB_DB_PASSWORD -Client $PsqlPath
$artifacts = Get-SbMigrationArtifacts -RepositoryRoot $repositoryRoot
$preflight = Invoke-SbSupabaseMigrationPreflight -Endpoint $migrationEndpoint `
    -RuntimeEndpoint $runtimeEndpoint -ExpectedSystemIdentifier $ExpectedSystemIdentifier `
    -Artifacts $artifacts -Client $PsqlPath

Write-Host 'Read-only preflight passed: exact V1-V12 history/checksums, restricted runtime role, ordered V13/V14 artifacts, no target collisions, and no competing migration activity.'
Write-Host ('Target: ' + $migrationEndpoint.Mode + ', project-scoped host verified, database=postgres.')
Write-Host 'No schema, row, secret or migration state was changed.'

if ($Apply) {
    $migrationMutex = Enter-SbMigrationMutex -ProjectRef $ProjectRef
    try {
        Assert-SbApplyEvidence -RepositoryRoot $repositoryRoot -ProjectRef $ProjectRef `
            -ReleaseCommit $ReleaseCommit -BackupEvidencePath $BackupEvidencePath `
            -RestoreEvidencePath $RestoreEvidencePath -ApprovalEvidencePath $ApprovalEvidencePath `
            -ConfirmProjectRef $ConfirmProjectRef -Preflight $preflight
        throw 'All local apply prerequisites passed, but shared execution remains fail-closed: OPS-01 has no independently verifiable external approval mechanism. A reviewed operator must implement or supply that mechanism before Flyway may run.'
    } finally {
        Exit-SbMigrationMutex -Mutex $migrationMutex
    }
}
