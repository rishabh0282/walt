# Backend Server Setup
Hello
## Quick Start

```bash
cd backend
npm install
cp env.example .env
# Edit .env with your values
npm start
```

## Environment Variables

### Required

1. **DATABASE_URL** - SQLite database path
   ```
   DATABASE_URL=sqlite:///home/ubuntu/walt/data/ipfs-drive.db
   ```

2. **IPFS_API_URL** - Local IPFS node (must be localhost!)
   ```
   IPFS_API_URL=http://127.0.0.1:5001
   ```

3. **Firebase Admin Credentials** (get from Firebase Console)
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file
   - Use either:
     - **Option A**: Individual fields
       ```
       FIREBASE_PROJECT_ID=walt-b9f64
       FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@walt-b9f64.iam.gserviceaccount.com
       FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
       ```
     - **Option B**: JSON string
       ```
       FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
       ```

### Optional (with defaults)

- `PORT=3001` - Server port
- `ALLOWED_ORIGINS=https://walt.aayushman.dev,http://localhost:3000` - CORS origins
- `FRONTEND_URL=https://walt.aayushman.dev` - For share links
- `NODE_ENV=production` - Environment

## Getting Firebase Admin Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `walt-b9f64`
3. Click ⚙️ Settings → Project Settings
4. Go to "Service Accounts" tab
5. Click "Generate New Private Key"
6. Download the JSON file
7. Copy values from the JSON:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and \n)

## Important Notes

- **IPFS_API_URL must be localhost** (`http://127.0.0.1:5001`) because IPFS is on the same EC2 instance
- **Do NOT use external URLs** like `https://api-walt.aayushman.dev/api/v0` - that's for the frontend only
- The database path must be absolute or relative to where you run the server
- Firebase Admin credentials are different from client credentials (NEXT_PUBLIC_*)

## Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

- `POST /api/ipfs/upload` - Upload file
- `GET /api/ipfs/list` - List files/folders
- `GET /api/ipfs/download` - Download file
- `GET /api/ipfs/status` - IPFS node status
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `GET /api/user/profile` - User profile
- `GET /api/user/storage` - Storage stats
- `GET /ipfs/:cid` - IPFS gateway

