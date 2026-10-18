[CmdletBinding()]
param(
    [string]$JavaHome
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
$frontendDirectory = Join-Path $repositoryRoot 'servisimibul-frontend'
$backendEnvPath = Join-Path $backendDirectory '.env'
$backendProcess = $null
$frontendProcess = $null

function Get-JavaRuntimeHome {
    param([string]$RequestedHome)

    $candidates = @(
        $RequestedHome,
        $env:JAVA_HOME,
        (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.jdks\openjdk-25')
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($candidate in $candidates) {
        $java = Join-Path $candidate 'bin\java.exe'
        if (-not (Test-Path -LiteralPath $java)) {
            continue
        }

        $versionLine = (& $java --version | Select-Object -First 1).ToString()
        if ($versionLine -match '^(?:openjdk|java)(?: version)? "?(\d+)') {
            $major = [int]$Matches[1]
            if ($major -ge 21) {
                return @{ Home = $candidate; Major = $major }
            }
        }
    }

    throw 'Java 21 or newer was not found. Set JAVA_HOME or run .\dev.ps1 -JavaHome <jdk-path>.'
}

function Get-Node24Runtime {
    $nodeCandidates = @()
    $pathNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($pathNode) {
        $nodeCandidates += $pathNode.Source
    }

    $nvmRoots = @($env:NVM_HOME)
    $nvmCommand = Get-Command nvm.exe -ErrorAction SilentlyContinue
    if ($nvmCommand) {
        $nvmRoots += Split-Path -Parent $nvmCommand.Source
    }

    foreach ($nvmRoot in ($nvmRoots | Where-Object { $_ } | Select-Object -Unique)) {
        $nodeCandidates += Get-ChildItem -LiteralPath $nvmRoot -Directory -Filter 'v24.*' -ErrorAction SilentlyContinue |
            Sort-Object { [version]$_.Name.TrimStart('v') } -Descending |
            ForEach-Object { Join-Path $_.FullName 'node.exe' }
    }

    foreach ($node in ($nodeCandidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $node)) {
            continue
        }

        $version = (& $node --version).TrimStart('v')
        if ([version]$version -ge [version]'24.0.0' -and [version]$version -lt [version]'25.0.0') {
            return @{ Node = $node; Version = $version }
        }
    }

    throw 'Node.js 24 was not found. Install it with `nvm install 24`, then run this command again.'
}

function Get-MavenRuntime {
    param([string]$BackendDirectory)

    $propertiesPath = Join-Path $BackendDirectory '.mvn\wrapper\maven-wrapper.properties'
    $properties = Get-Content -LiteralPath $propertiesPath -Raw | ConvertFrom-StringData
    $distributionName = [System.IO.Path]::GetFileNameWithoutExtension($properties.distributionUrl) -replace '-bin$', ''
    $mavenUserHome = if ($env:MAVEN_USER_HOME) { $env:MAVEN_USER_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.m2' }
    $distributionRoot = Join-Path $mavenUserHome "wrapper\dists\$distributionName"

    $launcher = Get-ChildItem -LiteralPath $distributionRoot -Recurse -Filter 'plexus-classworlds-*.jar' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $launcher) {
        & (Join-Path $BackendDirectory 'mvnw.cmd') --version
        if ($LASTEXITCODE -ne 0) {
            throw 'Maven Wrapper setup failed.'
        }
        $launcher = Get-ChildItem -LiteralPath $distributionRoot -Recurse -Filter 'plexus-classworlds-*.jar' -ErrorAction SilentlyContinue |
            Select-Object -First 1
    }
    if (-not $launcher) {
        throw 'Maven runtime was not found after Maven Wrapper setup.'
    }

    $mavenRuntimeHome = Split-Path -Parent (Split-Path -Parent $launcher.FullName)
    return @{ Home = $mavenRuntimeHome; Launcher = $launcher.FullName }
}

function Read-EnvironmentFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing $Path. Copy servisimibul-backend\.env.example to .env and configure it first."
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }

        $separator = $line.IndexOf('=')
        if ($separator -lt 1) {
            throw "Invalid .env entry. Expected NAME=value."
        }

        $name = $line.Substring(0, $separator).Trim().TrimStart([char]0xFEFF)
        $value = $line.Substring($separator + 1).Trim()
        if ($name -cnotmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            throw "Invalid environment variable name in .env: $name"
        }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$name] = $value
    }

    # shortcut: .env.example uses single-line NAME=value entries; use a dotenv library if multiline values are introduced.
    return $values
}

