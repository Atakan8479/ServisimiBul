Set-StrictMode -Version Latest

function ConvertTo-SbQueryMap {
    param([Parameter(Mandatory = $true)][Uri]$Uri)
    $query = @{}
    foreach ($part in $Uri.Query.TrimStart('?').Split('&', [System.StringSplitOptions]::RemoveEmptyEntries)) {
        $pieces = $part.Split('=', 2)
        $name = [Uri]::UnescapeDataString($pieces[0]).ToLowerInvariant()
        if ($query.ContainsKey($name)) { throw "JDBC query parameter '$name' must not be repeated." }
        $query[$name] = if ($pieces.Count -eq 2) { [Uri]::UnescapeDataString($pieces[1]) } else { '' }
    }
    return $query
}

function ConvertTo-SbSupabaseEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$JdbcUrl,
        [Parameter(Mandatory = $true)][string]$ProjectRef,
        [Parameter(Mandatory = $true)][string]$User,
        [Parameter(Mandatory = $true)][ValidateSet('migration', 'runtime')][string]$Role
    )
    if ($JdbcUrl -cnotmatch '^jdbc:postgresql://') { throw "$Role endpoint must be a PostgreSQL JDBC URL." }
    try { $uri = [Uri]$JdbcUrl.Substring(5) } catch { throw "$Role JDBC URL is invalid." }
    if ($uri.UserInfo -or $uri.Fragment -or $uri.AbsolutePath -cne '/postgres') {
        throw "$Role connection must target /postgres without URL credentials or fragments."
    }
    $query = ConvertTo-SbQueryMap -Uri $uri
    if ($query.ContainsKey('password') -or $query.ContainsKey('user')) { throw "$Role credentials must not appear in the JDBC URL." }
    if (-not $query.ContainsKey('sslmode') -or $query['sslmode'].ToLowerInvariant() -notin @('require', 'verify-ca', 'verify-full')) {
        throw "$Role connection requires sslmode=require, verify-ca, or verify-full."
    }
    $directHost = "db.$ProjectRef.supabase.co"
    $isDirect = $uri.Host -ceq $directHost -and $uri.Port -eq 5432
    $isSessionPooler = $uri.Host -match '^aws-[a-z0-9-]+\.pooler\.supabase\.com$' -and $uri.Port -eq 5432
    if (-not $isDirect -and -not $isSessionPooler) {
        throw "$Role connection must use the project direct endpoint or Dashboard session-pooler endpoint on port 5432."
    }
    $baseUser = if ($Role -eq 'migration') { 'postgres' } else { 'servisimibul_app' }
    $expectedUser = if ($isDirect) { $baseUser } else { "$baseUser.$ProjectRef" }
    if ($User -cne $expectedUser) { throw "$Role identity does not match its project-scoped restricted format." }
    [pscustomobject]@{ Host=$uri.Host; Port=$uri.Port; Database='postgres'; User=$User; BaseUser=$baseUser; ProjectRef=$ProjectRef; SslMode=$query['sslmode'].ToLowerInvariant(); Mode=if($isDirect){'direct'}else{'session-pooler'} }
}

function Assert-SbSameDatabaseTarget {
    param($MigrationEndpoint, $RuntimeEndpoint)
    if ($MigrationEndpoint.ProjectRef -cne $RuntimeEndpoint.ProjectRef -or $MigrationEndpoint.Database -cne $RuntimeEndpoint.Database) {
        throw 'Migration and runtime identities do not identify the same approved project/database.'
    }
}

function Get-SbCrc32Table {
    $table = [uint32[]]::new(256)
    for ($index=0; $index -lt 256; $index++) {
        $value=[uint32]$index
        for($bit=0;$bit -lt 8;$bit++) { if(($value -band 1)-ne 0){$value=[uint32]([uint32]3988292384 -bxor ($value -shr 1))}else{$value=$value -shr 1} }
        $table[$index]=$value
    }
    return $table
}

function Get-SbFlywayChecksum {
    param([Parameter(Mandatory = $true)][string]$Path)
    $crc=[uint32]::MaxValue; $table=Get-SbCrc32Table
    foreach($line in [System.IO.File]::ReadAllLines($Path,[System.Text.UTF8Encoding]::new($false))){
        foreach($byte in [System.Text.Encoding]::UTF8.GetBytes($line)){ $crc=$table[($crc -bxor $byte) -band 0xFF] -bxor ($crc -shr 8) }
    }
    $unsigned=[uint32]($crc -bxor [uint32]::MaxValue)
    return [BitConverter]::ToInt32([BitConverter]::GetBytes($unsigned),0)
}

