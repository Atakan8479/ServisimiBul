[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Condition([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$runner = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'Start-ControlledPilot.ps1')
$seed = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'fixtures\j05\seed.sql')

Assert-Condition ($runner.Contains('Start-SbIsolatedPostgres')) 'J-05 does not use disposable PostgreSQL.'
Assert-Condition ($runner.Contains("SERVER_ADDRESS = '127.0.0.1'")) 'J-05 is not loopback-only.'
Assert-Condition ($runner.Contains("OPERATOR_APPROVAL_REQUIRED = 'false'")) 'J-05 does not select the approved pilot policy.'
Assert-Condition ($runner.Contains("SPRING_PROFILES_ACTIVE = 'local'")) 'J-05 bypasses are not local-profile constrained.'
Assert-Condition ($runner.Contains('Get-SbFreeTcpPort')) 'J-05 does not allocate collision-safe ports.'
Assert-Condition ($runner.Contains('Stop-SbIsolatedPostgres')) 'J-05 does not clean up disposable state.'
Assert-Condition ($runner.Contains('SB_DB_MIGRATION_PASSWORD = $null')) 'J-05 does not clear migration credentials before runtime.'
Assert-Condition ($runner.Contains('SB_ADMIN_1_PASSWORD = $null')) 'J-05 does not clear inherited ADMIN credentials.'
Assert-Condition ($runner.Contains('SPRING_MAIL_PASSWORD = $null')) 'J-05 does not clear inherited SMTP credentials.'
Assert-Condition (-not $runner.Contains('supabase.co')) 'J-05 contains a forbidden Supabase target.'
Assert-Condition (-not $runner.Contains('backendEnvPath')) 'J-05 reads an ignored backend environment file.'
Assert-Condition ([regex]::Matches($seed, 'J05-SCHOOL-').Count -eq 3) 'J-05 must provide three synthetic schools.'
Assert-Condition (-not $seed.Contains('@')) 'J-05 fixtures must not contain participant identities.'

Write-Host 'J-05 controlled-pilot safety tests passed.'
