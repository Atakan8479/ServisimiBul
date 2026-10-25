Set-StrictMode -Version Latest
function Assert-SbWriterActivitySnapshot {
    param(
        [Parameter(Mandatory=$true)][string]$Row,
        [Parameter(Mandatory=$true)][string]$ExpectedSystemIdentifier
    )
    $fields=$Row.Trim().Split('|')
    if($fields.Count -ne 5 -or $fields[0] -cne 'WRITERS' -or
       $fields[1] -cne $ExpectedSystemIdentifier){
        throw 'Writer observation returned unexpected database identity or shape.'
    }
    foreach($number in $fields[2..4]){
        if($number -cnotmatch '^[0-9]+$'){throw 'Writer observation counts are invalid.'}
    }
    if([int]$fields[2] -ne 0 -or [int]$fields[3] -ne 0 -or [int]$fields[4] -ne 0){
        throw 'Potential application writer, migration DDL, or open transaction was observed.'
    }
    return $true
}
