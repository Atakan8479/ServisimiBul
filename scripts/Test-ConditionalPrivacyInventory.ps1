[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-InventoryCheck {
    param([string]$Message)
    throw "APP-14 inventory check failed: $Message Review LEG-09/LEG-10 before implementation or activation."
}

function Get-RequiredContent {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Stop-InventoryCheck "Required inventory file is missing: $Path."
    }
    return Get-Content -Raw -LiteralPath $Path
}

$frontendRoot = Join-Path $RepositoryRoot 'servisimibul-frontend'
$frontendSource = Join-Path $frontendRoot 'src'
$indexPath = Join-Path $frontendRoot 'index.html'
$packagePath = Join-Path $frontendRoot 'package.json'
$backendSource = Join-Path $RepositoryRoot 'servisimibul-backend/src/main/java'
$authSenderPath = Join-Path $backendSource 'com/servisimibul/backend/auth/service/AuthEmailSender.java'

foreach ($requiredDirectory in @($frontendSource, $backendSource)) {
    if (-not (Test-Path -LiteralPath $requiredDirectory -PathType Container)) {
        Stop-InventoryCheck "Required inventory directory is missing: $requiredDirectory."
    }
}

$productionFrontendFiles = @(
    Get-ChildItem -LiteralPath $frontendSource -Recurse -File |
        Where-Object {
            $_.Extension -in @('.ts', '.tsx', '.js', '.jsx') -and
            $_.Name -notmatch '\.(test|spec)\.' -and
            $_.FullName -notmatch '[\\/](test|tests|__tests__)[\\/]'
        }
)

if ($productionFrontendFiles.Count -eq 0) {
    Stop-InventoryCheck 'No production frontend source files were found.'
}

$browserSignals = [ordered]@{
    'script-readable cookies' = '\bdocument\s*\.\s*cookie\b'
    'persistent local storage' = '\blocalStorage\b'
    'IndexedDB' = '\bindexedDB\b'
    'service workers' = '\bnavigator\s*\.\s*serviceWorker\b'
    'browser notification permission' = '\bNotification\s*\.\s*requestPermission\s*\('
    'analytics, advertising, or consent vendor integration' = '(?i)(gtag\s*\(|google-analytics|googletagmanager|mixpanel|amplitude|hotjar|posthog|cookiebot|onetrust)'
}

foreach ($file in $productionFrontendFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    foreach ($signal in $browserSignals.GetEnumerator()) {
        if ($content -match $signal.Value) {
            Stop-InventoryCheck "Detected $($signal.Key) in $($file.FullName)."
        }
    }
}

$sessionStorageFiles = @(
    $productionFrontendFiles | Where-Object {
        (Get-Content -Raw -LiteralPath $_.FullName) -match '\bsessionStorage\b'
    }
)
$expectedSessionStoragePath = (Join-Path $frontendSource 'features/auth/auth-api.ts')
if ($sessionStorageFiles.Count -ne 1 -or
    $sessionStorageFiles[0].FullName -ne $expectedSessionStoragePath) {
    Stop-InventoryCheck 'sessionStorage usage changed from the single auth-role navigation hint.'
}

$authApi = Get-RequiredContent $expectedSessionStoragePath
$allowedSessionCalls = [regex]::Matches(
    $authApi,
    'sessionStorage\s*\.\s*(?:getItem|removeItem)\s*\(\s*AUTH_ROLE_KEY\s*\)|sessionStorage\s*\.\s*setItem\s*\(\s*AUTH_ROLE_KEY\s*,'
).Count
$allSessionCalls = [regex]::Matches($authApi, '\bsessionStorage\s*\.').Count
if ($allSessionCalls -ne 3 -or $allowedSessionCalls -ne $allSessionCalls -or
    $authApi -notmatch 'const\s+AUTH_ROLE_KEY\s*=\s*[''"]servisimibul\.auth-role[''"]') {
    Stop-InventoryCheck 'The auth-role sessionStorage key or operations changed.'
}

$indexHtml = Get-RequiredContent $indexPath
if ($indexHtml -match '(?i)<script\b[^>]*\bsrc\s*=\s*["'']https?://' -or
    $indexHtml -match '(?i)<iframe\b') {
    Stop-InventoryCheck 'A remote script or iframe was added to the frontend entry document.'
}

try {
    $packageManifest = Get-RequiredContent $packagePath | ConvertFrom-Json -ErrorAction Stop
} catch {
    Stop-InventoryCheck "The frontend package manifest is invalid: $($_.Exception.Message)"
}
$productionDependencyNames = @(
    if ($null -ne $packageManifest.dependencies) {
        $packageManifest.dependencies.PSObject.Properties.Name
    }
)
$vendorDependencyPattern = '(?i)(analytics|tracking|pixel|mixpanel|amplitude|hotjar|posthog|cookiebot|onetrust|consent|gtag|tag-manager)'
$triggerDependencies = @($productionDependencyNames | Where-Object { $_ -match $vendorDependencyPattern })
if ($triggerDependencies.Count -gt 0) {
    Stop-InventoryCheck "Detected a review-triggering production dependency: $($triggerDependencies -join ', ')."
}

$commercialMessagePattern = '\b(?:sendMarketing|sendPromotional|sendPromotion|sendCampaign|sendSms|sendPush)\s*\('
$additionalCookiePattern = '(?i)(?:\bResponseCookie\b|\bnew\s+(?:jakarta\.servlet\.http\.)?Cookie\s*\(|\.addCookie\s*\(|\bCookieGenerator\b)'
$authSender = Get-RequiredContent $authSenderPath
if ($authSender -match $commercialMessagePattern) {
    Stop-InventoryCheck 'A commercial or non-email message operation was added to AuthEmailSender.'
}
foreach ($file in Get-ChildItem -LiteralPath $backendSource -Recurse -File -Filter '*.java') {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    if ($content -match $commercialMessagePattern) {
        Stop-InventoryCheck "Detected a commercial or non-email message operation in $($file.FullName)."
    }
    if ($content -match $additionalCookiePattern) {
        Stop-InventoryCheck "Detected an additional backend cookie API in $($file.FullName)."
    }
}

Write-Output 'APP-14 inventory check passed: essential session/security storage and account-email-only boundary unchanged.'
