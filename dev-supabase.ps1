[CmdletBinding()]
param([string]$JavaHome)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = $PSScriptRoot
$backendDirectory = Join-Path $repositoryRoot 'servisimibul-backend'
$frontendDirectory = Join-Path $repositoryRoot 'servisimibul-frontend'
$backendEnvPath = Join-Path $backendDirectory '.env'
. (Join-Path $repositoryRoot 'scripts\WindowsDevelopmentSupport.ps1')
. (Join-Path $repositoryRoot 'scripts\SharedSupabaseDevelopmentSupport.ps1')

function Wait-SbBackendReady {
    param([Parameter(Mandatory = $true)][System.Diagnostics.Process]$BackendProcess)

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(120)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        $BackendProcess.Refresh()
        if ($BackendProcess.HasExited) {
            throw 'Backend stopped before readiness. See its output above.'
        }
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/readyz' -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch {
            # Startup can temporarily refuse connections or return 503.
        }
        Start-Sleep -Milliseconds 500
    }
    throw 'Timed out waiting for the shared backend readiness endpoint.'
}

$backendProcess = $null
$frontendProcess = $null

try {
    $javaRuntime = Resolve-SbJavaRuntime -RequestedHome $JavaHome
    $nodeRuntime = Resolve-SbNode24Runtime
    $backendEnvironment = Read-SbRuntimeEnvironmentFile -Path $backendEnvPath
    Assert-SbSharedRuntimeEnvironment -Values $backendEnvironment

    $viteEntryPoint = Join-Path $frontendDirectory 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteEntryPoint -PathType Leaf)) {
        throw 'Frontend dependencies are missing. Run `npm ci` in servisimibul-frontend first.'
    }

    $backendEnvironment['JAVA_HOME'] = $javaRuntime.Home
    $backendEnvironment['SPRING_PROFILES_ACTIVE'] = 'local'
    $backendEnvironment['SPRING_DATASOURCE_URL'] = $backendEnvironment['SB_DB_JDBC_URL']
    $backendEnvironment['SPRING_DATASOURCE_USERNAME'] = $backendEnvironment['SB_DB_USER']
    $backendEnvironment['SPRING_DATASOURCE_PASSWORD'] = $backendEnvironment['SB_DB_PASSWORD']
    $backendEnvironment['SPRING_JPA_HIBERNATE_DDL_AUTO'] = 'validate'
    $backendEnvironment['SPRING_SQL_INIT_MODE'] = 'never'
    $backendEnvironment['SB_FLYWAY_ENABLED'] = 'false'
    $backendEnvironment['SPRING_FLYWAY_ENABLED'] = 'false'
    $backendEnvironment['SB_DB_MIGRATION_JDBC_URL'] = $null
    $backendEnvironment['SB_DB_MIGRATION_USER'] = $null
    $backendEnvironment['SB_DB_MIGRATION_PASSWORD'] = $null
    $backendEnvironment['SPRING_FLYWAY_URL'] = $null
    $backendEnvironment['SPRING_FLYWAY_USER'] = $null
    $backendEnvironment['SPRING_FLYWAY_PASSWORD'] = $null
    $backendEnvironment['SB_ADMIN_BOOTSTRAP_ENABLED'] = 'false'
    $backendEnvironment['SERVISIMIBUL_ADMIN_BOOTSTRAP_ENABLED'] = 'false'
    $backendEnvironment['SB_ADMIN_1_EMAIL'] = $null
    $backendEnvironment['SB_ADMIN_1_PASSWORD'] = $null
    $backendEnvironment['SB_ADMIN_2_EMAIL'] = $null
    $backendEnvironment['SB_ADMIN_2_PASSWORD'] = $null
    $backendEnvironment['SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_EMAIL'] = $null
    $backendEnvironment['SERVISIMIBUL_ADMIN_BOOTSTRAP_FIRST_PASSWORD'] = $null
    $backendEnvironment['SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_EMAIL'] = $null
    $backendEnvironment['SERVISIMIBUL_ADMIN_BOOTSTRAP_SECOND_PASSWORD'] = $null
    $backendEnvironment['SB_COOKIE_SECURE'] = 'false'
    $backendEnvironment['SERVER_SERVLET_SESSION_COOKIE_SECURE'] = 'false'
    $backendEnvironment['SB_EMAIL_VERIFICATION_REQUIRED'] = 'false'
    $backendEnvironment['SB_PARENT_REGISTRATION_ENABLED'] = 'true'
    $backendEnvironment['SB_PARENT_EMAIL_VERIFICATION_REQUIRED'] = 'false'
    $backendEnvironment['APP_AUTH_EMAIL_VERIFICATION_REQUIRED'] = 'false'
    $backendEnvironment['OPERATOR_APPROVAL_REQUIRED'] = 'false'
    $backendEnvironment['APP_OPERATOR_APPROVAL_REQUIRED'] = 'false'
    $backendEnvironment['SB_MAIL_ENABLED'] = 'false'
    $backendEnvironment['SERVISIMIBUL_EMAIL_ENABLED'] = 'false'
    $backendEnvironment['SB_MAIL_USERNAME'] = $null
    $backendEnvironment['SB_MAIL_PASSWORD'] = $null
    $backendEnvironment['SPRING_MAIL_USERNAME'] = $null
    $backendEnvironment['SPRING_MAIL_PASSWORD'] = $null
    $backendEnvironment['SERVER_ADDRESS'] = '127.0.0.1'
    $backendEnvironment['SERVER_PORT'] = '8080'

    $mavenRuntime = Get-SbMavenRuntime -BackendDirectory $backendDirectory
    $previousBackendEnvironment = Set-SbTemporaryEnvironment -Values $backendEnvironment
    try {
        $backendProcess = Start-Process -FilePath $javaRuntime.Java -ArgumentList @(
            "-Dmaven.home=$($mavenRuntime.Home)",
            "-Dclassworlds.conf=$(Join-Path $mavenRuntime.Home 'bin\m2.conf')",
            "-Dmaven.multiModuleProjectDirectory=$backendDirectory",
            '-classpath', $mavenRuntime.Launcher,
            'org.codehaus.plexus.classworlds.launcher.Launcher',
            'spring-boot:run'
        ) -WorkingDirectory $backendDirectory -NoNewWindow -PassThru
    } finally {
        Restore-SbEnvironment -Previous $previousBackendEnvironment
    }

    Write-Host 'Waiting for shared backend readiness before starting frontend...'
    Wait-SbBackendReady -BackendProcess $backendProcess

    $previousFrontendEnvironment = Set-SbTemporaryEnvironment -Values @{
        VITE_EMAIL_VERIFICATION_REQUIRED = 'false'
    }
    try {
        $frontendProcess = Start-Process -FilePath $nodeRuntime.Node `
            -ArgumentList @($viteEntryPoint, '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
            -WorkingDirectory $frontendDirectory -NoNewWindow -PassThru
    } finally {
        Restore-SbEnvironment -Previous $previousFrontendEnvironment
    }

    Write-Host "Using Java $($javaRuntime.Major), Node.js $($nodeRuntime.Version), and shared Supabase data."
    Write-Host 'Frontend: http://127.0.0.1:5173'
    Write-Host 'Backend:  http://127.0.0.1:8080'
    Write-Warning 'Changes made in this session are persisted to the shared Supabase database.'
    Write-Host 'Press Ctrl+C to stop the applications.'

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
    Stop-SbProcessTree -Process $frontendProcess
    Stop-SbProcessTree -Process $backendProcess
}
