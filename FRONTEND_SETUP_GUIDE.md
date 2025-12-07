# Frontend Setup Guide

Complete guide to set up the Walt frontend (Next.js) for local development.

## 📋 Prerequisites

- **Node.js 18+** (you have v24.11.1 ✓)
- **Backend server running** (see `backend/SETUP_GUIDE.md`)
- **Firebase project** (same one used for backend)
- **Git** (already have the repo)

## 🔍 Current Status Check

✅ Node.js installed (v24.11.1)  
✅ Dependencies installed (node_modules exists)  
⚠️ Need to create `.env.local` file  
⚠️ Need to configure Firebase client credentials  
⚠️ Need to configure backend API URL  

---

## 🚀 Step-by-Step Setup

### Step 1: Create .env.local File

1. **Copy the example file:**
   ```powershell
   # From project root
   Copy-Item .env.local.example .env.local
   ```

2. **Or create it manually:**
   ```powershell
   # Create .env.local in the root directory
   New-Item -ItemType File -Path .env.local
   ```

### Step 2: Get Firebase Client Credentials

These are **different** from the backend Firebase Admin credentials!

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Select your project: `walt-b9f64`

2. **Get Web App Configuration:**
   - Click ⚙️ **Settings** → **Project Settings**
   - Scroll down to **"Your apps"** section
   - If you don't have a web app yet:
     - Click the **</> (Web)** icon
     - Register your app (name it "Walt Web")
     - Click **"Register app"**
   - If you already have a web app, click on it

3. **Copy the Firebase Config:**
   You'll see a config object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "walt-b9f64.firebaseapp.com",
     projectId: "walt-b9f64",
     storageBucket: "walt-b9f64.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```

4. **Update .env.local:**
   Open `.env.local` and add:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=walt-b9f64.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=walt-b9f64
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=walt-b9f64.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

### Step 3: Configure Backend API URL

1. **For Local Development:**
   ```env
   NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001
   ```

2. **For Production:**
   ```env
   NEXT_PUBLIC_BACKEND_API_URL=https://api.yourdomain.com
   ```

### Step 4: Configure IPFS Gateway (Optional)

If you're running IPFS locally via Docker:

```env
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080/ipfs
```

Or use a public gateway:
```env
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.ipfs.io/ipfs
```

**Note:** If not set, the app will use default public gateways.

### Step 5: Configure Pinata (Optional)

Only needed if you want to use Pinata for remote pinning:

1. **Get Pinata API Keys:**
   - Go to: https://app.pinata.cloud/developers/api-keys
   - Create a new API key
   - Copy the API Key and API Secret

2. **Add to .env.local:**
   ```env
   NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
   NEXT_PUBLIC_PINATA_API_SECRET=your_pinata_api_secret
   NEXT_PUBLIC_PINNING_SERVICE=pinata
   ```

**Note:** If not set, will use local IPFS node pinning.

### Step 6: Complete .env.local Example

Here's a complete example for local development:

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=walt-b9f64.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=walt-b9f64
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=walt-b9f64.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Backend API
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001

# IPFS Gateway (optional)
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080/ipfs

