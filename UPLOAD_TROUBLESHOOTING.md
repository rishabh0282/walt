# Upload Troubleshooting Guide

## Common Issues and Solutions

### 1. **Backend URL Configuration Issue** (Most Common)

**Problem:** The frontend is trying to connect to the wrong backend URL.

**Check:**
1. Open browser console (F12)
2. Look for network errors when uploading
3. Check what URL is being called

**Solution:**
Make sure your `.env.local` has:
```env
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001
```

**Verify:**
- Backend is running on port 3001
- Frontend is using the correct URL

---

### 2. **Backend Server Not Running**

**Check:**
```powershell
# Check if backend is running
curl http://localhost:3001/health
```

**Should return:**
```json
{"status":"ok","timestamp":"..."}
```

**If not running:**
```powershell
cd backend
npm start
```

---

### 3. **IPFS Node Not Running**

**Check:**
```powershell
# Check if IPFS is accessible
curl http://127.0.0.1:5001/api/v0/version
```

**If not running:**
```powershell
# Using Docker
cd backend
docker-compose up -d

# OR using IPFS Desktop
# Make sure IPFS Desktop is running
```

---

### 4. **CORS Issues**

**Check backend `.env`:**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Restart backend after changing:**
```powershell
cd backend
npm start
```

---

### 5. **Authentication Token Issues**

**Check:**
1. Are you logged in?
2. Check browser console for auth errors
3. Try logging out and back in

---

### 6. **File Size Issues**

**Check:**
- Backend max file size (default: no limit, but check multer config)
- IPFS node storage limits
- Network timeout for large files

---

## Diagnostic Steps

### Step 1: Check Backend URL

Open browser console and check:
```javascript
console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_API_URL);
```

Or check Network tab in DevTools to see what URL is being called.

### Step 2: Test Backend Connection

```powershell
# Test backend health
curl http://localhost:3001/health

# Test with authentication (replace TOKEN with your Firebase token)
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/ipfs/status
```

### Step 3: Check Browser Console

Look for:
- Network errors (404, 500, CORS errors)
- JavaScript errors
- Authentication errors

### Step 4: Check Backend Logs

```powershell
# If running backend with npm start, check terminal output
# Look for error messages
```

---

## Quick Fix Checklist

- [ ] Backend server is running (`npm start` in backend folder)
- [ ] IPFS node is running (Docker or IPFS Desktop)
- [ ] `.env.local` has correct `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3001`
- [ ] Backend `.env` has `ALLOWED_ORIGINS=http://localhost:3000`
- [ ] You are logged in
- [ ] Browser console shows no errors
- [ ] Network tab shows the request going to correct URL

---

## Common Error Messages

### "Failed to fetch"
- Backend not running
- Wrong backend URL
- CORS issue

### "Unauthorized" (401)
- Not logged in
- Token expired (try logging out/in)

### "Upload failed" (500)
- IPFS node not running
- Database error
- Check backend logs

### "Network error"
- Backend not accessible
- Firewall blocking
- Wrong URL

---

## Still Not Working?

1. **Check browser console** for the exact error
2. **Check backend terminal** for error logs
3. **Verify all services are running:**
   - Frontend (port 3000)
   - Backend (port 3001)
   - IPFS (port 5001)

4. **Try a simple test:**
   ```powershell
   # Test backend directly
   curl -X POST http://localhost:3001/api/ipfs/upload/guest \
     -F "file=@test.txt"
   ```