function Get-SbMigrationArtifacts {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)
    $root=Join-Path $RepositoryRoot 'servisimibul-backend\src\main\resources\db\migration'
    $files=@(Get-ChildItem -LiteralPath $root -File -Filter 'V*.sql')
    if($files.Count -ne 14){throw 'Repository must contain exactly Flyway V1-V14 migration artifacts.'}
    $artifacts=@()
    for($version=1;$version -le 14;$version++){
        $matches=@($files|Where-Object{$_.Name -match "^V$version`__.+\.sql$"})
        if($matches.Count -ne 1){throw "Repository migration V$version is missing or ambiguous."}
        $artifacts += [pscustomobject]@{Version=[string]$version;Script=$matches[0].Name;Checksum=Get-SbFlywayChecksum $matches[0].FullName;Path=$matches[0].FullName}
    }
    return $artifacts
}

function Invoke-SbMigrationSql {
    param($Endpoint,[string]$Sql,[string]$File,[Parameter(Mandatory=$true)][string]$Client)
    if([string]::IsNullOrWhiteSpace($Sql) -eq [string]::IsNullOrWhiteSpace($File)){throw 'Supply exactly one SQL source.'}
    $arguments=@('--no-psqlrc','--no-password','--set=ON_ERROR_STOP=1','--no-align','--tuples-only','--quiet','--host',$Endpoint.Host,'--port',[string]$Endpoint.Port,'--username',$Endpoint.User,'--dbname',$Endpoint.Database)
    if($File){$arguments+=@('--file',$File)}else{$arguments+=@('--command',$Sql)}
    # libpq honors inherited PGHOSTADDR/PGSERVICE/PGOPTIONS and other PG*
    # variables even when a host and user are supplied explicitly. Strip all
    # PG* overrides except the intentionally process-scoped PGPASSWORD.
    $inheritedPg=@{}
    foreach($item in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)){
        if($item.Name -cne 'PGPASSWORD'){
            $inheritedPg[$item.Name]=$item.Value
            Remove-Item -LiteralPath ("Env:" + $item.Name) -ErrorAction SilentlyContinue
        }
    }
    try{
        if($Endpoint.SslMode){$env:PGSSLMODE=$Endpoint.SslMode}
        $output=@(& $Client @arguments 2>&1)
        $exitCode=$LASTEXITCODE
    }finally{
        foreach($item in @(Get-ChildItem Env:PG* -ErrorAction SilentlyContinue)){
            if($item.Name -cne 'PGPASSWORD'){
                Remove-Item -LiteralPath ("Env:" + $item.Name) -ErrorAction SilentlyContinue
            }
        }
        foreach($name in $inheritedPg.Keys){
            Set-Item -LiteralPath ("Env:" + $name) -Value $inheritedPg[$name]
        }
    }
    if($exitCode -ne 0){throw 'PostgreSQL verification failed; inspect credentials and the approved target outside this sanitized log.'}
    return (($output|ForEach-Object{[string]$_})-join "`n").Trim()
}

function Assert-SbRuntimeConnection {
    param($Endpoint,[Parameter(Mandatory=$true)][string]$Password,[Parameter(Mandatory=$true)][string]$Client)
    $previous=Get-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    try{
        $env:PGPASSWORD=$Password
        $output=Invoke-SbMigrationSql -Endpoint $Endpoint -Client $Client -Sql @'
BEGIN TRANSACTION READ ONLY;
SELECT current_database()||'|'||current_user||'|'||CASE WHEN ssl THEN 't' ELSE 'f' END
FROM pg_stat_ssl WHERE pid=pg_backend_pid();
COMMIT;
'@
    }finally{if($previous){$env:PGPASSWORD=$previous.Value}else{Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}}
    $lines=@($output -split "`r?`n"|Where-Object{$_ -match '^[^|]+\|[^|]+\|[tf]$'})
    if($lines.Count-ne 1 -or $lines[0]-cne("postgres|$($Endpoint.BaseUser)|t")){throw 'Restricted runtime connection identity, database, or TLS could not be verified.'}
}

