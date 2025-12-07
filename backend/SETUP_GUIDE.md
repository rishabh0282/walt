# Backend Setup Guide

This guide will help you set up the Walt backend server on your local machine.

## 📋 Prerequisites

- **Node.js 18+** (you have v24.11.1 ✓)
- **Docker Desktop** (for IPFS node) OR **IPFS Desktop** installed locally
- **Firebase Account** (for authentication)
- **Git** (already have the repo)

## 🔍 Current Status Check

✅ Node.js installed (v24.11.1)  
✅ Dependencies installed (node_modules exists)  
✅ .env file exists  
⚠️ Need to configure .env with actual values  
⚠️ Need to setup IPFS node  
⚠️ Need to fix Windows-specific paths  

---

## 🚀 Step-by-Step Setup

### Step 1: Fix Database Path for Windows

The current `.env` has a Linux path. Update it for Windows:

**Current (Linux):**
```
DATABASE_URL=sqlite:///home/ubuntu/ipfs-drive/data/ipfs-drive.db
```

**For Windows, use one of these:**

**Option A: Relative path (recommended for development)**
```
DATABASE_URL=sqlite://../data/ipfs-drive.db
```

**Option B: Absolute Windows path**
```
DATABASE_URL=sqlite:///E:/programming/forked/walt/backend/data/ipfs-drive.db
```

**Create the data directory:**
```powershell
# From backend directory
mkdir ..\data
```

### Step 2: Setup IPFS Node

You have two options:

#### Option A: Docker (Recommended)

1. **Install Docker Desktop** if not already installed
   - Download from: https://www.docker.com/products/docker-desktop

2. **Create docker-compose.yml in backend directory:**

```yaml
version: '3'
services:
  ipfs:
    image: ipfs/kubo:latest
    container_name: ipfs-node
    restart: unless-stopped
    ports:
      - "127.0.0.1:5001:5001"  # API (localhost only)
      - "127.0.0.1:8080:8080"  # Gateway (localhost only)
      - "4001:4001"            # Swarm
    volumes:
      - ./ipfs-data:/data/ipfs
    environment:
      - IPFS_PROFILE=server
```

3. **Start IPFS:**
```powershell
docker-compose up -d
```

4. **Verify IPFS is running:**
```powershell
curl http://127.0.0.1:5001/api/v0/version
```

#### Option B: Local IPFS Installation

1. **Download IPFS Desktop** from: https://docs.ipfs.tech/install/ipfs-desktop/
2. **Install and start IPFS Desktop**
3. **Verify it's running:**
```powershell
curl http://127.0.0.1:5001/api/v0/version
```

### Step 3: Configure Firebase Admin Credentials

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select your project: `walt-b9f64`

2. **Get Service Account Credentials:**
   - Click ⚙️ **Settings** → **Project Settings**
   - Go to **"Service Accounts"** tab
   - Click **"Generate New Private Key"**
   - Download the JSON file

3. **Update .env file:**

Open `backend/.env` and replace the Firebase credentials:

```env
FIREBASE_PROJECT_ID=walt-b9f64
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@walt-b9f64.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**Important:** 
- Copy the `project_id` from the JSON → `FIREBASE_PROJECT_ID`
- Copy the `client_email` from the JSON → `FIREBASE_CLIENT_EMAIL`
- Copy the `private_key` from the JSON → `FIREBASE_PRIVATE_KEY`
- Keep the quotes and `\n` characters in the private key

**OR use the JSON string directly:**
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"walt-b9f64",...}
```
(Copy the entire JSON content as a single line)

### Step 4: Update Other .env Settings

Update these values in `backend/.env`:

```env
# Database (Windows path)
DATABASE_URL=sqlite://../data/ipfs-drive.db

# IPFS (should already be correct)
IPFS_API_URL=http://127.0.0.1:5001

# Server
PORT=3001
NODE_ENV=development  # Change to 'development' for local dev

# CORS (add your frontend URL)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Frontend URL (for local development)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Cashfree (optional - only if you want billing features)
# Leave as-is for now if you don't need billing
CASHFREE_X_CLIENT_ID=your_x_client_id_here
CASHFREE_X_CLIENT_SECRET=your_x_client_secret_here
CASHFREE_ENVIRONMENT=SANDBOX
```

### Step 5: Test the Backend

1. **Start the backend server:**
```powershell
cd backend
npm start
```

Or for development with auto-reload:
```powershell
npm run dev
```

2. **Verify it's running:**
   - You should see: `✓ Firebase Admin initialized successfully` (if Firebase is configured)
   - Server should start on port 3001

3. **Test the health endpoint:**
```powershell
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

4. **Test IPFS connection:**
```powershell
# This requires authentication, but you can check if server responds
curl http://localhost:3001/api/ipfs/status
```

### Step 6: Verify Everything Works

Run these checks:

```powershell
# 1. Check Node version
node --version  # Should be 18+

# 2. Check if IPFS is accessible
curl http://127.0.0.1:5001/api/v0/version

# 3. Check if backend starts
cd backend
npm start
```

---

## 🐛 Troubleshooting

### Issue: "Firebase Admin not initialized"
**Solution:** Check that your Firebase credentials in `.env` are correct. Make sure:
- `FIREBASE_PRIVATE_KEY` has the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- The private key has `\n` characters preserved (not actual newlines)

### Issue: "IPFS not available"
**Solution:** 
- Make sure IPFS node is running (Docker or IPFS Desktop)
- Check `http://127.0.0.1:5001/api/v0/version` responds
- Verify `IPFS_API_URL=http://127.0.0.1:5001` in `.env`

### Issue: "Database error"
**Solution:**
- Make sure the data directory exists: `mkdir ..\data`
- Check the `DATABASE_URL` path is correct for Windows
- Use forward slashes or escaped backslashes in the path

### Issue: "Port 3001 already in use"
**Solution:**
- Change `PORT=3001` to another port (e.g., `PORT=3002`) in `.env`
- Or stop the process using port 3001

### Issue: "Cannot find module"
**Solution:**
```powershell
cd backend
npm install
```

---

## ✅ Verification Checklist

Before considering setup complete, verify:

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install` completed)
- [ ] `.env` file configured with:
  - [ ] Correct `DATABASE_URL` (Windows path)
  - [ ] `IPFS_API_URL=http://127.0.0.1:5001`
  - [ ] Firebase credentials (all three: PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)
  - [ ] `PORT=3001` (or your preferred port)
- [ ] IPFS node running and accessible at `http://127.0.0.1:5001`
- [ ] Backend server starts without errors
- [ ] Health endpoint responds: `http://localhost:3001/health`

---

## 🎯 Next Steps

Once backend is running:

1. **Test API endpoints** (requires Firebase auth token)
2. **Connect frontend** to `http://localhost:3001`
3. **Configure frontend** `.env.local` with backend URL
4. **Start developing!**

---

## 📚 Additional Resources

- **Backend README:** `backend/README.md`
- **Self-Hosting Guide:** `SELF_HOSTING.md`
- **Firebase Docs:** https://firebase.google.com/docs/admin/setup
- **IPFS Docs:** https://docs.ipfs.tech/

---

**Need help?** Check the troubleshooting section or open an issue on GitHub.

