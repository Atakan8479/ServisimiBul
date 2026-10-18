[CmdletBinding()]
param(
    [uri]$BaseUri = 'https://api.turkiyeapi.dev/v2',

    [ValidateRange(1, 60)]
    [int]$TimeoutSeconds = 25,

    [ValidateRange(1, 5)]
    [int]$MaxAttempts = 3,

    [ValidateRange(0, 10000)]
    [int]$RetryDelayMilliseconds = 1000,

    [ValidateRange(1, 1000)]
    [int]$NeighborhoodPageSize = 1000,

    [switch]$AllowHttpForLocalTest,

    [switch]$PassThru
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedDatasetVersion = '2025'
$expectedLastUpdated = '2026-05-21'
$expectedNeighborhoodTotal = 963
$expectedDistrictNames = @(
    'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar',
    'Bahçelievler', 'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş',
    'Beykoz', 'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece', 'Çatalca',
    'Çekmeköy', 'Esenler', 'Esenyurt', 'Eyüpsultan', 'Fatih',
    'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane', 'Kartal',
    'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
    'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli',
    'Tuzla', 'Ümraniye', 'Üsküdar', 'Zeytinburnu'
)

function Assert-BaseUri {
    $isHttps = $BaseUri.Scheme -eq 'https'
    $isLocalHttp = $AllowHttpForLocalTest -and
        $BaseUri.Scheme -eq 'http' -and
        $BaseUri.Host -in @('localhost', '127.0.0.1', '::1')
    $hasSafePath = $BaseUri.AbsolutePath.TrimEnd('/') -in @('', '/v2')

    if ((-not $isHttps -and -not $isLocalHttp) -or
        -not [string]::IsNullOrEmpty($BaseUri.UserInfo) -or
        -not [string]::IsNullOrEmpty($BaseUri.Query) -or
        -not [string]::IsNullOrEmpty($BaseUri.Fragment) -or
        -not $hasSafePath) {
        throw 'BaseUri must be the HTTPS API v2 origin. Loopback HTTP is allowed only for isolated tests.'
    }
}

function Invoke-SourceGet {
    param([Parameter(Mandatory = $true)][string]$PathAndQuery)

    $uri = '{0}/{1}' -f $BaseUri.AbsoluteUri.TrimEnd('/'), $PathAndQuery.TrimStart('/')
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            return Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec $TimeoutSeconds `
                -MaximumRedirection 0 -ErrorAction Stop
        } catch {
            if ($attempt -eq $MaxAttempts) {
                throw "GET $PathAndQuery failed after $MaxAttempts bounded attempt(s)."
            }
            if ($RetryDelayMilliseconds -gt 0) {
                Start-Sleep -Milliseconds $RetryDelayMilliseconds
            }
        }
    }
}

function Assert-Property {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if ($null -eq $Object -or $null -eq $Object.PSObject.Properties[$Name]) {
        throw "$Context is missing required property '$Name'."
    }
    return $Object.$Name
}

function Assert-Metadata {
    param(
        [Parameter(Mandatory = $true)]$Metadata,
        [Parameter(Mandatory = $true)][string]$Context
    )

    $version = [string](Assert-Property -Object $Metadata -Name 'datasetVersion' -Context $Context)
    $lastUpdated = [string](Assert-Property -Object $Metadata -Name 'lastUpdated' -Context $Context)
    if ([string]::IsNullOrWhiteSpace($version) -or [string]::IsNullOrWhiteSpace($lastUpdated)) {
        throw "$Context returned empty dataset metadata."
    }
    if ($version -ne $expectedDatasetVersion -or $lastUpdated -ne $expectedLastUpdated) {
        throw "$Context metadata changed; investigate before importing."
    }
}

function Assert-ListResponse {
    param(
        [Parameter(Mandatory = $true)]$Response,
        [Parameter(Mandatory = $true)][string]$Context
    )

    $dataProperty = $Response.PSObject.Properties['data']
    if ($null -eq $dataProperty) {
        throw "$Context is missing required property 'data'."
    }
    $data = [System.Collections.Generic.List[object]]::new()
    foreach ($item in $dataProperty.Value) {
        $data.Add($item)
    }
    $metadata = Assert-Property -Object $Response -Name 'meta' -Context $Context
    Assert-Metadata -Metadata $metadata -Context "$Context metadata"
    $count = [int](Assert-Property -Object $metadata -Name 'count' -Context "$Context metadata")
    $total = [int](Assert-Property -Object $metadata -Name 'total' -Context "$Context metadata")
    if ($count -ne $data.Count -or $count -lt 0 -or $total -lt $count) {
        throw "$Context returned inconsistent count metadata."
    }
    return [pscustomobject]@{ Data = $data; Total = $total }
}

function Assert-UnicodeName {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Context
    )

    if ([string]::IsNullOrWhiteSpace($Name)) {
        throw "$Context has an empty name."
    }
    try {
        $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
        $null = $strictUtf8.GetBytes($Name)
    } catch {
        throw "$Context has an invalid Unicode name."
    }
}

Assert-BaseUri

$metaResponse = Invoke-SourceGet -PathAndQuery 'meta'
$metaData = Assert-Property -Object $metaResponse -Name 'data' -Context 'Metadata response'
Assert-Metadata -Metadata $metaData -Context 'Metadata response'

$provinceResponse = Invoke-SourceGet -PathAndQuery 'provinces/34'
$province = Assert-Property -Object $provinceResponse -Name 'data' -Context 'Province response'
$provinceMetadata = Assert-Property -Object $provinceResponse -Name 'meta' -Context 'Province response'
Assert-Metadata -Metadata $provinceMetadata -Context 'Province response metadata'
if ([int](Assert-Property -Object $province -Name 'id' -Context 'Province') -ne 34 -or
    [string](Assert-Property -Object $province -Name 'name' -Context 'Province') -ne 'İstanbul') {
    throw 'Province response did not identify İstanbul as province 34.'
}

$districtResponse = Invoke-SourceGet `
    -PathAndQuery 'districts?provinceId=34&limit=100&sort=name'
$districtPage = Assert-ListResponse -Response $districtResponse -Context 'District response'
$districts = @($districtPage.Data)
if ($districtPage.Total -ne 39 -or $districts.Count -ne 39) {
    throw 'District response must contain exactly 39 İstanbul districts.'
}

$districtIds = [System.Collections.Generic.HashSet[int]]::new()
$actualDistrictNames = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
)
$expectedDistrictSet = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
)
foreach ($expectedDistrictName in $expectedDistrictNames) {
    $null = $expectedDistrictSet.Add($expectedDistrictName)
}
$reportedNeighborhoodCounts = @{}
foreach ($district in $districts) {
    $districtId = [int](Assert-Property -Object $district -Name 'id' -Context 'District')
    $districtName = [string](Assert-Property -Object $district -Name 'name' -Context "District $districtId")
    $provinceId = [int](Assert-Property -Object $district -Name 'provinceId' -Context "District $districtId")
    $stats = Assert-Property -Object $district -Name 'stats' -Context "District $districtId"
    $neighborhoodCount = [int](Assert-Property -Object $stats -Name 'neighborhoodCount' -Context "District $districtId stats")
    Assert-UnicodeName -Name $districtName -Context "District $districtId"
    if ($provinceId -ne 34 -or -not $districtIds.Add($districtId) -or
        -not $actualDistrictNames.Add($districtName) -or $neighborhoodCount -lt 0) {
        throw "District $districtId has invalid parent, identity, name, or statistics."
    }
    $reportedNeighborhoodCounts[$districtId] = $neighborhoodCount
}
if (-not $actualDistrictNames.SetEquals($expectedDistrictSet)) {
    throw 'District names do not exactly match the official İstanbul Governorate list.'
}
if (($reportedNeighborhoodCounts.Values | Measure-Object -Sum).Sum -ne $expectedNeighborhoodTotal) {
    throw 'District neighborhood statistics do not total the expected 963 records.'
}

