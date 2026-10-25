[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [string]$EnvPath = (Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'servisimibul-backend') '.env')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'SharedSupabaseDevelopmentSupport.ps1')

function Set-SbLocalRuntimeConnection {
    [CmdletBinding(SupportsShouldProcess=$true)]
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw 'Backend .env is missing. Copy servisimibul-backend/.env.example to .env, then configure the private application-role password.'
    }
    $resolved=(Resolve-Path -LiteralPath $Path).Path
    $current=@([IO.File]::ReadAllLines($resolved))
    $expected=[ordered]@{
        SB_DB_JDBC_URL='jdbc:postgresql://aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require'
        SB_DB_USER='servisimibul_app.whftdzfbvpchmghttjkg'
    }
    $counts=@{}
    foreach($key in $expected.Keys){$counts[$key]=0}
    $updated=New-Object 'System.Collections.Generic.List[string]'
    foreach($line in $current){
        if($line -match '^\s*(SB_DB_JDBC_URL|SB_DB_USER)\s*='){
            $key=$Matches[1]
            $counts[$key]++
            $updated.Add("$key=$($expected[$key])")
        } else {
            $updated.Add($line)
        }
    }
    foreach($key in $expected.Keys){
        if($counts[$key] -gt 1){throw "Duplicate $key entries in .env; resolve duplicates manually."}
        if($counts[$key] -eq 0){$updated.Add("$key=$($expected[$key])")}
    }
    # Test the intended values before writing. Never print the private password.
    $passwordLines=@($current | Where-Object { $_ -match '^\s*SB_DB_PASSWORD\s*=' })
    if($passwordLines.Count -ne 1){
        throw 'Expected exactly one SB_DB_PASSWORD entry in backend .env. Configure it locally; never share it in chat.'
    }
    $values=Read-SbRuntimeEnvironmentFile -Path $resolved
    $values['SB_DB_JDBC_URL']=$expected['SB_DB_JDBC_URL']
    $values['SB_DB_USER']=$expected['SB_DB_USER']
    Assert-SbSharedRuntimeEnvironment -Values $values

    if($PSCmdlet.ShouldProcess($resolved,'Set only SB_DB_JDBC_URL and SB_DB_USER')){
        [IO.File]::WriteAllLines($resolved,[string[]]$updated,[Text.UTF8Encoding]::new($false))
        $confirmed=Read-SbRuntimeEnvironmentFile -Path $resolved
        Assert-SbSharedRuntimeEnvironment -Values $confirmed
        Write-Host 'Local backend .env runtime endpoint corrected. Password left unchanged.'
        Write-Host 'No database connection or migration was attempted.'
    }
}

Set-SbLocalRuntimeConnection -Path $EnvPath -WhatIf:$WhatIfPreference
