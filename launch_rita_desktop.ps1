# Launcher de RITA DSH en Ventana Desktop Autonoma (Sin pestañas ni barra de navegador)
$RepoDir = 'c:\Users\rober\Dropbox\TESTING DEV\repos\deepseek-harness'
$Port = '3080'
$Url = "http://127.0.0.1:$Port"
$ProfileDir = "$env:LOCALAPPDATA\DSH_Desktop_Profile"

Set-Location $RepoDir

# 1. Cargar .env si existe
if (Test-Path "$RepoDir\.env") {
    Get-Content "$RepoDir\.env" | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
}

# 2. Verificar si el servidor DSH ya está corriendo
$serverReady = $false
try {
    $res = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) {
        $serverReady = $true
    }
} catch {}

# 3. Si no está corriendo, levantarlo en segundo plano
if (-not $serverReady) {
    Write-Host "[DSH] Iniciando servidor backend en puerto $Port..." -ForegroundColor Cyan
    $nodeProcess = Start-Process -FilePath "node" -ArgumentList "apps/cli/lib/bin.js", "web", "--port", $Port, "--no-open" -WorkingDirectory $RepoDir -WindowStyle Hidden -PassThru

    # Esperar a que el puerto responda (máximo 10s)
    $attempts = 0
    while (-not $serverReady -and $attempts -lt 20) {
        Start-Sleep -Milliseconds 500
        $attempts++
        try {
            $res = Invoke-WebRequest -Uri $Url -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($res.StatusCode -eq 200) {
                $serverReady = $true
                break
            }
        } catch {}
    }
}

# 4. Localizar navegador para modo App (Edge nativo de Windows o Chrome)
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$browserExe = $null
if (Test-Path $edgePath) {
    $browserExe = $edgePath
} elseif (Test-Path $chromePath) {
    $browserExe = $chromePath
}

if ($browserExe) {
    Write-Host "[DSH] Lanzando ventana autónoma de RITA DSH..." -ForegroundColor Green
    $appArgs = @(
        "--app=$Url",
        "--window-size=1366,900",
        "--user-data-dir=$ProfileDir",
        "--app-id=rita-dsh-sovereign",
        "--title=RITA DSH - Copiloto Soberano"
    )
    Start-Process -FilePath $browserExe -ArgumentList $appArgs
} else {
    Write-Host "[DSH] Abriendo en navegador predeterminado..." -ForegroundColor Yellow
    Start-Process $Url
}
