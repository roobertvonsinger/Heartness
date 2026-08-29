# Launcher y Runner de DeepSeek Harness (DSH) — Stack Robert
param(
    [switch]$NoOpen,
    [string]$Port = "3080"
)

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " 🚀 INICIANDO DEEPSEEK HARNESS (DSH) CON CORDIS & 9ROUTER" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

$env:NINEROUTER_API_KEY = "kvm4-hermes-super-2026"
$RepoDir = "c:\Users\rober\Dropbox\TESTING DEV\repos\deepseek-harness"

if (Test-Path "$RepoDir\.env") {
    Get-Content "$RepoDir\.env" | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
}

Write-Host "📍 Conectando con 9router KVM4 (https://karen.2puty.tech/v1)..." -ForegroundColor Green
Write-Host "🌐 Interfaz Web disponible en: http://127.0.0.1:$Port" -ForegroundColor Green

$openFlag = if ($NoOpen) { "--no-open" } else { "" }
Set-Location $RepoDir
npx -y pnpm dsh web --port $Port $openFlag
