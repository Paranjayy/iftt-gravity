# ==============================================================================
# GRAVITY HUB - WINDOWS GAMING SENTRY ONE-CLICK INSTALLER
# ==============================================================================

Write-Host "🚀 Gravity Hub: Initializing Gaming Sentry Setup..." -ForegroundColor Cyan

# 1. Install AutoHotkey using Winget
Write-Host "📦 Checking for AutoHotkey..." -ForegroundColor Yellow
$ahkInstalled = Get-Command "AutoHotkey" -ErrorAction SilentlyContinue
if (-not $ahkInstalled) {
    Write-Host "⏳ Installing AutoHotkey v1 via Winget..." -ForegroundColor Cyan
    winget install --id AutoHotkey.AutoHotkey --source winget --accept-package-agreements --accept-source-agreements
} else {
    Write-Host "✅ AutoHotkey is already installed." -ForegroundColor Green
}

# 2. Get Mac IP dynamically (Prompt user)
$macIp = Read-Host "🌐 Enter the IP Address of your Mac running Gravity Hub (e.g., 192.168.29.50)"
if (-not $macIp) { $macIp = "192.168.29.50" }

# 3. Locate the AHK script in the current folder
$scriptDir = $PSScriptRoot
$ahkFile = Join-Path $scriptDir "gravity_gaming_sentry.ahk"

if (-not (Test-Path $ahkFile)) {
    Write-Host "❌ Error: Could not find gravity_gaming_sentry.ahk in the same folder." -ForegroundColor Red
    Pause
    Exit
}

# 4. Update the IP in the AHK script
$ahkContent = Get-Content $ahkFile
$ahkContent = $ahkContent -replace 'Global GravityMacIP := ".*"', "Global GravityMacIP := `"$macIp`""
Set-Content $ahkFile $ahkContent
Write-Host "✅ Linked Sentry to Mac IP: $macIp" -ForegroundColor Green

# 5. Copy to Windows Startup Folder
$startupFolder = [Environment]::GetFolderPath("Startup")
$targetPath = Join-Path $startupFolder "gravity_gaming_sentry.ahk"

Copy-Item -Path $ahkFile -Destination $targetPath -Force
Write-Host "✅ Sentry injected into Windows Startup (It will run automatically on boot)." -ForegroundColor Green

# 6. Run it right now
Write-Host "🔥 Launching Sentry..." -ForegroundColor Cyan
Start-Process $targetPath

Write-Host "🎯 Setup Complete! The Sentry is now active in your system tray." -ForegroundColor Green
Pause
