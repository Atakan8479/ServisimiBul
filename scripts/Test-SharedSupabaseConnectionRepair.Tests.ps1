[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$scriptPath=Join-Path $PSScriptRoot 'Set-SharedSupabaseConnection.ps1'
$parseErrors=$null
$null=[System.Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$null,[ref]$parseErrors)
if(@($parseErrors).Count -ne 0){throw 'Shared connection repair script is invalid PowerShell.'}
$source=Get-Content -Raw -LiteralPath $scriptPath
foreach($token in @('SupportsShouldProcess','SB_DB_JDBC_URL','SB_DB_USER','SB_DB_PASSWORD',
                      'Assert-SbSharedRuntimeEnvironment','WhatIfPreference')){
    if(-not $source.Contains($token)){throw ('Missing safe connection repair requirement: '+$token)}
}
Write-Host 'Local Supabase connection repair safety tests passed.'
