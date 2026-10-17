[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [uri]$BaseUri,

    [ValidateRange(1, 60)]
    [int]$TimeoutSeconds = 10,

    [ValidatePattern('^[A-Z][A-Z0-9_]*$')]
    [string]$SessionCookieEnvironmentVariable = 'SB_SMOKE_SESSION_COOKIE',

    [switch]$AllowHttpForLocalTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Origin {
    param([uri]$Uri)

    $isHttps = $Uri.Scheme -eq 'https'
    $isLocalHttp = $AllowHttpForLocalTest -and
        $Uri.Scheme -eq 'http' -and
        $Uri.Host -in @('localhost', '127.0.0.1', '::1')
    $isRoot = [string]::IsNullOrEmpty($Uri.AbsolutePath) -or $Uri.AbsolutePath -eq '/'

    if ((-not $isHttps -and -not $isLocalHttp) -or
        -not [string]::IsNullOrEmpty($Uri.UserInfo) -or
        -not [string]::IsNullOrEmpty($Uri.Query) -or
        -not [string]::IsNullOrEmpty($Uri.Fragment) -or
        -not $isRoot) {
        throw 'BaseUri must be an HTTPS origin. Local loopback HTTP is allowed only with -AllowHttpForLocalTest.'
    }
}

function Invoke-SmokeGet {
    param(
        [string]$Path,
        [hashtable]$Headers = @{}
    )

    $uri = '{0}{1}' -f $BaseUri.AbsoluteUri.TrimEnd('/'), $Path
    try {
        return Invoke-WebRequest -Uri $uri -Method Get -Headers $Headers `
            -TimeoutSec $TimeoutSeconds -MaximumRedirection 0 -UseBasicParsing
    } catch {
        $status = $null
        $responseProperty = $_.Exception.PSObject.Properties['Response']
        if ($null -ne $responseProperty -and $null -ne $responseProperty.Value) {
            $statusProperty = $responseProperty.Value.PSObject.Properties['StatusCode']
            if ($null -ne $statusProperty) {
                $status = [int]$statusProperty.Value
            }
        }
        if ($null -eq $status) {
            throw "GET $Path failed before an HTTP response was received."
        }
        throw "GET $Path returned HTTP $status."
    }
}

function Assert-StatusOnlyHealth {
    param(
        [string]$Path,
        [Microsoft.PowerShell.Commands.BasicHtmlWebResponseObject]$Response
    )

    if ($Response.StatusCode -ne 200) {
        throw "GET $Path returned HTTP $($Response.StatusCode), expected 200."
    }
    try {
        $payload = $Response.Content | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw "GET $Path did not return valid JSON."
    }
    $propertyNames = @($payload.PSObject.Properties.Name)
    if ($propertyNames.Count -ne 1 -or $propertyNames[0] -ne 'status' -or $payload.status -ne 'UP') {
        throw "GET $Path must return only a top-level UP status."
    }
}

function Assert-Header {
    param(
        [Microsoft.PowerShell.Commands.BasicHtmlWebResponseObject]$Response,
        [string]$Name,
        [string]$ExpectedValue
    )

    $actual = @($Response.Headers[$Name]) -join ', '
    if ($actual -ne $ExpectedValue) {
        throw "Response header $Name did not match the expected safe value."
    }
}

Assert-Origin -Uri $BaseUri

$liveness = Invoke-SmokeGet -Path '/livez'
Assert-StatusOnlyHealth -Path '/livez' -Response $liveness
Assert-Header -Response $liveness -Name 'X-Content-Type-Options' -ExpectedValue 'nosniff'
Assert-Header -Response $liveness -Name 'X-Frame-Options' -ExpectedValue 'DENY'
Assert-Header -Response $liveness -Name 'Referrer-Policy' -ExpectedValue 'strict-origin-when-cross-origin'
Assert-Header -Response $liveness -Name 'Permissions-Policy' `
    -ExpectedValue 'camera=(), geolocation=(), microphone=()'
if ($BaseUri.Scheme -eq 'https') {
    $hsts = @($liveness.Headers['Strict-Transport-Security']) -join ', '
    if ([string]::IsNullOrWhiteSpace($hsts) -or $hsts -notmatch '^max-age=31536000') {
        throw 'HTTPS response did not include the expected HSTS policy.'
    }
}

$readiness = Invoke-SmokeGet -Path '/readyz'
Assert-StatusOnlyHealth -Path '/readyz' -Response $readiness

$publicResponse = Invoke-SmokeGet -Path '/api/v1/provinces'
if ($publicResponse.StatusCode -ne 200) {
    throw "Anonymous public read returned HTTP $($publicResponse.StatusCode), expected 200."
}
if ((@($publicResponse.Headers['Content-Type']) -join ', ') -notmatch '^application/json') {
    throw 'Anonymous public read did not return JSON.'
}

$sessionCookie = [Environment]::GetEnvironmentVariable($SessionCookieEnvironmentVariable)
if (-not [string]::IsNullOrWhiteSpace($sessionCookie)) {
    $authenticatedResponse = Invoke-SmokeGet -Path '/api/v1/auth/me' -Headers @{
        Cookie = "SBSESSION=$sessionCookie"
    }
    if ($authenticatedResponse.StatusCode -ne 200) {
        throw "Authenticated read returned HTTP $($authenticatedResponse.StatusCode), expected 200."
    }
    Write-Output 'Authenticated read-only smoke check passed.'
} else {
    Write-Output "Authenticated read-only check skipped; $SessionCookieEnvironmentVariable is not set."
}

Write-Output 'Backend deployment smoke checks passed.'
