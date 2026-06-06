Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   AutoZap Enterprise Startup Script (PS)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path "node_modules")) {
    Write-Host "[!] node_modules not found. Installing..." -ForegroundColor Yellow
    npm install
}

Write-Host "[2/3] Starting Backend and Frontend..." -ForegroundColor Green
Write-Host "[!] Press Ctrl+C to stop the application." -ForegroundColor Gray
Write-Host ""

npm run dev