function Invoke-SbSupabaseMigrationPreflight {
    param($Endpoint,$RuntimeEndpoint,[string]$ExpectedSystemIdentifier,[object[]]$Artifacts,[string]$Client)
    if($ExpectedSystemIdentifier -cnotmatch '^[0-9]{10,30}$'){throw 'Expected database system identifier must be the numeric value recorded for the approved project.'}
    $output=Invoke-SbMigrationSql -Endpoint $Endpoint -Client $Client -Sql @'
BEGIN TRANSACTION READ ONLY;
SELECT 'IDENTITY|'||current_database()||'|'||current_user||'|'||current_setting('server_version_num')||'|'||pg_is_in_recovery()||'|'||(SELECT system_identifier FROM pg_control_system())||'|'||CASE WHEN ssl THEN 't' ELSE 'f' END FROM pg_stat_ssl WHERE pid=pg_backend_pid();
SELECT 'RUNTIME|'||rolname||'|'||rolsuper||'|'||rolcreatedb||'|'||rolcreaterole||'|'||rolinherit||'|'||rolbypassrls FROM pg_roles WHERE rolname='servisimibul_app';
SELECT 'HISTORY|'||installed_rank||'|'||version||'|'||script||'|'||COALESCE(checksum::text,'null')||'|'||success FROM public.flyway_schema_history ORDER BY installed_rank;
SELECT 'COLLISIONS|'||count(*) FROM (
 SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('demand_service_feedback','demand_lifecycle_event','moderation_case','content_report','moderation_audit_event')
 UNION ALL SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='demand' AND column_name IN ('closure_reason','closed_at')
 UNION ALL SELECT 1 FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname='demand_closure_check'
) collisions;
SELECT 'ACTIVITY|'||count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND datname=current_database() AND state<>'idle' AND (wait_event_type='Lock' OR query ~* '(flyway_schema_history|alter[[:space:]]+table|create[[:space:]]+table)');
COMMIT;
'@
    $lines=@($output -split "`r?`n"|Where-Object{$_ -match '^(IDENTITY|RUNTIME|HISTORY|COLLISIONS|ACTIVITY)\|'})
    $identity=@($lines|Where-Object{$_ -like 'IDENTITY|*'}); if($identity.Count-ne 1){throw 'Could not verify a unique database identity.'}
    $p=$identity[0].Split('|')
    if($p.Count-ne 7 -or $p[1]-cne'postgres' -or $p[2]-cne$Endpoint.BaseUser -or [int]$p[3]-lt 170000 -or [int]$p[3]-ge 180000 -or $p[4]-cne'f' -or $p[5]-cne$ExpectedSystemIdentifier -or $p[6]-cne't'){
        throw 'Database, migration role, PostgreSQL version, primary status, system identity, or TLS does not match the approved target.'
    }
    $runtime=@($lines|Where-Object{$_ -like 'RUNTIME|*'}); if($runtime.Count-ne 1 -or $runtime[0]-cne'RUNTIME|servisimibul_app|f|f|f|f|f'){throw 'Restricted servisimibul_app role is missing or elevated.'}
    $history=@($lines|Where-Object{$_ -like 'HISTORY|*'}); if($history.Count-ne 12){throw 'Flyway history must contain exactly successful V1-V12 rows.'}
    for($i=0;$i-lt 12;$i++){ $h=$history[$i].Split('|');$a=$Artifacts[$i];if($h.Count-ne 6 -or $h[2]-cne$a.Version -or $h[3]-cne$a.Script -or $h[4]-cne[string]$a.Checksum -or $h[5]-cne't'){throw "Flyway history mismatch at expected V$($a.Version); stop for artifact review."} }
    if(@($lines|Where-Object{$_-ceq'COLLISIONS|0'}).Count-ne 1){throw 'Unexpected V13/V14 object or altered-column collision exists.'}
    if(@($lines|Where-Object{$_-ceq'ACTIVITY|0'}).Count-ne 1){throw 'Concurrent migration-like database activity is present.'}
    return [pscustomobject]@{Version=12;SystemIdentifier=$p[5];ArtifactCount=$Artifacts.Count}
}

function Read-SbEvidenceJson {
    param([string]$Path,[string]$Label)
    if(-not $Path -or -not(Test-Path -LiteralPath $Path -PathType Leaf)){throw "$Label evidence file is required."}
    try{return Get-Content -Raw -LiteralPath $Path|ConvertFrom-Json}catch{throw "$Label evidence is invalid JSON."}
}

function Enter-SbMigrationMutex {
    param([Parameter(Mandatory = $true)][string]$ProjectRef)
    $mutex=[System.Threading.Mutex]::new($false,"ServisimiBul-OPS01-$ProjectRef")
    try{$acquired=$mutex.WaitOne(0)}catch{$mutex.Dispose();throw 'Could not establish local migration exclusivity.'}
    if(-not$acquired){$mutex.Dispose();throw 'Another OPS-01 migration process already holds the local execution lock.'}
    return $mutex
}

function Exit-SbMigrationMutex {
    param([System.Threading.Mutex]$Mutex)
    if($Mutex){try{$Mutex.ReleaseMutex()}finally{$Mutex.Dispose()}}
}

