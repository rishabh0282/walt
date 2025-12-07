# Frontend Setup Summary

## ✅ Quick Setup Checklist

### 1. Create .env.local File

Create a file named `.env.local` in the root directory with this content:

```env
# Firebase Client Configuration (REQUIRED)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=walt-b9f64.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=walt-b9f64
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=walt-b9f64.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Backend API URL (REQUIRED)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001

# IPFS Gateway (OPTIONAL - for local IPFS)
# NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080/ipfs
```

### 2. Get Firebase Client Credentials

**Important:** These are **different** from backend Firebase Admin credentials!

1. Go to: https://console.firebase.google.com/
2. Select project: `walt-b9f64`
3. Settings → Project Settings
4. Scroll to "Your apps" section
5. Click the **</> (Web)** icon (or select existing web app)
6. Copy the config values from the Firebase SDK snippet

### 3. Run Setup Script

```powershell
.\setup-frontend.ps1
```

### 4. Start Frontend

```powershell
npm run dev
```

Open: **http://localhost:3000**

---

## 📋 Required Environment Variables

| Variable | Where to Get It |
|----------|----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console → Project Settings → Web app config |
| `NEXT_PUBLIC_BACKEND_API_URL` | Your backend URL (http://localhost:3001 for local) |

---

## 🚀 Quick Start Commands

```powershell
# 1. Create .env.local (copy template above)
New-Item -ItemType File -Path .env.local

# 2. Run setup checker
.\setup-frontend.ps1

# 3. Install dependencies (if needed)
npm install

# 4. Start frontend
npm run dev
```

---

## ✅ Verification

- [ ] `.env.local` file exists
- [ ] All Firebase variables configured
- [ ] Backend URL set to `http://localhost:3001`
- [ ] Backend server running
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:3000

---

## 📚 Full Documentation

For detailed setup instructions, see: **`FRONTEND_SETUP_GUIDE.md`**

---

## 🔑 Key Differences: Frontend vs Backend Firebase

| | Frontend | Backend |
|---|---|---|
| **Config Type** | Client SDK | Admin SDK |
| **Location** | Firebase Console → Your apps → Web | Firebase Console → Service Accounts |
| **Variables** | `NEXT_PUBLIC_FIREBASE_*` | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| **Purpose** | User authentication | Server-side operations |

**You need BOTH configured!**