$neighborhoods = [System.Collections.Generic.List[object]]::new()
$offset = 0
$expectedApiTotal = $null
do {
    $path = 'neighborhoods?provinceId=34&limit={0}&offset={1}&sort=id' -f `
        $NeighborhoodPageSize, $offset
    $page = Assert-ListResponse -Response (Invoke-SourceGet -PathAndQuery $path) `
        -Context "Neighborhood response at offset $offset"
    if ($null -eq $expectedApiTotal) {
        $expectedApiTotal = $page.Total
        if ($expectedApiTotal -ne $expectedNeighborhoodTotal) {
            throw 'Neighborhood API total does not match the expected 963 records.'
        }
    } elseif ($page.Total -ne $expectedApiTotal) {
        throw 'Neighborhood API total changed between pages.'
    }
    if ($page.Data.Count -eq 0 -and $neighborhoods.Count -lt $expectedApiTotal) {
        throw 'Neighborhood pagination ended before all records were collected.'
    }
    foreach ($item in $page.Data) {
        $neighborhoods.Add($item)
    }
    $offset += $page.Data.Count
} while ($neighborhoods.Count -lt $expectedApiTotal)

if ($neighborhoods.Count -ne $expectedNeighborhoodTotal) {
    throw 'Neighborhood pagination did not collect exactly 963 records.'
}

