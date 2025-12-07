# Local Development Branch

This branch (`local`) contains a **working local development setup** with all bug fixes applied.

## What's Included

### ✅ Bug Fixes
- Fixed folder creation to sync with backend database
- Fixed SQL parameter mismatch in `/api/ipfs/list` endpoint
- Fixed FOREIGN KEY constraint errors on file upload
- Fixed "Invalid folder" errors when uploading to folders
- Fixed modal state closure issues (Create Folder, Rename, etc.)
- Fixed IPFS gateway priority (local first, exclude problematic gateways)
- Fixed CORS issues with IPFS gateways
- Added IPFS proxy API route for localhost CORS bypass

### ✅ Configuration
- Local IPFS gateway configuration (`http://localhost:8080/ipfs`)
- Backend API URL for local development (`http://localhost:3001`)
- Environment variable templates (`env.local.template`)
- Firestore security rules for notifications

### ✅ Features Working
- ✅ File upload to root folder
- ✅ Folder creation
- ✅ File upload to folders
- ✅ File listing (with backend sync)
- ✅ IPFS gateway fallback chain
- ✅ Error handling and user-friendly messages

## Setup Requirements

### Backend
1. IPFS node running (Docker: `docker-compose -f backend/docker-compose.yml up -d`)
2. Backend server running (`cd backend && npm start`)
3. Environment variables configured (see `backend/env.example`)

### Frontend
1. Environment variables configured (see `env.local.template`)
2. Frontend dev server running (`npm run dev`)

## Known Console Warnings (Harmless)

These are expected and don't affect functionality:
- `[HMR] Invalid message` - Next.js Hot Module Reload (dev only)
- `ERR_NAME_NOT_RESOLVED` for some public IPFS gateways - Expected (gateways can be unreliable)
- `LCP` image warning - Performance suggestion (optional optimization)

## Differences from Production

- Backend `/ipfs/` gateway endpoint not available (nginx handles it in production)
- Local IPFS gateway used instead of production gateway
- Development console logs enabled
- Some public gateways excluded due to CORS issues

## Next Steps

This branch serves as a **working prototype** for local development. For production:
- Use production backend URL
- Configure nginx for IPFS gateway
- Remove development console logs
- Use production IPFS gateway configuration

