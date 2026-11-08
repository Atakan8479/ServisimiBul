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

    $safeHeadersAndScript = New-SafeFixture 'safe-headers-and-script'
    Set-FixtureContent $safeHeadersAndScript 'servisimibul-frontend/src/local-script.tsx' '<script src={"/assets/runtime.js"} />'
    Set-FixtureContent $safeHeadersAndScript 'servisimibul-backend/src/main/java/com/servisimibul/backend/SecurityHeaders.java' 'class SecurityHeaders { void apply(HttpServletResponse response) { response.setHeader("X-Content-Type-Options", "nosniff"); } }'
    Invoke-FixtureCheck $safeHeadersAndScript $true 'Same-origin script and unrelated response header'

    $localStorage = New-SafeFixture 'local-storage'
    Set-FixtureContent $localStorage 'servisimibul-frontend/src/tracking.ts' "localStorage.setItem('visitor', '1')"
    Invoke-FixtureCheck $localStorage $false 'localStorage trigger'

    $remoteScript = New-SafeFixture 'remote-script'
    Set-FixtureContent $remoteScript 'servisimibul-frontend/index.html' '<script src="https://example.test/tracker.js"></script>'
    Invoke-FixtureCheck $remoteScript $false 'Remote script trigger'

    $tsxRemoteScript = New-SafeFixture 'tsx-remote-script'
    Set-FixtureContent $tsxRemoteScript 'servisimibul-frontend/src/remote-script.tsx' '<script src={"https://example.test/tracker.js"} />'
    Invoke-FixtureCheck $tsxRemoteScript $false 'TSX remote script trigger'

    $tsxIframe = New-SafeFixture 'tsx-iframe'
    Set-FixtureContent $tsxIframe 'servisimibul-frontend/src/embed.tsx' '<iframe src="https://example.test/content" />'
    Invoke-FixtureCheck $tsxIframe $false 'TSX iframe trigger'

    $dynamicScript = New-SafeFixture 'dynamic-script'
    Set-FixtureContent $dynamicScript 'servisimibul-frontend/src/script-loader.ts' "document.createElement('script')"
    Invoke-FixtureCheck $dynamicScript $false 'Dynamic script creation trigger'

    $variableScript = New-SafeFixture 'variable-script'
    Set-FixtureContent $variableScript 'servisimibul-frontend/src/variable-script.tsx' '<script src={vendorScriptUrl} />'
    Invoke-FixtureCheck $variableScript $false 'Nonliteral script source trigger'

    $rawHtml = New-SafeFixture 'raw-html'
    Set-FixtureContent $rawHtml 'servisimibul-frontend/src/raw-html.ts' 'container.innerHTML = vendorMarkup'
    Invoke-FixtureCheck $rawHtml $false 'Raw HTML injection trigger'

    $dependency = New-SafeFixture 'dependency'
    Set-FixtureContent $dependency 'servisimibul-frontend/package.json' '{"dependencies":{"@segment/analytics-next":"1.0.0"}}'
    Invoke-FixtureCheck $dependency $false 'Analytics dependency trigger'

    $aliasedDependency = New-SafeFixture 'aliased-dependency'
    Set-FixtureContent $aliasedDependency 'servisimibul-frontend/package.json' '{"dependencies":{"metrics":"npm:@segment/analytics-next@1.0.0"}}'
    Invoke-FixtureCheck $aliasedDependency $false 'Aliased analytics dependency trigger'

    $extraSessionStorage = New-SafeFixture 'extra-session-storage'
    Set-FixtureContent $extraSessionStorage 'servisimibul-frontend/src/preferences.ts' "sessionStorage.setItem('marketing', 'yes')"
    Invoke-FixtureCheck $extraSessionStorage $false 'Unexpected sessionStorage trigger'

    $commercialMessage = New-SafeFixture 'commercial-message'
    Set-FixtureContent $commercialMessage 'servisimibul-backend/src/main/java/com/servisimibul/backend/MarketingSender.java' 'class MarketingSender { void sendCampaign() {} }'
    Invoke-FixtureCheck $commercialMessage $false 'Commercial message trigger'

    $additionalCookie = New-SafeFixture 'additional-cookie'
    Set-FixtureContent $additionalCookie 'servisimibul-backend/src/main/java/com/servisimibul/backend/TrackingCookie.java' 'class TrackingCookie { Object value() { return ResponseCookie.from("visitor", "1"); } }'
    Invoke-FixtureCheck $additionalCookie $false 'Additional backend cookie trigger'

    $setCookieHeader = New-SafeFixture 'set-cookie-header'
    Set-FixtureContent $setCookieHeader 'servisimibul-backend/src/main/java/com/servisimibul/backend/CookieHeader.java' 'class CookieHeader { void write(HttpServletResponse response) { response.setHeader("Set-Cookie", "visitor=1"); } }'
    Invoke-FixtureCheck $setCookieHeader $false 'HttpServletResponse setHeader cookie trigger'

    $addCookieHeader = New-SafeFixture 'add-cookie-header'
    Set-FixtureContent $addCookieHeader 'servisimibul-backend/src/main/java/com/servisimibul/backend/CookieHeader.java' 'class CookieHeader { void write(HttpServletResponse response) { response.addHeader(HttpHeaders.SET_COOKIE, "visitor=1"); } }'
    Invoke-FixtureCheck $addCookieHeader $false 'HttpServletResponse addHeader cookie trigger'

    $cookieStore = New-SafeFixture 'cookie-store'
    Set-FixtureContent $cookieStore 'servisimibul-frontend/src/cookie-store.ts' "cookieStore.set({ name: 'visitor', value: '1' })"
    Invoke-FixtureCheck $cookieStore $false 'Cookie Store API trigger'

    Write-Output 'Conditional privacy inventory tests passed (17 cases).'
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

exit 0

