# Launcher de Chat Interactivo en Vivo con Voz Dual - DeepSick Hardness (DSH)
$RepoDir = 'c:\Users\rober\Dropbox\TESTING DEV\repos\deepseek-harness'

Set-Location $RepoDir

if (Test-Path "$RepoDir\.env") {
    Get-Content "$RepoDir\.env" | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
}

npx tsx tools/live_voice_chat.ts
