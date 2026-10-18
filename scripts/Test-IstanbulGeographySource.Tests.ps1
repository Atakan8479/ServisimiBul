[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$verifier = Join-Path $PSScriptRoot 'Test-IstanbulGeographySource.ps1'
$districtNames = @(
    'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar',
    'Bahçelievler', 'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş',
    'Beykoz', 'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece', 'Çatalca',
    'Çekmeköy', 'Esenler', 'Esenyurt', 'Eyüpsultan', 'Fatih',
    'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane', 'Kartal',
    'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
    'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli',
    'Tuzla', 'Ümraniye', 'Üsküdar', 'Zeytinburnu'
)

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

function Start-GeographyMockServer {
    param(
        [Parameter(Mandatory = $true)][string]$Scenario,
        [Parameter(Mandatory = $true)][int]$RequestCount
    )

    $port = Get-FreeTcpPort
    $job = Start-Job -ArgumentList $port, $Scenario, $RequestCount, $districtNames -ScriptBlock {
        param($Port, $FixtureScenario, $ExpectedRequests, $OfficialDistrictNames)

        $districts = for ($index = 0; $index -lt $OfficialDistrictNames.Count; $index++) {
            [pscustomobject]@{
                id = $index + 1
                name = $OfficialDistrictNames[$index]
                provinceId = 34
                stats = [pscustomobject]@{
                    neighborhoodCount = if ($index -eq 0) { 963 } else { 0 }
                }
            }
        }
        if ($FixtureScenario -eq 'WrongDistrictName') {
            $districts[0].name = 'Yanlış İlçe'
        }

        $neighborhoods = for ($index = 1; $index -le 963; $index++) {
            [pscustomobject]@{
                id = $index
                name = "Mahalle $index"
                provinceId = 34
                districtId = 1
            }
        }
        if ($FixtureScenario -eq 'DuplicateNeighborhood') {
            $neighborhoods[1].id = 1
        }

        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $Port
        )
        $listener.Start()
        $metaRequests = 0
        try {
            for ($requestIndex = 0; $requestIndex -lt $ExpectedRequests; $requestIndex++) {
                $acceptTask = $listener.AcceptTcpClientAsync()
                if (-not $acceptTask.Wait([TimeSpan]::FromSeconds(5))) {
                    throw 'Timed out waiting for verifier request.'
                }
                $client = $acceptTask.Result
                try {
                    $stream = $client.GetStream()
                    $reader = [System.IO.StreamReader]::new(
                        $stream,
                        [System.Text.Encoding]::ASCII,
                        $false,
                        4096,
                        $true
                    )
                    $requestLine = $reader.ReadLine()
                    $target = ($requestLine -split ' ')[1]
                    while ($reader.ReadLine() -ne '') {}

                    $statusCode = 200
                    if ($target -eq '/meta') {
                        $metaRequests++
                        if ($FixtureScenario -eq 'Retry' -and $metaRequests -eq 1) {
                            $statusCode = 503
                            $payload = @{ error = @{ code = 'TEMPORARY'; status = 503 } }
                        } else {
                            $payload = @{
                                data = @{
                                    datasetVersion = '2025'
                                    lastUpdated = '2026-05-21'
                                }
                            }
                        }
                    } elseif ($target -eq '/provinces/34') {
                        $payload = @{
                            data = @{ id = 34; name = 'İstanbul' }
                            meta = @{
                                datasetVersion = '2025'
                                lastUpdated = '2026-05-21'
                            }
                        }
                    } elseif ($target.StartsWith('/districts?')) {
                        $payload = @{
                            data = @($districts)
                            meta = @{
                                count = 39
                                total = 39
                                limit = 100
                                offset = 0
                                datasetVersion = '2025'
                                lastUpdated = '2026-05-21'
                            }
                        }
                    } elseif ($target.StartsWith('/neighborhoods?')) {
                        $query = [System.Web.HttpUtility]::ParseQueryString(
                            ([uri]"http://localhost$target").Query
                        )
                        $offset = [int]$query['offset']
                        $limit = [int]$query['limit']
                        $page = if ($FixtureScenario -eq 'MissingPage' -and $offset -gt 0) {
                            @()
                        } else {
                            @($neighborhoods | Select-Object -Skip $offset -First $limit)
                        }
                        $lastUpdated = if ($FixtureScenario -eq 'MetadataMismatch') {
                            '2099-01-01'
                        } else {
                            '2026-05-21'
                        }
                        $payload = @{
                            data = $page
                            meta = @{
                                count = $page.Count
                                total = 963
                                limit = $limit
                                offset = $offset
                                datasetVersion = '2025'
                                lastUpdated = $lastUpdated
                            }
                        }
                    } else {
                        $statusCode = 404
                        $payload = @{ error = @{ code = 'NOT_FOUND'; status = 404 } }
                    }

                    $body = $payload | ConvertTo-Json -Depth 8 -Compress
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                    $statusText = if ($statusCode -eq 200) { 'OK' } else { 'Error' }
                    $headers = @(
                        "HTTP/1.1 $statusCode $statusText"
                        'Content-Type: application/json; charset=utf-8'
                        "Content-Length: $($bytes.Length)"
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

function Stop-GeographyMockServer {
    param($Server)
    if ($null -ne $Server -and $null -ne $Server.Job) {
        Stop-Job -Job $Server.Job -ErrorAction SilentlyContinue
        Remove-Job -Job $Server.Job -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-VerifierFixture {
    param(
        [Parameter(Mandatory = $true)][string]$Scenario,
        [Parameter(Mandatory = $true)][int]$RequestCount,
        [int]$MaxAttempts = 1
    )

    $server = $null
    try {
        $server = Start-GeographyMockServer -Scenario $Scenario -RequestCount $RequestCount
        $output = & pwsh -NoProfile -File $verifier -BaseUri $server.BaseUri `
            -AllowHttpForLocalTest -NeighborhoodPageSize 500 -TimeoutSeconds 2 `
            -MaxAttempts $MaxAttempts -RetryDelayMilliseconds 0 2>&1
        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = $output -join "`n"
        }
    } finally {
        Stop-GeographyMockServer -Server $server
    }
}

$result = Invoke-VerifierFixture -Scenario 'Success' -RequestCount 5
Assert-Condition ($result.ExitCode -eq 0) "Valid fixture failed: $($result.Output)"
Assert-Condition ($result.Output -match 'PASS:') 'Valid fixture did not print PASS.'
Assert-Condition ($result.Output -match 'Districts: 39') 'Valid fixture did not report 39 districts.'
Assert-Condition ($result.Output -match 'Neighborhoods: 963') 'Valid fixture did not report 963 neighborhoods.'

$result = Invoke-VerifierFixture -Scenario 'Retry' -RequestCount 6 -MaxAttempts 2
Assert-Condition ($result.ExitCode -eq 0) 'A transient HTTP failure was not retried successfully.'

$result = Invoke-VerifierFixture -Scenario 'MetadataMismatch' -RequestCount 4
Assert-Condition ($result.ExitCode -ne 0) 'Changed source metadata unexpectedly passed.'
Assert-Condition ($result.Output -match 'metadata changed') 'Metadata failure was not explicit.'

$result = Invoke-VerifierFixture -Scenario 'WrongDistrictName' -RequestCount 3
Assert-Condition ($result.ExitCode -ne 0) 'A non-official district name unexpectedly passed.'
Assert-Condition ($result.Output -match 'official') 'District-name failure was not explicit.'

$result = Invoke-VerifierFixture -Scenario 'DuplicateNeighborhood' -RequestCount 5
Assert-Condition ($result.ExitCode -ne 0) 'A duplicate neighborhood identity unexpectedly passed.'
Assert-Condition ($result.Output -match 'duplicate') 'Duplicate failure was not explicit.'

$result = Invoke-VerifierFixture -Scenario 'MissingPage' -RequestCount 5
Assert-Condition ($result.ExitCode -ne 0) 'Incomplete neighborhood pagination unexpectedly passed.'
Assert-Condition ($result.Output -match 'ended before all records') `
    "Pagination failure was not explicit: $($result.Output)"

Write-Output 'Istanbul geography source verifier tests passed.'
