[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'SupabaseWriterObservationSupport.ps1')
function MustReject([string]$row){
    $rejected=$false
    try{$null=Assert-SbWriterActivitySnapshot -Row $row -ExpectedSystemIdentifier '1234567890123456789'}catch{$rejected=$true}
    if(-not $rejected){throw ('Writer observation incorrectly accepted: '+$row)}
}
if(-not (Assert-SbWriterActivitySnapshot -Row 'WRITERS|1234567890123456789|0|0|0' -ExpectedSystemIdentifier '1234567890123456789')){throw 'Valid observation was rejected.'}
MustReject 'WRITERS|9876543210987654321|0|0|0'
MustReject 'WRITERS|1234567890123456789|1|0|0'
MustReject 'WRITERS|1234567890123456789|0|1|0'
MustReject 'WRITERS|1234567890123456789|0|0|1'
MustReject 'WRITERS|1234567890123456789|0|0'
MustReject 'WRITERS|1234567890123456789|bad|0|0'
Write-Host 'Read-only writer observation fail-closed tests passed.'
