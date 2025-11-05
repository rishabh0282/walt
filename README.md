# Walt IPFS Drive - Frontend

A decentralized file storage application built with IPFS and Next.js.

**Live Demo:** [walt.aayushman.dev](https://walt.aayushman.dev)

## Overview

This is the **frontend** repository deployed on Vercel. It communicates with a separate backend at `api-walt.aayushman.dev` which handles database and IPFS operations.

### Architecture

```
Frontend (This Repo)
  walt.aayushman.dev
  ├─ Next.js UI
  ├─ API Routes (proxy to backend)
  └─ Vercel Deployment

Backend (Separate Repo)
  api-walt.aayushman.dev
  ├─ SQLite Database
  ├─ IPFS Node
  └─ EC2 Deployment
```

## Features

- 📁 File upload/download via IPFS
- 🗂️ Folder organization
- ⭐ Starred files
- 🗑️ Trash/restore functionality
- 🔗 Share links with permissions
- 🔒 Firebase authentication
- 📊 Storage quota management
- 📱 Responsive design

## Quick Start

### Prerequisites

- Node.js 18+
- Firebase account
- Backend deployed at api-walt.aayushman.dev

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd walt

# Install dependencies
npm install
# or
pnpm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your Firebase config

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Configuration

See `.env.local.example` for required environment variables.

**Required:**
- Firebase configuration (from Firebase Console)
- `NEXT_PUBLIC_BACKEND_API_URL=https://api-walt.aayushman.dev`
- `NEXT_PUBLIC_IPFS_GATEWAY=https://api-walt.aayushman.dev/ipfs`

## Deployment

This app is designed to be deployed on **Vercel**.

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

See [setup/FRONTEND_DEPLOYMENT.md](setup/FRONTEND_DEPLOYMENT.md) for detailed deployment instructions.

## Documentation

- [Quick Start Guide](setup/QUICK_START.md) - Get up and running
- [Frontend Deployment](setup/FRONTEND_DEPLOYMENT.md) - Vercel deployment guide
- [Docker Setup](setup/DOCKER_SETUP_INSTRUCTIONS.md) - Backend IPFS/Docker setup

## Project Structure

```
walt/
├── pages/              # Next.js pages
│   ├── api/           # API routes (proxy to backend)
│   ├── dashboard.tsx  # Main app interface
│   └── index.tsx      # Landing page
├── components/        # React components
│   ├── FileUpload.tsx
│   ├── ShareModal.tsx
│   └── ...
├── lib/              # Utilities
│   ├── backendClient.ts   # Backend API client
│   ├── ipfsClient.ts      # IPFS operations
│   ├── apiAuth.ts         # Firebase auth
│   └── ...
├── styles/           # CSS styling
├── hooks/            # React hooks
├── contexts/         # React contexts
└── setup/            # Documentation
```

## Technology Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Authentication:** Firebase Auth
- **Storage:** IPFS (via backend)
- **Database:** SQLite (via backend)
- **Deployment:** Vercel
- **UI Components:** Radix UI

## API Routes

Frontend API routes proxy requests to the backend:

- `/api/ipfs/upload` → Upload files
- `/api/ipfs/list` → List user files
- `/api/ipfs/download` → Download files
- `/api/ipfs/status` → IPFS node status

All routes require Firebase authentication.

## Backend Requirements

The frontend expects these endpoints from `api-walt.aayushman.dev`:

```
POST /api/ipfs/upload       - Upload file
GET  /api/ipfs/list         - List files/folders
GET  /api/ipfs/download     - Download file
GET  /api/ipfs/status       - Node status
GET  /ipfs/:cid             - IPFS gateway
POST /api/folders           - Create folder
GET  /api/user/storage      - Storage stats
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Environment Variables

### Client-Side (Exposed to Browser)
- `NEXT_PUBLIC_FIREBASE_*` - Firebase config
- `NEXT_PUBLIC_BACKEND_API_URL` - Backend API URL
- `NEXT_PUBLIC_IPFS_GATEWAY` - IPFS gateway URL

### Server-Side (API Routes Only)
- `BACKEND_API_URL` - Internal backend URL
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase admin key

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Security

- All API requests require authentication
- Firebase tokens verified on backend
- CORS configured for walt.aayushman.dev only
- Environment variables not committed to Git

## Troubleshooting

### Build Errors
```bash
npm run build
npm run lint
```

### API Connection Issues
- Check `NEXT_PUBLIC_BACKEND_API_URL` is correct
- Verify backend is running at api-walt.aayushman.dev
- Check CORS configuration on backend

### Firebase Auth Issues
- Verify Firebase config in `.env.local`
- Check authorized domains in Firebase Console
- Ensure API keys are correct

## License

MIT

## Support

For issues related to:
- **Frontend:** Check this repo's issues
- **Backend/Database:** Check backend repo
- **IPFS:** See [IPFS Documentation](https://docs.ipfs.tech/)
- **Vercel Deployment:** See [Vercel Docs](https://vercel.com/docs)

## Links

- **Frontend:** https://walt.aayushman.dev
- **Backend API:** https://api-walt.aayushman.dev
- **IPFS Gateway:** https://api-walt.aayushman.dev/ipfs
