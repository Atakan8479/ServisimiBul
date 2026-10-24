[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$path = Join-Path $PSScriptRoot 'migrate-supabase.ps1'
$supportPath = Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1'
$restoreEvidencePath = Join-Path $PSScriptRoot 'Test-SupabaseMigration.RestoreEvidence.ps1'
$backupScriptPath = Join-Path $PSScriptRoot 'Backup-SupabaseV12.ps1'
function Assert-SbCondition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}
foreach ($scriptPath in @($path, $supportPath, $restoreEvidencePath, $backupScriptPath)) {
    $tokens=$null; $errors=$null
    $ast=[System.Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$errors)
    Assert-SbCondition ($null-ne$ast -and $errors.Count-eq 0) "PowerShell parsing failed for $scriptPath."
}

$backupSource=Get-Content -Raw -LiteralPath $backupScriptPath
Assert-SbCondition ($backupSource.Contains('Invoke-SbSupabaseMigrationPreflight')) 'Backup requires read-only V12 preflight.'
Assert-SbCondition ($backupSource.Contains('Assert-SbRuntimeConnection')) 'Backup must verify restricted runtime identity.'
Assert-SbCondition ($backupSource.Contains('--format=custom')) 'Backup must use custom format.'
Assert-SbCondition ($backupSource.Contains('--schema=public')) 'Backup must restrict to the app schema.'
Assert-SbCondition ($backupSource.Contains('Get-FileHash')) 'Backup must record SHA-256.'
Assert-SbCondition (-not $backupSource.Contains('migrate-supabase.ps1 -Apply')) 'Backup must never apply migrations.'
. $supportPath
$projectRef='abcdefghijklmnopqrst'
$directMigration=ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://db.$projectRef.supabase.co:5432/postgres?sslmode=verify-full" -ProjectRef $projectRef -User postgres -Role migration
$poolerMigration=ConvertTo-SbSupabaseEndpoint -JdbcUrl 'jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require' -ProjectRef $projectRef -User "postgres.$projectRef" -Role migration
$directRuntime=ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://db.$projectRef.supabase.co:5432/postgres?sslmode=require" -ProjectRef $projectRef -User servisimibul_app -Role runtime
$poolerRuntime=ConvertTo-SbSupabaseEndpoint -JdbcUrl 'jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require' -ProjectRef $projectRef -User "servisimibul_app.$projectRef" -Role runtime
Assert-SbSameDatabaseTarget $directMigration $directRuntime
Assert-SbSameDatabaseTarget $poolerMigration $poolerRuntime