function Set-TemporaryEnvironment {
    param([hashtable]$Values)

    $previous = @{}
    foreach ($name in $Values.Keys) {
        $existing = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        $previous[$name] = @{
            Exists = $null -ne $existing
            Value = if ($existing) { $existing.Value } else { $null }
        }
        Set-Item -LiteralPath "Env:$name" -Value $Values[$name]
    }
    return $previous
}

function Restore-Environment {
    param([hashtable]$Previous)

    foreach ($name in $Previous.Keys) {
        if ($Previous[$name].Exists) {
            Set-Item -LiteralPath "Env:$name" -Value $Previous[$name].Value
        } else {
            Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
        }
    }
}

function Stop-ProcessTree {
    param([System.Diagnostics.Process]$Process)

    if (-not $Process) {
        return
    }
    $Process.Refresh()
    if (-not $Process.HasExited) {
        & "$env:SystemRoot\System32\taskkill.exe" /PID $Process.Id /T /F 2>$null | Out-Null
    }
}

$javaRuntime = Get-JavaRuntimeHome -RequestedHome $JavaHome
$nodeRuntime = Get-Node24Runtime
$backendEnvironment = Read-EnvironmentFile -Path $backendEnvPath
$backendEnvironment['JAVA_HOME'] = $javaRuntime.Home
$backendEnvironment['SB_FLYWAY_ENABLED'] = 'false'
$backendEnvironment['SB_ADMIN_BOOTSTRAP_ENABLED'] = 'false'
$backendEnvironment['SPRING_PROFILES_ACTIVE'] = 'local'
$backendEnvironment['SB_COOKIE_SECURE'] = 'false'
$backendEnvironment['SB_EMAIL_VERIFICATION_REQUIRED'] = 'false'

$backendJava = Join-Path $javaRuntime.Home 'bin\java.exe'
$viteEntryPoint = Join-Path $frontendDirectory 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $viteEntryPoint)) {
    throw 'Frontend dependencies are missing. Run `npm ci` in servisimibul-frontend first.'
}

Write-Host "Using Java $($javaRuntime.Major) and Node.js $($nodeRuntime.Version)."

$previousEnvironment = Set-TemporaryEnvironment -Values $backendEnvironment
try {
    $mavenRuntime = Get-MavenRuntime -BackendDirectory $backendDirectory
    $backendProcess = Start-Process `
        -FilePath $backendJava `
        -ArgumentList @(
            "-Dmaven.home=$($mavenRuntime.Home)",
            "-Dclassworlds.conf=$(Join-Path $mavenRuntime.Home 'bin\m2.conf')",
            "-Dmaven.multiModuleProjectDirectory=$backendDirectory",
            '-classpath',
            $mavenRuntime.Launcher,
            'org.codehaus.plexus.classworlds.launcher.Launcher',
            'spring-boot:run'
        ) `
        -WorkingDirectory $backendDirectory `
        -NoNewWindow `
        -PassThru
} finally {
    Restore-Environment -Previous $previousEnvironment
}

try {
    $previousFrontendEnvironment = Set-TemporaryEnvironment -Values @{
        VITE_EMAIL_VERIFICATION_REQUIRED = 'false'
    }
    try {
        $frontendProcess = Start-Process `
            -FilePath $nodeRuntime.Node `
            -ArgumentList @($viteEntryPoint, '--strictPort') `
            -WorkingDirectory $frontendDirectory `
            -NoNewWindow `
            -PassThru
    } finally {
        Restore-Environment -Previous $previousFrontendEnvironment
    }

    Write-Host 'Frontend: http://localhost:5173'
    Write-Host 'Backend:  http://localhost:8080'
    Write-Host 'Press Ctrl+C to stop both.'

    while ($true) {
        Start-Sleep -Milliseconds 500
        $backendProcess.Refresh()
        $frontendProcess.Refresh()
        if ($backendProcess.HasExited) {
            throw 'Backend stopped. See its output above.'
        }
        if ($frontendProcess.HasExited) {
            throw 'Frontend stopped. See its output above.'
        }
    }
} finally {
    Write-Host 'Stopping backend and frontend...'
    Stop-ProcessTree -Process $frontendProcess
    Stop-ProcessTree -Process $backendProcess
}
