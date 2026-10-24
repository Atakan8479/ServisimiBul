[CmdletBinding()]
param([string]$PostgresBin)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'WindowsDevelopmentSupport.ps1')

# Disposable-only lock contention demonstration. No shared endpoint input exists.
$tools=Resolve-SbPostgres17Tools -PostgresBin $PostgresBin
$cluster=$null
$holder=$null
try {
    $cluster=Start-SbIsolatedPostgres -Tools $tools
    Assert-SbDisposableClusterIdentity -Cluster $cluster
    $lockKey=84791515
    $sqlPath=Join-Path $cluster.Root 'lock-holder.sql'
    # Session-level lock is held throughout pg_sleep, then the psql process exits.
    [IO.File]::WriteAllText($sqlPath,"SELECT pg_advisory_lock($lockKey); SELECT pg_sleep(12);")
    $saved=Get-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    try {
        $env:PGPASSWORD=$cluster.AdminPassword
        $arguments=@('--no-psqlrc','--set=ON_ERROR_STOP=1','--host=127.0.0.1',
            "--port=$($cluster.Port)","--username=$($cluster.AdminUser)",
            "--dbname=$($cluster.Database)","--file=$sqlPath")
        $holder=Start-Process -FilePath $tools.Psql -ArgumentList $arguments -PassThru -WindowStyle Hidden
    } finally {
        if($saved){$env:PGPASSWORD=$saved.Value}else{Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}
    }
    $found=$false
    for($n=0;$n -lt 40;$n++){
        if($holder.HasExited){throw 'Disposable lock holder exited unexpectedly.'}
        $count=@(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted AND classid=0 AND objid=$lockKey;")
        if(@($count|Where-Object{$_.ToString().Trim() -eq '1'}).Count -eq 1){$found=$true;break}
        Start-Sleep -Milliseconds 150
    }
    if(-not $found){throw 'Disposable advisory lock was not acquired in time.'}
    $contender=@(Invoke-SbPsql -Cluster $cluster -Database $cluster.Database -Username $cluster.AdminUser -Password $cluster.AdminPassword -Sql "SELECT CASE WHEN pg_try_advisory_lock($lockKey) THEN 'UNEXPECTED-ACQUIRED' ELSE 'CONFLICT-REJECTED' END;")
    if(@($contender|Where-Object{$_.ToString().Trim() -ceq 'CONFLICT-REJECTED'}).Count -ne 1){
        throw 'Second connection unexpectedly acquired advisory lock.'
    }
    Write-Host 'Disposable PostgreSQL 17 advisory lock conflict test passed; second session rejected.'
    Write-Host 'Advisory locks remain cooperative and are NOT a complete production migration exclusivity gate.'
}finally{
    if($holder -and -not $holder.HasExited){
        Stop-Process -Id $holder.Id -Force -ErrorAction SilentlyContinue
        $holder.WaitForExit(3000)|Out-Null
    }
    if($cluster){Stop-SbIsolatedPostgres -Cluster $cluster}
}