function Assert-Rejected { param([scriptblock]$Action,[string]$Pattern)
    $caught=$null;try{& $Action}catch{$caught=$_}
    Assert-SbCondition ($null-ne$caught -and $caught.Exception.Message-match$Pattern) "Expected rejection matching $Pattern."
    Assert-SbCondition (-not $caught.Exception.Message.Contains('synthetic-password')) 'A failure exposed a password.'
}
Assert-Rejected { ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://db.$projectRef.supabase.co:5432/other?sslmode=require" -ProjectRef $projectRef -User postgres -Role migration } '/postgres'
Assert-Rejected { ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://db.$projectRef.supabase.co:5432/postgres" -ProjectRef $projectRef -User postgres -Role migration } 'sslmode'
Assert-Rejected { ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://db.$projectRef.supabase.co:5432/postgres?sslmode=require" -ProjectRef $projectRef -User servisimibul_app -Role migration } 'identity'
Assert-Rejected { ConvertTo-SbSupabaseEndpoint -JdbcUrl 'jdbc:postgresql://db.wrongproject00000000.supabase.co:5432/postgres?sslmode=require' -ProjectRef $projectRef -User postgres -Role migration } 'project direct'
Assert-Rejected { ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://postgres:synthetic-password@db.$projectRef.supabase.co:5432/postgres?sslmode=require" -ProjectRef $projectRef -User postgres -Role migration } 'credentials'
Assert-Rejected { ConvertTo-SbSupabaseEndpoint -JdbcUrl "jdbc:postgresql://db.$projectRef.supabase.co:5432/postgres?sslmode=disable&sslmode=require" -ProjectRef $projectRef -User postgres -Role migration } 'must not be repeated'
Assert-SbCondition ($directMigration.SslMode-ceq'verify-full' -and $poolerMigration.SslMode-ceq'require') 'Validated TLS mode was not retained for psql.'

$clientFixture=Join-Path ([IO.Path]::GetTempPath()) ("servisimibul-psql-fixture-"+[guid]::NewGuid().ToString('N')+'.cmd')
$savedSslMode=Get-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
$savedHostAddr=Get-Item Env:PGHOSTADDR -ErrorAction SilentlyContinue
$savedService=Get-Item Env:PGSERVICE -ErrorAction SilentlyContinue
try{
    [IO.File]::WriteAllText($clientFixture,"@echo %PGSSLMODE%`r`n@exit /b 0`r`n")
    $env:PGSSLMODE='disable'
    $env:PGHOSTADDR='192.0.2.21'
    $env:PGSERVICE='malicious-profile'
    $tlsOutput=Invoke-SbMigrationSql -Endpoint $poolerMigration -Sql 'SELECT 1;' -Client $clientFixture
    Assert-SbCondition ($tlsOutput-ceq'require') 'psql did not receive the validated TLS mode.'
    Assert-SbCondition ($env:PGSSLMODE-ceq'disable') 'SQL verification did not restore the caller TLS mode.'
    Assert-SbCondition ($env:PGHOSTADDR-ceq'192.0.2.21') 'PGHOSTADDR was not restored.'
    Assert-SbCondition ($env:PGSERVICE-ceq'malicious-profile') 'PGSERVICE was not restored.'
}finally{
    if($savedSslMode){$env:PGSSLMODE=$savedSslMode.Value}else{Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue}
    if($savedHostAddr){$env:PGHOSTADDR=$savedHostAddr.Value}else{Remove-Item Env:PGHOSTADDR -ErrorAction SilentlyContinue}
    if($savedService){$env:PGSERVICE=$savedService.Value}else{Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue}
    Remove-Item -LiteralPath $clientFixture -Force -ErrorAction SilentlyContinue
}

$tocFixture=@(
    '; Format: CUSTOM',
    '123; 1259 456 TABLE public flyway_schema_history postgres',
    '124; 0 456 TABLE DATA public flyway_schema_history postgres',
    '125; 1259 777 TABLE public app_user postgres'
)
$tocVerified=Get-SbBackupArchiveTocStatus -Lines $tocFixture
Assert-SbCondition ($tocVerified.ValidFormat -and $tocVerified.FlywayTable -and $tocVerified.FlywayData -and $tocVerified.TableCount -eq 2) 'Valid Flyway archive TOC rejected.'
$tocMissingData=Get-SbBackupArchiveTocStatus -Lines @($tocFixture|Where-Object{$_ -notmatch 'TABLE DATA'})
Assert-SbCondition (-not $tocMissingData.FlywayData) 'Missing Flyway history data was not detected.'
$tocWrongSchema=Get-SbBackupArchiveTocStatus -Lines @($tocFixture -replace 'TABLE public flyway_schema_history','TABLE other flyway_schema_history')
Assert-SbCondition (-not $tocWrongSchema.FlywayTable) 'Wrong-schema Flyway TOC was accepted.'

$artifacts=@(Get-SbMigrationArtifacts -RepositoryRoot $repositoryRoot)
Assert-SbCondition ($artifacts.Count-eq 15 -and $artifacts[12].Version-ceq'13' -and $artifacts[13].Version-ceq'14' -and $artifacts[14].Version-ceq'15') 'Pending migrations are not ordered V13, V14, V15.'
Assert-SbCondition (@($artifacts|Where-Object{$null-eq$_.Checksum}).Count-eq 0) 'A repository migration checksum is missing.'

# Runtime role must match in both modes; direct requires server TLS.
$script:preflightOutput='postgres|servisimibul_app|f'
function Invoke-SbMigrationSql { return $script:preflightOutput }
Assert-SbRuntimeConnection -Endpoint $poolerRuntime -Password 'synthetic-password' -Client unused
Assert-Rejected { Assert-SbRuntimeConnection -Endpoint $directRuntime -Password 'synthetic-password' -Client unused } 'TLS'
$script:preflightOutput='postgres|postgres|f'
Assert-Rejected { Assert-SbRuntimeConnection -Endpoint $poolerRuntime -Password 'synthetic-password' -Client unused } 'identity'
$script:preflightOutput='postgres|servisimibul_app|t'
Assert-SbRuntimeConnection -Endpoint $directRuntime -Password 'synthetic-password' -Client unused

# PostgreSQL boolean casts to text emit 'true'/'false', not single letters.
# Ensure fixed SQL normalizes every boolean field consumed by strict parsing.
$supportSql=Get-Content -Raw -LiteralPath $supportPath
Assert-SbCondition ($supportSql.Contains("CASE WHEN pg_is_in_recovery() THEN 't' ELSE 'f' END")) 'Recovery boolean must be normalized.'
Assert-SbCondition ($supportSql.Contains("CASE WHEN rolbypassrls THEN 't' ELSE 'f' END")) 'Role booleans must be normalized.'
Assert-SbCondition ($supportSql.Contains("CASE WHEN success THEN 't' ELSE 'f' END")) 'Flyway success boolean must be normalized.'

$historyLines=@('IDENTITY|postgres|postgres|170011|f|123456789012345678|t','RUNTIME|servisimibul_app|f|f|f|f|f')
for($index=0;$index-lt 12;$index++){$historyLines += "HISTORY|$($index+1)|$($artifacts[$index].Version)|$($artifacts[$index].Script)|$($artifacts[$index].Checksum)|t"}
$validPreflight=(@($historyLines)+@('COLLISIONS|0','ACTIVITY|0'))-join"`n"
$script:preflightOutput=$validPreflight
function Invoke-SbMigrationSql { return $script:preflightOutput }
# Direct requires server-observed TLS; pooler may terminate TLS upstream.
$script:preflightOutput=$validPreflight.Replace('|123456789012345678|t','|123456789012345678|f')
$verifiedPooler=Invoke-SbSupabaseMigrationPreflight -Endpoint $poolerMigration -RuntimeEndpoint $poolerRuntime -ExpectedSystemIdentifier '123456789012345678' -Artifacts $artifacts -Client 'unused'
Assert-SbCondition ($verifiedPooler.Version-eq 12) 'Session-pooler upstream TLS terminator rejected.'
Assert-Rejected { Invoke-SbSupabaseMigrationPreflight -Endpoint $directMigration -RuntimeEndpoint $directRuntime -ExpectedSystemIdentifier '123456789012345678' -Artifacts $artifacts -Client unused } 'TLS'
$script:preflightOutput=$validPreflight
$verified=Invoke-SbSupabaseMigrationPreflight -Endpoint $directMigration -RuntimeEndpoint $directRuntime -ExpectedSystemIdentifier '123456789012345678' -Artifacts $artifacts -Client 'unused'
Assert-SbCondition ($verified.Version-eq 12) 'Valid V12 preflight was rejected.'

$savedPassword=Get-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
try{
    $env:PGPASSWORD='migration-marker'
    function Invoke-SbMigrationSql { throw 'sanitized synthetic connection failure' }
    Assert-Rejected { Assert-SbRuntimeConnection -Endpoint $directRuntime -Password 'synthetic-password' -Client unused } 'sanitized'
    Assert-SbCondition ($env:PGPASSWORD-ceq'migration-marker') 'Runtime verification did not restore the migration password after failure.'
}finally{
    if($savedPassword){$env:PGPASSWORD=$savedPassword.Value}else{Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}
}
function Invoke-SbMigrationSql { return $script:preflightOutput }

$invalidCases=@(
    @{Name='wrong PostgreSQL version';Value=$validPreflight.Replace('|170011|','|160011|');Pattern='PostgreSQL version'},
    @{Name='missing history';Value=($validPreflight -split "`n"|Where-Object{$_ -notlike 'HISTORY|12|*'})-join"`n";Pattern='exactly successful'},
    @{Name='checksum mismatch';Value=$validPreflight.Replace("|$($artifacts[0].Checksum)|t","|123|t");Pattern='history mismatch'},
    @{Name='unexpected migration';Value=$validPreflight+"`nHISTORY|13|13|V13__unexpected.sql|1|t";Pattern='exactly successful'},
    @{Name='target collision';Value=$validPreflight.Replace('COLLISIONS|0','COLLISIONS|1');Pattern='collision'},
    @{Name='concurrent activity';Value=$validPreflight.Replace('ACTIVITY|0','ACTIVITY|1');Pattern='Concurrent'}
)
foreach($case in $invalidCases){$script:preflightOutput=$case.Value;Assert-Rejected { Invoke-SbSupabaseMigrationPreflight -Endpoint $directMigration -RuntimeEndpoint $directRuntime -ExpectedSystemIdentifier '123456789012345678' -Artifacts $artifacts -Client unused } $case.Pattern}
$script:preflightOutput=$validPreflight
Assert-Rejected { Assert-SbApplyEvidence -RepositoryRoot $repositoryRoot -ProjectRef $projectRef -ReleaseCommit ('0'*40) -ConfirmProjectRef $projectRef -Preflight $verified } 'reviewed release commit|Checked-out HEAD'

$script:verificationFixture = ''
function Invoke-SbMigrationSql { return $script:verificationFixture }
$checkLabels = @(
 'primary PostgreSQL 17 target','Flyway versions V1-V15 applied successfully',
 'exact application table inventory','exact application sequence inventory',
 'RLS enabled on every application table','exact runtime RLS policies',
 'runtime role is restricted','runtime role has exact table privileges',
 'public API roles have no direct table privileges','sequence privileges are least-privilege',
 'Flyway history is protected','operator business name remains nullable',
 'session expiry cleanup index exists'
)
$script:verificationFixture = (@($checkLabels | ForEach-Object { "$_|PASS|fixture" }) -join "`n")
Assert-SbPostMigrationVerification -Endpoint $directMigration -Client unused -VerificationFile unused
$script:verificationFixture = $script:verificationFixture.Replace('exact runtime RLS policies|PASS|fixture','exact runtime RLS policies|FAIL|fixture')
Assert-Rejected { Assert-SbPostMigrationVerification -Endpoint $directMigration -Client unused -VerificationFile unused } 'exact runtime RLS policies'
$script:verificationFixture = (@($checkLabels | Select-Object -Skip 1 | ForEach-Object { "$_|PASS|fixture" }) -join "`n")
Assert-Rejected { Assert-SbPostMigrationVerification -Endpoint $directMigration -Client unused -VerificationFile unused } 'missing='
$script:verificationFixture = $validPreflight
function Invoke-SbMigrationSql { return $script:preflightOutput }

$evidenceDirectory=Join-Path ([IO.Path]::GetTempPath()) ("servisimibul-ops01-evidence-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $evidenceDirectory|Out-Null
try{
    $releaseCommit=(& git -C $repositoryRoot rev-parse HEAD).Trim()
    $archivePath=Join-Path $evidenceDirectory 'backup.dump'
    $backupPath=Join-Path $evidenceDirectory 'backup.json'
    $restorePath=Join-Path $evidenceDirectory 'restore.json'
    $approvalPath=Join-Path $evidenceDirectory 'approval.json'
    [IO.File]::WriteAllText($archivePath,'synthetic disposable backup fixture')
    $archiveHash=(Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()

    Assert-Rejected { Assert-SbApplyEvidence -RepositoryRoot $repositoryRoot -ProjectRef $projectRef -ReleaseCommit $releaseCommit -ConfirmProjectRef $projectRef -Preflight $verified } 'Backup evidence file is required'

    @{
        projectRef=$projectRef;database='postgres';postgresMajor=17;flywayVersion=12
        archivePath=$archivePath;archiveSha256=('0'*64)
    }|ConvertTo-Json|Set-Content -LiteralPath $backupPath -Encoding UTF8
    Assert-Rejected { Assert-SbApplyEvidence -RepositoryRoot $repositoryRoot -ProjectRef $projectRef -ReleaseCommit $releaseCommit -ConfirmProjectRef $projectRef -BackupEvidencePath $backupPath -Preflight $verified } 'Backup checksum'

    @{
        projectRef=$projectRef;database='postgres';postgresMajor=17;flywayVersion=12
        archivePath=$archivePath;archiveSha256=$archiveHash
    }|ConvertTo-Json|Set-Content -LiteralPath $backupPath -Encoding UTF8
    Assert-Rejected { Assert-SbApplyEvidence -RepositoryRoot $repositoryRoot -ProjectRef $projectRef -ReleaseCommit $releaseCommit -ConfirmProjectRef $projectRef -BackupEvidencePath $backupPath -Preflight $verified } 'custom-format archive|pg_restore'

    @{
        isolated=$true;postgresMajor=17;flywayVersion=12;verificationChecksPassed=13
        backupSha256=$archiveHash
    }|ConvertTo-Json|Set-Content -LiteralPath $restorePath -Encoding UTF8
    Assert-Rejected { Assert-SbApplyEvidence -RepositoryRoot $repositoryRoot -ProjectRef $projectRef -ReleaseCommit $releaseCommit -ConfirmProjectRef $projectRef -BackupEvidencePath $backupPath -RestoreEvidencePath $restorePath -Preflight $verified } 'custom-format archive|pg_restore'
}finally{
    Remove-Item -LiteralPath $evidenceDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Assert-SbCondition ((Get-Content -Raw -LiteralPath $restoreEvidencePath).Contains('Initialize-SbOps01DisposableSupabaseRoles')) 'Restore must initialize inert platform roles in a disposable cluster.'
Assert-SbCondition ((Get-Content -Raw -LiteralPath $restoreEvidencePath).Contains('CREATE ROLE service_role NOLOGIN NOSUPERUSER')) 'Service role must not be privileged in the rehearsal.'
Assert-SbCondition ((Get-Content -Raw -LiteralPath $restoreEvidencePath).Contains('CREATE ROLE supabase_admin NOLOGIN NOSUPERUSER')) 'Supabase admin role must not be privileged in the rehearsal.'
Assert-SbCondition ((Get-Content -Raw -LiteralPath $restoreEvidencePath).Contains('Assert-SbDisposableClusterIdentity -Cluster $Cluster')) 'Role provisioning must verify disposable cluster identity.'

$v15Path=Join-Path $repositoryRoot 'servisimibul-backend/src/main/resources/db/migration/V15__harden_runtime_privileges.sql'
$v15=Get-Content -Raw -LiteralPath $v15Path
Assert-SbCondition ($v15.Contains('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM servisimibul_app')) 'V15 must revoke legacy table grants.'
Assert-SbCondition ($v15.Contains('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM servisimibul_app')) 'V15 must revoke legacy sequence grants.'
Assert-SbCondition ($v15.Contains('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public')) 'V15 must revoke postgres default ACL grants.'
Assert-SbCondition ($v15.Contains('public.flyway_schema_history is intentionally excluded') -or $v15.Contains('flyway_schema_history is intentionally excluded')) 'V15 must exclude Flyway history from runtime grants.'
Assert-SbCondition (-not $v15.Contains('FROM service_role') -and -not $v15.Contains('FROM supabase_admin')) 'V15 must leave platform roles alone.'
$verificationSource=Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'docs/10_MIGRATION_VERIFICATION.sql')
Assert-SbCondition ($verificationSource.Contains('Flyway versions V1-V15 applied successfully')) 'V15 SQL history verification missing.'
Assert-SbCondition ($verificationSource.Contains('no default runtime ACL')) 'V15 default ACL verification missing.'

$restoreScript = Get-Content -Raw -LiteralPath $restoreEvidencePath
Assert-SbCondition ($restoreScript.Contains('Get-SbBackupArchiveTocStatus')) 'Restore must validate the same archive TOC as the backup.'
Assert-SbCondition ($restoreScript.Contains('FlywayTable') -and $restoreScript.Contains('FlywayData')) 'Restore must verify Flyway schema and history data.'
Assert-SbCondition ($restoreScript.Contains('merge-base --is-ancestor') -and $restoreScript.Contains('diff --quiet')) 'A newer rehearsal must compare reviewed release inputs to the pinned backup commit.'
Assert-SbCondition ($restoreScript.Contains('rehearsalToolCommit')) 'Restore evidence must record exact tool revision.'

$restoreSource=Get-Content -Raw -LiteralPath $restoreEvidencePath
Assert-SbCondition ($restoreSource.Contains('Assert-SbDisposableClusterIdentity')) 'Restore rehearsal must verify disposable target.'
Assert-SbCondition ($restoreSource.Contains('Start-SbIsolatedPostgres')) 'Restore rehearsal must create isolated PostgreSQL.'
Assert-SbCondition ($restoreSource.Contains('v12RestoreVerified')) 'V12 restore check missing.'
Assert-SbCondition ($restoreSource.Contains('v15RehearsalVerified')) 'V15 rehearsal check missing.'
Assert-SbCondition ($restoreSource.Contains('Assert-SbPostMigrationVerification')) '13 post-migration checks missing.'
$source=(Get-Content -Raw $path)+(Get-Content -Raw $supportPath)
foreach($forbidden in @('baselineOnMigrate=true','flyway repair','flyway clean','--clean','SB_ADMIN_BOOTSTRAP_ENABLED=true')){Assert-SbCondition (-not$source.Contains($forbidden)) "Forbidden operation detected: $forbidden"}
Assert-SbCondition ($source.Contains('BEGIN TRANSACTION READ ONLY;')) 'Preflight is not explicitly read-only.'
Assert-SbCondition ($source.Contains('external approval mechanism')) 'Shared apply does not retain its final fail-closed gate.'
Assert-SbCondition ($source.Contains('verificationChecksPassed')) 'Restore verification evidence is not required.'
Assert-SbCondition ($source.Contains('Concurrent migration-like')) 'Concurrent activity is not rejected.'

if($PSVersionTable.PSEdition-eq'Core'){
    $lockJob=Start-Job -ScriptBlock {
        param($SupportPath,$Ref)
        . $SupportPath
        $held=Enter-SbMigrationMutex $Ref
        try{Write-Output 'LOCKED';Start-Sleep -Seconds 8}finally{Exit-SbMigrationMutex $held}
    } -ArgumentList $supportPath,$projectRef
    try{
        $deadline=[DateTimeOffset]::UtcNow.AddSeconds(10);$locked=$false
        while(-not$locked -and [DateTimeOffset]::UtcNow-lt$deadline){$locked=@(Receive-Job $lockJob -Keep|Where-Object{$_-eq'LOCKED'}).Count-gt 0;if(-not$locked){Start-Sleep -Milliseconds 100}}
        Assert-SbCondition $locked 'Concurrent-lock test process did not acquire its mutex.'
        Assert-Rejected { $null=Enter-SbMigrationMutex $projectRef } 'already holds'
    }finally{Stop-Job $lockJob -ErrorAction SilentlyContinue;Remove-Job $lockJob -Force -ErrorAction SilentlyContinue}
}
$mutex=Enter-SbMigrationMutex $projectRef;Exit-SbMigrationMutex $mutex

Write-Host 'OPS-01 offline endpoint, artifact, evidence and fail-closed safety tests passed.'