# Pinata (optional - only if using Pinata)
# NEXT_PUBLIC_PINATA_API_KEY=your_key
# NEXT_PUBLIC_PINATA_API_SECRET=your_secret
# NEXT_PUBLIC_PINNING_SERVICE=pinata
```

### Step 7: Install Dependencies (if not already done)

```powershell
npm install
```

### Step 8: Start the Frontend

**Development mode (with hot reload):**
```powershell
npm run dev
```

The app will start at: **http://localhost:3000**

**Production build:**
```powershell
npm run build
npm start
```

### Step 9: Verify Everything Works

1. **Open the app:**
   - Navigate to: http://localhost:3000
   - You should see the Walt homepage

2. **Test authentication:**
   - Click "Sign In" or "Get Started"
   - Try creating an account or signing in
   - You should be redirected to the dashboard

3. **Test backend connection:**
   - Once logged in, try uploading a file
   - Check browser console for any errors
   - Verify files appear in the dashboard

---

## 🔧 Configuration Checklist

Before starting the frontend, ensure:

- [ ] **.env.local file created** in the root directory
- [ ] **Firebase client credentials** added:
  - [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
  - [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] **Backend API URL** configured:
  - [ ] `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001` (for local)
- [ ] **Backend server running** on port 3001
- [ ] **Dependencies installed** (`npm install` completed)

---

## 🐛 Troubleshooting

### Issue: "Firebase: Error (auth/invalid-api-key)"
**Solution:** 
- Check that all Firebase credentials in `.env.local` are correct
- Make sure you're using **client credentials** (not Admin SDK credentials)
- Verify the credentials are from the **Web app** config, not Service Account

### Issue: "Failed to fetch" or "Network error"
**Solution:**
- Check that backend server is running: `http://localhost:3001/health`
- Verify `NEXT_PUBLIC_BACKEND_API_URL` is correct
- Check browser console for CORS errors
- Make sure backend `.env` has `ALLOWED_ORIGINS=http://localhost:3000`

### Issue: "Cannot connect to IPFS"
**Solution:**
- Make sure IPFS node is running (Docker or IPFS Desktop)
- Check `http://127.0.0.1:5001/api/v0/version` responds
- If using Docker, verify gateway is accessible at `http://localhost:8080`

### Issue: "Module not found" or build errors
**Solution:**
```powershell
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Issue: Port 3000 already in use
**Solution:**
- Stop the process using port 3000, or
- Change Next.js port:
  ```powershell
  $env:PORT=3002
  npm run dev
  ```

### Issue: "Firebase Auth domain not authorized"
**Solution:**
- Go to Firebase Console → Authentication → Settings
- Add `localhost:3000` to authorized domains
- Or add your domain if deploying

---

## 📚 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `walt-b9f64.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `walt-b9f64` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `walt-b9f64.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789012` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | `1:123456789012:web:abc...` |
| `NEXT_PUBLIC_BACKEND_API_URL` | Backend API URL | `http://localhost:3001` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_IPFS_GATEWAY` | Custom IPFS gateway URL | Public gateways |
| `NEXT_PUBLIC_PINATA_API_KEY` | Pinata API key (for remote pinning) | None |
| `NEXT_PUBLIC_PINATA_API_SECRET` | Pinata API secret | None |
| `NEXT_PUBLIC_PINNING_SERVICE` | Pinning service: `local`, `pinata`, `web3storage` | `local` |

---

## ✅ Verification Checklist

Before considering setup complete:

- [ ] `.env.local` file exists and is configured
- [ ] All Firebase client credentials are correct
- [ ] Backend API URL is set correctly
- [ ] Dependencies installed (`npm install`)
- [ ] Frontend starts without errors (`npm run dev`)
- [ ] App loads at `http://localhost:3000`
- [ ] Can sign in/create account
- [ ] Can access dashboard after login
- [ ] Backend connection works (can upload files)

---

## 🎯 Next Steps

Once frontend is running:

1. **Test the full flow:**
   - Sign up / Sign in
   - Upload a file
   - Create a folder
   - Share a file
   - Download a file

2. **Check browser console** for any warnings or errors

3. **Test on different browsers** to ensure compatibility

4. **Ready for development!** 🚀

---

## 📚 Additional Resources

- **Backend Setup:** `backend/SETUP_GUIDE.md`
- **Backend Summary:** `BACKEND_SETUP_SUMMARY.md`
- **Self-Hosting Guide:** `SELF_HOSTING.md`
- **Firebase Docs:** https://firebase.google.com/docs/web/setup
- **Next.js Docs:** https://nextjs.org/docs

---

**Need help?** Check the troubleshooting section or open an issue on GitHub.

