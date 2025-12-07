# Windows Setup Script for Walt Backend
# This script helps configure the backend for Windows development

Write-Host "=== Walt Backend Windows Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check if .env exists
Write-Host ""
Write-Host "Checking .env file..." -ForegroundColor Yellow
if (Test-Path .env) {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    Write-Host "⚠ Please update .env with your Firebase credentials" -ForegroundColor Yellow
} else {
    Write-Host "✗ .env file not found. Creating from env.example..." -ForegroundColor Yellow
    Copy-Item env.example .env
    Write-Host "✓ Created .env file. Please update it with your values." -ForegroundColor Green
}

# Create data directory
Write-Host ""
Write-Host "Checking data directory..." -ForegroundColor Yellow
$dataDir = "..\data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Host "✓ Created data directory: $dataDir" -ForegroundColor Green
} else {
    Write-Host "✓ Data directory exists: $dataDir" -ForegroundColor Green
}

# Check Docker
Write-Host ""
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerVersion = docker --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker installed: $dockerVersion" -ForegroundColor Green
    Write-Host "  You can use docker-compose.yml to start IPFS" -ForegroundColor Cyan
} else {
    Write-Host "⚠ Docker not found. Install Docker Desktop or IPFS Desktop for IPFS node" -ForegroundColor Yellow
}

# Check IPFS
Write-Host ""
Write-Host "Checking IPFS node..." -ForegroundColor Yellow
try {
    $ipfsResponse = Invoke-WebRequest -Uri "http://127.0.0.1:5001/api/v0/version" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ IPFS node is running" -ForegroundColor Green
} catch {
    Write-Host "⚠ IPFS node not accessible at http://127.0.0.1:5001" -ForegroundColor Yellow
    Write-Host "  Start IPFS using:" -ForegroundColor Cyan
    Write-Host "    docker-compose up -d" -ForegroundColor Cyan
    Write-Host "  OR install IPFS Desktop" -ForegroundColor Cyan
}

# Summary
Write-Host ""
Write-Host "=== Setup Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update backend/.env with:" -ForegroundColor White
Write-Host "   - DATABASE_URL=sqlite://../data/ipfs-drive.db" -ForegroundColor Gray
Write-Host "   - Firebase credentials (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start IPFS node:" -ForegroundColor White
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start backend server:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "For detailed instructions, see: backend/SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