$neighborhoodIds = [System.Collections.Generic.HashSet[int]]::new()
$districtNamePairs = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
)
$actualNeighborhoodCounts = @{}
foreach ($districtId in $districtIds) {
    $actualNeighborhoodCounts[$districtId] = 0
}
foreach ($neighborhood in $neighborhoods) {
    $neighborhoodId = [int](Assert-Property -Object $neighborhood -Name 'id' -Context 'Neighborhood')
    $name = [string](Assert-Property -Object $neighborhood -Name 'name' -Context "Neighborhood $neighborhoodId")
    $provinceId = [int](Assert-Property -Object $neighborhood -Name 'provinceId' -Context "Neighborhood $neighborhoodId")
    $districtId = [int](Assert-Property -Object $neighborhood -Name 'districtId' -Context "Neighborhood $neighborhoodId")
    Assert-UnicodeName -Name $name -Context "Neighborhood $neighborhoodId"
    $pair = [string]::Concat($districtId, [char]0, $name)
    if ($provinceId -ne 34 -or -not $districtIds.Contains($districtId) -or
        -not $neighborhoodIds.Add($neighborhoodId) -or -not $districtNamePairs.Add($pair)) {
        throw "Neighborhood $neighborhoodId has invalid parent or duplicate identity/name."
    }
    $actualNeighborhoodCounts[$districtId]++
}
foreach ($districtId in $districtIds) {
    if ($actualNeighborhoodCounts[$districtId] -ne $reportedNeighborhoodCounts[$districtId]) {
        throw "District $districtId neighborhood count does not match its reported statistics."
    }
}

if ($PassThru) {
    [pscustomobject]@{
        Province = [pscustomobject]@{ Code = '34'; Name = 'İstanbul' }
        Districts = $districts
        Neighborhoods = $neighborhoods.ToArray()
        DatasetVersion = $expectedDatasetVersion
        LastUpdated = $expectedLastUpdated
    }
    return
}

Write-Output 'PASS: TurkiyeAPI İstanbul geography source verification completed.'
Write-Output 'Province: İstanbul (34)'
Write-Output "Districts: $($districts.Count)"
Write-Output "Neighborhoods: $($neighborhoods.Count)"
Write-Output "Dataset version: $expectedDatasetVersion"
Write-Output "Last updated: $expectedLastUpdated"
