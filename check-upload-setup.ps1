# Upload Setup Diagnostic Script
# This script checks if everything is configured correctly for file uploads

Write-Host "=== Upload Setup Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Check .env.local
Write-Host "1. Checking frontend configuration..." -ForegroundColor Yellow
if (Test-Path .env.local) {
    $envContent = Get-Content .env.local -Raw
    if ($envContent -match "NEXT_PUBLIC_BACKEND_API_URL=(.+)") {
        $backendUrl = $matches[1].Trim()
        Write-Host "   ✓ Backend URL configured: $backendUrl" -ForegroundColor Green
        
        if ($backendUrl -eq "http://localhost:3001") {
            Write-Host "   ✓ Using local backend (correct for development)" -ForegroundColor Green
        } elseif ($backendUrl -match "https://") {
            Write-Host "   ⚠ Using production backend. Make sure that's what you want!" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✗ NEXT_PUBLIC_BACKEND_API_URL not found in .env.local" -ForegroundColor Red
        Write-Host "   Add this line to .env.local:" -ForegroundColor Cyan
        Write-Host "   NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ .env.local file not found!" -ForegroundColor Red
    Write-Host "   Create .env.local with:" -ForegroundColor Cyan
    Write-Host "   NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001" -ForegroundColor Gray
}

Write-Host ""

# Check backend server
Write-Host "2. Checking backend server..." -ForegroundColor Yellow
try {
    # Try curl first (more reliable on Windows)
    $curlResult = curl -s http://localhost:3001/health 2>&1
    if ($curlResult -match '"status"') {
        Write-Host "   ✓ Backend server is running" -ForegroundColor Green
    } else {
        throw "Backend not responding"
    }
} catch {
    # Fallback to PowerShell
    try {
        $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   ✓ Backend server is running" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ Backend server not accessible at http://localhost:3001" -ForegroundColor Red
        Write-Host "   Start backend with:" -ForegroundColor Cyan
        Write-Host "   cd backend" -ForegroundColor Gray
        Write-Host "   npm start" -ForegroundColor Gray
    }
}

Write-Host ""

# Check IPFS node
Write-Host "3. Checking IPFS node..." -ForegroundColor Yellow
try {
    # IPFS API requires POST method
    $curlResult = curl -s -X POST http://127.0.0.1:5001/api/v0/version 2>&1
    if ($curlResult -match '"Version"') {
        Write-Host "   ✓ IPFS node is running" -ForegroundColor Green
    } else {
        throw "IPFS not responding"
    }
} catch {
    # Fallback to PowerShell
    try {
        $ipfsResponse = Invoke-WebRequest -Uri "http://127.0.0.1:5001/api/v0/version" -Method POST -TimeoutSec 5 -ErrorAction Stop
        if ($ipfsResponse.Content -match '"Version"') {
            Write-Host "   ✓ IPFS node is running" -ForegroundColor Green
        } else {
            throw "IPFS not responding"
        }
    } catch {
        Write-Host "   ✗ IPFS node not accessible at http://127.0.0.1:5001" -ForegroundColor Red
        Write-Host "   Start IPFS with:" -ForegroundColor Cyan
        Write-Host "   cd backend" -ForegroundColor Gray
        Write-Host "   docker-compose up -d" -ForegroundColor Gray
        Write-Host "   OR install and run IPFS Desktop" -ForegroundColor Gray
    }
}

Write-Host ""

# Check backend .env
Write-Host "4. Checking backend configuration..." -ForegroundColor Yellow
if (Test-Path backend\.env) {
    $backendEnv = Get-Content backend\.env -Raw
    if ($backendEnv -match "IPFS_API_URL=(.+)") {
        $ipfsUrl = $matches[1].Trim()
        Write-Host "   ✓ IPFS_API_URL configured: $ipfsUrl" -ForegroundColor Green
    }
    if ($backendEnv -match "ALLOWED_ORIGINS=(.+)") {
        $origins = $matches[1].Trim()
        if ($origins -match "localhost:3000") {
            Write-Host "   ✓ CORS configured for localhost:3000" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ CORS may not include localhost:3000" -ForegroundColor Yellow
            Write-Host "   Add to backend/.env: ALLOWED_ORIGINS=http://localhost:3000" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   ⚠ backend/.env not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If uploads are failing, check:" -ForegroundColor Yellow
Write-Host "1. Browser console (F12) for error messages" -ForegroundColor White
Write-Host "2. Network tab to see what URL is being called" -ForegroundColor White
Write-Host "3. Backend terminal for error logs" -ForegroundColor White
Write-Host ""
Write-Host "Common issues:" -ForegroundColor Yellow
Write-Host "- Backend URL pointing to production instead of localhost" -ForegroundColor White
Write-Host "- Backend server not running" -ForegroundColor White
Write-Host "- IPFS node not running" -ForegroundColor White
Write-Host "- CORS not configured correctly" -ForegroundColor White
Write-Host ""

