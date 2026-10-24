[CmdletBinding()]
param([string]$JavaHome,[string]$PostgresBin)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repositoryRoot=Split-Path -Parent $PSScriptRoot
$backendDirectory=Join-Path $repositoryRoot 'servisimibul-backend'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')
. (Join-Path $PSScriptRoot 'SupabaseMigrationSupport.ps1')

$cluster=$null
function Invoke-MigrationStage {
    param($Cluster,$JavaRuntime,[string]$TariffDirectory,[string]$Target,[bool]$ValidateSchema)
    $environment=@{
        JAVA_HOME=$JavaRuntime.Home;SPRING_PROFILES_ACTIVE='migration'
        SB_DB_JDBC_URL=$Cluster.RuntimeJdbcUrl;SB_DB_USER=$Cluster.RuntimeUser;SB_DB_PASSWORD=$Cluster.RuntimePassword
        SPRING_DATASOURCE_URL=$Cluster.RuntimeJdbcUrl;SPRING_DATASOURCE_USERNAME=$Cluster.RuntimeUser;SPRING_DATASOURCE_PASSWORD=$Cluster.RuntimePassword
        SB_DB_MIGRATION_JDBC_URL=$Cluster.AdminJdbcUrl;SB_DB_MIGRATION_USER=$Cluster.AdminUser;SB_DB_MIGRATION_PASSWORD=$Cluster.AdminPassword
        SPRING_FLYWAY_URL=$Cluster.AdminJdbcUrl;SPRING_FLYWAY_USER=$Cluster.AdminUser;SPRING_FLYWAY_PASSWORD=$Cluster.AdminPassword
        SB_FLYWAY_ENABLED='true';SPRING_FLYWAY_ENABLED='true';SPRING_FLYWAY_TARGET=if($Target){$Target}else{$null}
        SPRING_JPA_HIBERNATE_DDL_AUTO=if($ValidateSchema){'validate'}else{'none'}
        SPRING_SQL_INIT_MODE='never';SB_ADMIN_BOOTSTRAP_ENABLED='false';SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED='false'
        SB_MAIL_ENABLED='false';SERVISIMIBUL_EMAIL_ENABLED='false';SB_DEMAND_FEEDBACK_SCHEDULER_ENABLED='false'
        SB_TARIFF_STORAGE_DIR=$TariffDirectory
    }
    $previous=Set-SbTemporaryEnvironment $environment
    try{Push-Location $backendDirectory;try{& '.\mvnw.cmd' --batch-mode '-Dspring-boot.run.profiles=migration' '-Dspring-boot.run.arguments=--spring.main.web-application-type=none' spring-boot:run;if($LASTEXITCODE-ne 0){throw 'Disposable migration stage failed.'}}finally{Pop-Location}}finally{Restore-SbEnvironment $previous}
}

function Assert-MigrationSchemaInventory {
    param($Cluster)
    $requiredConstraints=@(
        'demand_support_status_check','demand_closure_check','demand_service_feedback_support_fk',
        'demand_service_feedback_publication_event_fk','demand_service_feedback_unique',
        'demand_service_feedback_status_check','demand_service_feedback_open_check',
        'demand_service_feedback_reminder_check','demand_service_feedback_evaluation_check',
        'demand_lifecycle_event_demand_fk','demand_lifecycle_event_type_check',
        'moderation_case_demand_fk','moderation_case_comment_fk','moderation_case_service_response_fk',
        'moderation_case_moderator_fk','moderation_case_target_type_check','moderation_case_status_check',
        'moderation_case_resolution_check','moderation_case_reason_check','content_report_case_fk',
        'content_report_reporter_fk','content_report_unique_reporter_case','content_report_role_check',
        'content_report_reason_check','content_report_explanation_check','moderation_audit_case_fk',
        'moderation_audit_moderator_fk','moderation_audit_action_check','moderation_audit_reason_check'
    )
    $requiredIndexes=@(
        'demand_service_feedback_due_idx','demand_service_feedback_support_idx','demand_lifecycle_event_demand_idx',
        'moderation_case_active_comment_unique','moderation_case_active_demand_unique',
        'moderation_case_active_response_unique','moderation_case_queue_idx','content_report_case_created_idx',
        'content_report_reporter_created_idx','content_report_reason_idx','moderation_audit_case_created_idx'
    )
    $actualConstraints=@(Invoke-SbPsql -Cluster $Cluster -Database $Cluster.Database -Username $Cluster.AdminUser -Password $Cluster.AdminPassword -Sql "select conname from pg_constraint where connamespace='public'::regnamespace order by conname;")
    $actualIndexes=@(Invoke-SbPsql -Cluster $Cluster -Database $Cluster.Database -Username $Cluster.AdminUser -Password $Cluster.AdminPassword -Sql "select indexname from pg_indexes where schemaname='public' order by indexname;")
    $missingConstraints=@($requiredConstraints|Where-Object{$_ -cnotin $actualConstraints})
    $missingIndexes=@($requiredIndexes|Where-Object{$_ -cnotin $actualIndexes})
    if($missingConstraints.Count-ne 0){throw "Missing V13/V14 constraints: $($missingConstraints -join ', ')."}
    if($missingIndexes.Count-ne 0){throw "Missing V13/V14 indexes: $($missingIndexes -join ', ')."}
}

try{
    $java=Resolve-SbJavaRuntime $JavaHome
    $tools=Resolve-SbPostgres17Tools $PostgresBin
    $cluster=Start-SbIsolatedPostgres $tools
    $tariffs=Join-Path $cluster.Root 'tariffs';New-Item -ItemType Directory $tariffs|Out-Null
    Invoke-MigrationStage $cluster $java $tariffs '12' $false

    $artifacts=@(Get-SbMigrationArtifacts $repositoryRoot)
    $history=@(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql "select version || '|' || script || '|' || checksum from flyway_schema_history where version is not null order by installed_rank;")
    if($history.Count-ne 12){throw 'Disposable V12 history count mismatch.'}
    for($i=0;$i-lt 12;$i++){if($history[$i]-cne("{0}|{1}|{2}" -f $artifacts[$i].Version,$artifacts[$i].Script,$artifacts[$i].Checksum)){throw "Repository/Flyway checksum mismatch at V$($i+1)."}}

    Invoke-MigrationStage $cluster $java $tariffs '' $true
    Invoke-MigrationStage $cluster $java $tariffs '' $true
    Assert-MigrationSchemaInventory $cluster
    $endpoint=[pscustomobject]@{Host='127.0.0.1';Port=$cluster.Port;User=$cluster.AdminUser;Database=$cluster.Database;SslMode=$null}
    $previousPassword=Get-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    try{$env:PGPASSWORD=$cluster.AdminPassword;Assert-SbPostMigrationVerification -Endpoint $endpoint -Client $tools.Psql -VerificationFile (Join-Path $repositoryRoot 'docs\10_MIGRATION_VERIFICATION.sql')}finally{if($previousPassword){$env:PGPASSWORD=$previousPassword.Value}else{Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}}
    Write-Host 'OPS-01 disposable PostgreSQL 17 V12-to-V14, repeat no-op, Hibernate and 13-check verification passed.'
}finally{if($cluster){Stop-SbIsolatedPostgres $cluster}}
