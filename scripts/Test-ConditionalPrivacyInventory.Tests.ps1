[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$verifier = Join-Path $PSScriptRoot 'Test-ConditionalPrivacyInventory.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("servisimibul-app14-tests-" + [guid]::NewGuid().ToString('N'))

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}
function Set-FixtureContent {
    param([string]$Root, [string]$RelativePath, [string]$Content)
    $path = Join-Path $Root $RelativePath
    $parent = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Set-Content -LiteralPath $path -Value $Content -Encoding utf8NoBOM
}

function New-SafeFixture {
    param([string]$Name)
    $root = Join-Path $testRoot $Name
    Set-FixtureContent $root 'servisimibul-frontend/src/features/auth/auth-api.ts' @'
const AUTH_ROLE_KEY = 'servisimibul.auth-role'
sessionStorage.getItem(AUTH_ROLE_KEY)
sessionStorage.removeItem(AUTH_ROLE_KEY)
sessionStorage.setItem(AUTH_ROLE_KEY, 'PARENT')
'@
    Set-FixtureContent $root 'servisimibul-frontend/src/main.tsx' 'export const application = true'
    Set-FixtureContent $root 'servisimibul-frontend/index.html' '<script type="module" src="/src/main.tsx"></script>'
    Set-FixtureContent $root 'servisimibul-frontend/package.json' '{"dependencies":{"react":"1.0.0"}}'
    Set-FixtureContent $root 'servisimibul-backend/src/main/java/com/servisimibul/backend/auth/service/AuthEmailSender.java' @'
interface AuthEmailSender {
    void sendVerification(String email, String token);
    void sendPasswordReset(String email, String token);
    void sendEmailChangeVerification(String email, String token);
}
'@
    return $root
}

function Invoke-FixtureCheck {
    param([string]$Root, [bool]$ShouldPass, [string]$Case)
    $output = @(& pwsh -NoProfile -File $verifier -RepositoryRoot $Root 2>&1)
    $exitCode = $LASTEXITCODE
    if ($ShouldPass) {
        Assert-Condition ($exitCode -eq 0) "$Case should pass but failed: $($output -join ' ')"
    } else {
        Assert-Condition ($exitCode -ne 0) "$Case should fail closed but passed."
        Assert-Condition (($output -join ' ') -match 'APP-14 inventory check failed') "$Case did not report the APP-14 failure contract."
    }
}

try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null

    $safe = New-SafeFixture 'safe'
    Invoke-FixtureCheck $safe $true 'Safe baseline'

    $localStorage = New-SafeFixture 'local-storage'
    Set-FixtureContent $localStorage 'servisimibul-frontend/src/tracking.ts' "localStorage.setItem('visitor', '1')"
    Invoke-FixtureCheck $localStorage $false 'localStorage trigger'

    $remoteScript = New-SafeFixture 'remote-script'
    Set-FixtureContent $remoteScript 'servisimibul-frontend/index.html' '<script src="https://example.test/tracker.js"></script>'
    Invoke-FixtureCheck $remoteScript $false 'Remote script trigger'

    $dependency = New-SafeFixture 'dependency'
    Set-FixtureContent $dependency 'servisimibul-frontend/package.json' '{"dependencies":{"@segment/analytics-next":"1.0.0"}}'
    Invoke-FixtureCheck $dependency $false 'Analytics dependency trigger'

    $extraSessionStorage = New-SafeFixture 'extra-session-storage'
    Set-FixtureContent $extraSessionStorage 'servisimibul-frontend/src/preferences.ts' "sessionStorage.setItem('marketing', 'yes')"
    Invoke-FixtureCheck $extraSessionStorage $false 'Unexpected sessionStorage trigger'

    $commercialMessage = New-SafeFixture 'commercial-message'
    Set-FixtureContent $commercialMessage 'servisimibul-backend/src/main/java/com/servisimibul/backend/MarketingSender.java' 'class MarketingSender { void sendCampaign() {} }'
    Invoke-FixtureCheck $commercialMessage $false 'Commercial message trigger'

    $additionalCookie = New-SafeFixture 'additional-cookie'
    Set-FixtureContent $additionalCookie 'servisimibul-backend/src/main/java/com/servisimibul/backend/TrackingCookie.java' 'class TrackingCookie { Object value() { return ResponseCookie.from("visitor", "1"); } }'
    Invoke-FixtureCheck $additionalCookie $false 'Additional backend cookie trigger'

    Write-Output 'Conditional privacy inventory tests passed (7 cases).'
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

exit 0

