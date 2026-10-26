[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

$runner = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'Test-RealFullStack.ps1')
$config = Get-Content -Raw -LiteralPath `
    (Join-Path $repositoryRoot 'servisimibul-frontend\playwright.real.config.ts')
$spec = Get-Content -Raw -LiteralPath `
    (Join-Path $repositoryRoot 'servisimibul-frontend\e2e-real\real-full-stack.spec.ts')
$workflow = Get-Content -Raw -LiteralPath `
    (Join-Path $repositoryRoot '.github\workflows\full-stack-e2e.yml')

Assert-Condition ($runner.Contains('Start-SbIsolatedPostgres')) `
    'J-03 does not create an A-12 disposable PostgreSQL instance.'
Assert-Condition ($runner.Contains("SERVER_ADDRESS = '127.0.0.1'")) `
    'J-03 does not restrict Spring Boot to loopback.'
Assert-Condition ($runner.Contains("SB_EMAIL_VERIFICATION_REQUIRED = 'false'")) `
    'J-03 does not explicitly select the reviewed local verification bypass.'
Assert-Condition ($runner.Contains("SPRING_PROFILES_ACTIVE = 'local'")) `
    'J-03 does not constrain the verification bypass to the local profile.'
Assert-Condition ($runner.Contains("SB_TEST_DB_DISPOSABLE = 'true'")) `
    'J-03 does not explicitly mark the parent registration database as disposable.'
Assert-Condition ($runner.Contains("SB_PARENT_REGISTRATION_ENABLED = 'true'")) `
    'J-03 does not explicitly enable parent registration in its isolated runtime.'
Assert-Condition ($runner.Contains("SB_PARENT_EMAIL_VERIFICATION_REQUIRED = 'false'")) `
    'J-03 does not select the approved parent verification policy.'
Assert-Condition ($runner.Contains("SB_DEMO_PARENT_BOOTSTRAP_ENABLED = 'false'")) `
    'J-03 still bootstraps a parent instead of exercising real registration.'
Assert-Condition ($runner.Contains("OPERATOR_APPROVAL_REQUIRED = 'true'")) `
    'J-03 does not exercise the safe-default approval workflow.'
Assert-Condition ($runner.Contains("SB_DEMAND_FEEDBACK_REMINDER_AFTER_OPEN = '5s'")) `
    'J-03 does not accelerate the reminder boundary for real scheduler verification.'
Assert-Condition ($runner.Contains("SB_DEMAND_FEEDBACK_EXPIRY_IF_UNOPENED = '15s'")) `
    'J-03 does not accelerate the unopened expiry boundary for real scheduler verification.'
Assert-Condition ($runner.Contains('Stop-SbIsolatedPostgres')) `
    'J-03 does not clean up its disposable database.'
Assert-Condition (-not $runner.Contains('supabase.co')) `
    'J-03 contains a forbidden Supabase target.'
Assert-Condition (-not $runner.Contains('backendEnvPath')) `
    'J-03 reads the ignored backend environment file.'
Assert-Condition ($config.Contains("trace: 'off'")) `
    'J-03 browser traces could retain session identifiers.'
Assert-Condition (-not $spec.Contains('.route(')) `
    'The real full-stack suite intercepts requests.'
Assert-Condition (-not $spec.Contains('installMockApi')) `
    'The real full-stack suite imports the mocked API.'
Assert-Condition ($workflow.Contains('CREATE TABLE test_harness.database_instance')) `
    'J-03 CI does not mark its PostgreSQL database as disposable.'
Assert-Condition ($workflow.Contains('SB_PARENT_REGISTRATION_ENABLED: "true"')) `
    'J-03 CI does not enable parent registration for its isolated browser run.'
Assert-Condition ($workflow.Contains('SB_PARENT_EMAIL_VERIFICATION_REQUIRED: "false"')) `
    'J-03 CI does not select the approved parent verification policy.'
Assert-Condition ($workflow.Contains('SB_DEMO_PARENT_BOOTSTRAP_ENABLED: "false"')) `
    'J-03 CI still bootstraps a parent instead of exercising real registration.'
Assert-Condition ($workflow.Contains('SB_DEMAND_FEEDBACK_SCHEDULER_INTERVAL: 500ms')) `
    'J-03 CI does not run the real lifecycle scheduler at the test interval.'
Assert-Condition (
    [regex]::Matches($workflow, 'SB_EMAIL_VERIFICATION_REQUIRED: "true"').Count -eq 2
) 'J-03 CI does not restore verification for migration-only processes.'

Write-Host 'J-03 real full-stack safety tests passed.'
