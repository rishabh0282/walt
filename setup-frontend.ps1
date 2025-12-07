# Frontend Setup Script for Walt
# This script helps configure the frontend for Windows development

Write-Host "=== Walt Frontend Setup ===" -ForegroundColor Cyan
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

# Check if .env.local exists
Write-Host ""
Write-Host "Checking .env.local file..." -ForegroundColor Yellow
if (Test-Path .env.local) {
    Write-Host "✓ .env.local file exists" -ForegroundColor Green
    Write-Host "⚠ Please verify all required variables are set" -ForegroundColor Yellow
} else {
    Write-Host "✗ .env.local file not found. Creating from .env.local.example..." -ForegroundColor Yellow
    if (Test-Path .env.local.example) {
        Copy-Item .env.local.example .env.local
        Write-Host "✓ Created .env.local file. Please update it with your values." -ForegroundColor Green
    } else {
        Write-Host "✗ .env.local.example not found. Please create .env.local manually." -ForegroundColor Red
    }
}

# Check dependencies
Write-Host ""
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (Test-Path node_modules) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠ Dependencies not installed. Run: npm install" -ForegroundColor Yellow
}

# Check backend connection
Write-Host ""
Write-Host "Checking backend connection..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "⚠ Backend server not accessible at http://localhost:3001" -ForegroundColor Yellow
    Write-Host "  Make sure backend is running (see backend/SETUP_GUIDE.md)" -ForegroundColor Cyan
}

# Check Firebase config in .env.local
Write-Host ""
Write-Host "Checking Firebase configuration..." -ForegroundColor Yellow
if (Test-Path .env.local) {
    $envContent = Get-Content .env.local -Raw
    $firebaseVars = @(
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID"
    )
    
    $missingVars = @()
    foreach ($var in $firebaseVars) {
        if ($envContent -notmatch "$var=" -or $envContent -match "$var=your_|$var=$") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -eq 0) {
        Write-Host "✓ All Firebase variables appear to be configured" -ForegroundColor Green
    } else {
        Write-Host "⚠ Missing or incomplete Firebase variables:" -ForegroundColor Yellow
        foreach ($var in $missingVars) {
            Write-Host "  - $var" -ForegroundColor Gray
        }
        Write-Host "  Get these from Firebase Console → Project Settings → Your apps → Web app" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠ .env.local not found. Cannot check Firebase config." -ForegroundColor Yellow
}

# Check backend URL
Write-Host ""
Write-Host "Checking backend API URL..." -ForegroundColor Yellow
if (Test-Path .env.local) {
    $envContent = Get-Content .env.local -Raw
    if ($envContent -match "NEXT_PUBLIC_BACKEND_API_URL=(.+)") {
        $backendUrl = $matches[1].Trim()
        if ($backendUrl -and $backendUrl -ne "your_backend_url_here" -and $backendUrl -ne "") {
            Write-Host "✓ Backend URL configured: $backendUrl" -ForegroundColor Green
        } else {
            Write-Host "⚠ Backend URL not configured. Set NEXT_PUBLIC_BACKEND_API_URL in .env.local" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠ Backend URL not found in .env.local" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "=== Setup Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update .env.local with:" -ForegroundColor White
Write-Host "   - Firebase client credentials (from Firebase Console)" -ForegroundColor Gray
Write-Host "   - NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Install dependencies (if not done):" -ForegroundColor White
Write-Host "   npm install" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start frontend:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Open browser:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "For detailed instructions, see: FRONTEND_SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

