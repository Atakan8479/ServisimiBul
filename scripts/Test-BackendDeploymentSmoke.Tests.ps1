[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$smokeScript = Join-Path $PSScriptRoot 'Test-BackendDeploymentSmoke.ps1'

function Assert-Condition {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw $Message
    }
}

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        0
    )
    $listener.Start()
    try {
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    } finally {
        $listener.Stop()
    }
}

function Start-SmokeMockServer {
    param(
        [int]$RequestCount,
        [bool]$InvalidHealth = $false,
        [bool]$RequireAuthentication = $false
    )

    $port = Get-FreeTcpPort
    $job = Start-Job -ArgumentList $port, $RequestCount, $InvalidHealth, $RequireAuthentication -ScriptBlock {
        param($Port, $ExpectedRequests, $ReturnInvalidHealth, $RequireAuth)

        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $Port
        )
        $listener.Start()
        try {
            for ($index = 0; $index -lt $ExpectedRequests; $index++) {
                $acceptTask = $listener.AcceptTcpClientAsync()
                if (-not $acceptTask.Wait([TimeSpan]::FromSeconds(5))) {
                    throw 'Timed out waiting for a smoke-check request.'
                }
                $client = $acceptTask.Result
                try {
                    $stream = $client.GetStream()
                    $reader = [System.IO.StreamReader]::new(
                        $stream,
                        [System.Text.Encoding]::ASCII,
                        $false,
                        1024,
                        $true
                    )
                    $requestLine = $reader.ReadLine()
                    $path = ($requestLine -split ' ')[1]
                    $cookie = $null
                    while (($line = $reader.ReadLine()) -ne '') {
                        if ($line.StartsWith('Cookie:', [System.StringComparison]::OrdinalIgnoreCase)) {
                            $cookie = $line.Substring('Cookie:'.Length).Trim()
                        }
                    }
                    $statusCode = 200

                    if ($path -eq '/livez' -and $ReturnInvalidHealth) {
                        $body = '{"status":"UP","details":"must-not-be-exposed"}'
                    } elseif ($path -in @('/livez', '/readyz')) {
                        $body = '{"status":"UP"}'
                    } elseif ($path -eq '/api/v1/provinces') {
                        $body = '[]'
                    } elseif ($path -eq '/api/v1/auth/me' -and
                        (-not $RequireAuth -or $cookie -eq 'SBSESSION=smoke-secret')) {
                        $body = '{"role":"ADMIN"}'
                    } else {
                        $statusCode = 401
                        $body = '{"status":"UNAUTHORIZED"}'
                    }

                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                    $statusText = if ($statusCode -eq 200) { 'OK' } else { 'Unauthorized' }
                    $headers = @(
                        "HTTP/1.1 $statusCode $statusText"
                        'Content-Type: application/json'
                        "Content-Length: $($bytes.Length)"
                        'X-Content-Type-Options: nosniff'
                        'X-Frame-Options: DENY'
                        'Referrer-Policy: strict-origin-when-cross-origin'
                        'Permissions-Policy: camera=(), geolocation=(), microphone=()'
                        'Connection: close'
                        ''
                        ''
                    ) -join "`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                    $stream.Flush()
                    $reader.Dispose()
                } finally {
                    $client.Dispose()
                }
            }
        } finally {
            $listener.Stop()
        }
    }

    Start-Sleep -Milliseconds 300
    return [pscustomobject]@{
        BaseUri = "http://127.0.0.1:$port"
        Job = $job
    }
}

function Stop-SmokeMockServer {
    param($Server)
    if ($null -ne $Server -and $null -ne $Server.Job) {
        Stop-Job -Job $Server.Job -ErrorAction SilentlyContinue
        Remove-Job -Job $Server.Job -Force -ErrorAction SilentlyContinue
    }
}

$server = $null
try {
    $server = Start-SmokeMockServer -RequestCount 3
    $output = & pwsh -NoProfile -File $smokeScript -BaseUri $server.BaseUri `
        -AllowHttpForLocalTest -TimeoutSeconds 2 2>&1
    Assert-Condition ($LASTEXITCODE -eq 0) `
        ("Successful smoke fixture returned a non-zero exit code: {0}" -f ($output -join ' | '))
    Assert-Condition (($output -join "`n") -match 'smoke checks passed') `
        'Successful smoke fixture did not report completion.'
} finally {
    Stop-SmokeMockServer -Server $server
}

$server = $null
$previousCookie = [Environment]::GetEnvironmentVariable('SB_SMOKE_SESSION_COOKIE')
try {
    [Environment]::SetEnvironmentVariable('SB_SMOKE_SESSION_COOKIE', 'smoke-secret')
    $server = Start-SmokeMockServer -RequestCount 4 -RequireAuthentication $true
    $output = & pwsh -NoProfile -File $smokeScript -BaseUri $server.BaseUri `
        -AllowHttpForLocalTest -TimeoutSeconds 2 2>&1
    $combinedOutput = $output -join "`n"
    Assert-Condition ($LASTEXITCODE -eq 0) `
        ("Authenticated smoke fixture returned a non-zero exit code: {0}" -f `
            (($output -join ' | ') -replace [regex]::Escape('smoke-secret'), '[REDACTED]'))
    Assert-Condition ($combinedOutput -match 'Authenticated read-only smoke check passed') `
        'Authenticated smoke fixture did not execute the read-only check.'
    Assert-Condition ($combinedOutput -notmatch 'smoke-secret') `
        'Smoke script exposed the session cookie in output.'
} finally {
    [Environment]::SetEnvironmentVariable('SB_SMOKE_SESSION_COOKIE', $previousCookie)
    Stop-SmokeMockServer -Server $server
}

$server = $null
try {
    $server = Start-SmokeMockServer -RequestCount 1 -InvalidHealth $true
    $output = & pwsh -NoProfile -File $smokeScript -BaseUri $server.BaseUri `
        -AllowHttpForLocalTest -TimeoutSeconds 2 2>&1
    Assert-Condition ($LASTEXITCODE -ne 0) 'Unsafe health payload unexpectedly passed.'
    Assert-Condition (($output -join "`n") -notmatch 'must-not-be-exposed') `
        'Smoke failure output exposed the response body.'
} finally {
    Stop-SmokeMockServer -Server $server
}

Write-Output 'Backend deployment smoke script tests passed.'