function Assert-SbApplyEvidence {
    param([string]$RepositoryRoot,[string]$ProjectRef,[string]$ReleaseCommit,[string]$BackupEvidencePath,[string]$RestoreEvidencePath,[string]$ApprovalEvidencePath,[string]$ConfirmProjectRef,$Preflight)
    if($ConfirmProjectRef-cne$ProjectRef){throw 'Apply confirmation must exactly repeat the approved project reference.'}
    if($ReleaseCommit-cnotmatch'^[0-9a-f]{40}$'){throw 'A full reviewed release commit SHA is required.'}
    $head=(& git -C $RepositoryRoot rev-parse HEAD 2>$null).Trim();if($LASTEXITCODE-ne 0 -or $head-cne$ReleaseCommit){throw 'Checked-out HEAD is not the reviewed release commit.'}
    & git -C $RepositoryRoot diff --quiet HEAD -- 'servisimibul-backend/src/main/resources/db/migration';if($LASTEXITCODE-ne 0){throw 'Migration artifacts differ from the reviewed release commit.'}
    $backup=Read-SbEvidenceJson $BackupEvidencePath 'Backup'
    if($backup.projectRef-cne$ProjectRef -or $backup.database-cne'postgres' -or [int]$backup.postgresMajor-ne 17 -or [int]$backup.flywayVersion-ne 12 -or -not(Test-Path -LiteralPath $backup.archivePath -PathType Leaf)){throw 'Backup evidence does not match the V12 PostgreSQL 17 target.'}
    $hash=(Get-FileHash -Algorithm SHA256 -LiteralPath $backup.archivePath).Hash.ToLowerInvariant();if($hash-cne([string]$backup.archiveSha256).ToLowerInvariant()){throw 'Backup checksum validation failed.'}
    # Validate that the archive is actually readable by PostgreSQL tooling,
    # not merely an arbitrary file with a matching SHA-256.
    $restoreTool=Get-Command pg_restore.exe -ErrorAction SilentlyContinue
    if(-not$restoreTool){$restoreTool=Get-Command pg_restore -ErrorAction SilentlyContinue}
    if(-not$restoreTool){throw 'PostgreSQL pg_restore is required to inspect backup archive.'}
    $archiveList=@(& $restoreTool.Source --list $backup.archivePath 2>&1)
    if($LASTEXITCODE-ne 0 -or @($archiveList|Where-Object{[string]$_ -match '^;[[:space:]]*Format: CUSTOM'}).Count-ne 1){
        throw 'Backup archive is not a readable PostgreSQL custom-format archive.'
    }
    $restore=Read-SbEvidenceJson $RestoreEvidencePath 'Restore test'
    if(-not$restore.isolated -or [int]$restore.postgresMajor-ne 17 -or [int]$restore.flywayVersion-ne 12 -or [int]$restore.verificationChecksPassed-ne 13 -or ([string]$restore.backupSha256).ToLowerInvariant()-cne$hash){
        throw 'Disposable restore-test evidence is missing or inconsistent.'
    }
    # V12 restore verification and V14 rehearsal are distinct evidence phases:
    # the V14-only 13-check verifier cannot pass on an unmodified V12 restore.
    if([string]$restore.sourceSystemIdentifier-cne[string]$Preflight.SystemIdentifier -or
       [string]::IsNullOrWhiteSpace([string]$restore.disposableSystemIdentifier) -or
       [string]$restore.disposableSystemIdentifier-ceq[string]$Preflight.SystemIdentifier -or
       [int]$restore.rehearsalTargetVersion-ne 14 -or
       -not$restore.v12RestoreVerified -or -not$restore.v14RehearsalVerified){
        throw 'Restore evidence must identify a separate disposable database, verified V12 restore, and V14 migration rehearsal.'
    }
    $approval=Read-SbEvidenceJson $ApprovalEvidencePath 'Approval';if($approval.projectRef-cne$ProjectRef -or $approval.releaseCommit-cne$ReleaseCommit -or $approval.authorization-cne'APPLY_V13_V14' -or [string]::IsNullOrWhiteSpace($approval.approvedBy) -or ([string]$approval.backupSha256).ToLowerInvariant()-cne$hash){throw 'Approval evidence does not bind the target, release, and verified backup.'}
    if([DateTimeOffset]::Parse($approval.expiresAtUtc)-le[DateTimeOffset]::UtcNow){throw 'Approval evidence has expired.'}
    if($Preflight.Version-ne 12){throw 'Apply requires a fresh successful V12 preflight.'}
}

function Assert-SbPostMigrationVerification {
    param($Endpoint,[string]$Client,[string]$VerificationFile)
    $output=Invoke-SbMigrationSql -Endpoint $Endpoint -Client $Client -File $VerificationFile
    $results=@($output -split "`r?`n"|Where-Object{$_ -match '\|(PASS|FAIL)\|'})
    if($results.Count-ne 13 -or @($results|Where-Object{$_ -match '\|FAIL\|'}).Count-ne 0){throw 'Post-migration verification did not return exactly 13 PASS results.'}
}
