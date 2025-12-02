# Walt - Self-Hostable IPFS File Storage

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Self-Hostable](https://img.shields.io/badge/self--hostable-yes-brightgreen)](#-self-hosting)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![IPFS](https://img.shields.io/badge/IPFS-Enabled-blue)](https://ipfs.tech/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**A decentralized, open-source file storage platform built on IPFS**

[Live Demo](https://walt.aayushman.dev) · [Self-Hosting Guide](SELF_HOSTING.md) · [Documentation](#-documentation) · [Report Bug](https://github.com/aayushman-singh/walt/issues) · [Request Feature](https://github.com/aayushman-singh/walt/issues)

</div>

---

## 🌟 Why Walt?

**Walt** is a modern, self-hostable alternative to centralized cloud storage. Built on IPFS (InterPlanetary File System), it gives you true ownership of your data with the convenience of a modern web interface.

### Key Benefits

- 🌐 **Decentralized**: Files stored on IPFS are content-addressed and distributed
- 🔒 **Private**: Self-host on your own infrastructure, no third-party access
- 💰 **Affordable**: 5GB free tier, then just $0.40/GB/month (if using our hosted version)
- 🚀 **Fast**: Edge caching and multiple gateway support
- 📦 **Open Source**: MIT licensed, fork and modify freely
- 🔧 **Self-Hostable**: Run on AWS, DigitalOcean, or even a Raspberry Pi

### Perfect For

- 💼 Small teams wanting data sovereignty
- 👨‍💻 Developers building on IPFS
- 🏠 Self-hosting enthusiasts
- 🔬 Projects requiring decentralized storage
- 📚 Archiving important files permanently

---

## ✨ Features

### Core Functionality
- 📁 **File Management**: Upload, download, organize files and folders
- 📌 **Pinning**: Choose what to persist permanently on IPFS
- ⭐ **Favorites**: Star important files for quick access
- 🗑️ **Trash**: Safe deletion with 30-day recovery
- 🔗 **Sharing**: Generate links with passwords and expiration
- 🔄 **Versioning**: Track file history and restore previous versions

### Advanced Features
- 🔐 **Authentication**: Secure login via Firebase Auth
- 💰 **Billing**: Built-in usage tracking and payment integration (optional)
- 🎨 **Modern UI**: Clean, responsive interface
- ⚡ **Gateway Settings**: Configure custom IPFS gateways
- 📊 **Storage Stats**: Monitor usage and costs
- 🔔 **Notifications**: Real-time updates on file operations

### Developer Features
- 🛠️ **RESTful API**: Well-documented endpoints
- 🐳 **Docker Ready**: Easy deployment with Docker Compose
- 📝 **TypeScript**: Type-safe frontend code
- 🔌 **Modular**: Easy to extend and customize

---

## 🚀 Quick Start

### Option 1: Use Our Hosted Version (Easiest)

Try Walt instantly at **[walt.aayushman.dev](https://walt.aayushman.dev)**

- ✅ 5GB free storage
- ✅ No setup required
- ✅ Managed infrastructure
- ✅ $0.40/GB above free tier

### Option 2: Self-Host (Full Control)

Host Walt on your own infrastructure:

```bash
# Clone the repository
git clone https://github.com/aayushman-singh/walt.git
cd walt

# Follow the complete guide
cat SELF_HOSTING.md
```

**Estimated setup time**: 1-2 hours  
**Monthly cost**: $10-30 depending on provider

📖 **[Read the Complete Self-Hosting Guide →](SELF_HOSTING.md)**

---

## 📋 Architecture

```
┌─────────────────────────────────────────────┐
│            Frontend (Next.js)               │
│  - React UI                                 │
│  - Firebase Auth                            │
│  - Deployed on Vercel                       │
└─────────────────┬───────────────────────────┘
                  │ HTTPS/REST API
┌─────────────────▼───────────────────────────┐
│         Backend (Node.js/Express)           │
│  - API endpoints                            │
│  - Authentication validation                │
│  - Billing logic                            │
└─────────────┬─────────────────┬─────────────┘
              │                 │
    ┌─────────▼─────────┐  ┌───▼──────────┐
    │  SQLite Database  │  │  IPFS Node   │
    │  - User data      │  │  - File      │
    │  - Metadata       │  │    storage   │
    │  - Billing info   │  │  - Pinning   │
    └───────────────────┘  └──────────────┘
```

---

## 💻 Technology Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + CSS Modules
- **Authentication**: Firebase Auth
- **Deployment**: Vercel (or self-hosted)

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: SQLite (or PostgreSQL)
- **Storage**: IPFS (Kubo)
- **Deployment**: AWS EC2, DigitalOcean, or any VPS

### Services
- **IPFS**: Content-addressed file storage
- **Firebase**: User authentication
- **Cashfree**: Payment processing (optional)

---

## 📖 Documentation

- 📘 [Self-Hosting Guide](SELF_HOSTING.md) - Complete setup instructions
- 🤝 [Contributing Guide](CONTRIBUTING.md) - How to contribute
- 🔒 [Security Policy](SECURITY.md) - Security best practices
- 📝 [Billing Integration](PAYMENT_INTEGRATION.md) - Payment setup
- 🐛 [Troubleshooting](SELF_HOSTING.md#-troubleshooting) - Common issues

---

## 🛠️ Development

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Firebase account

### Local Setup

```bash
# Clone repository
git clone https://github.com/aayushman-singh/walt.git
cd walt

# Install frontend dependencies
npm install

# Setup backend
cd backend
npm install
cp env.example .env
# Edit .env with your settings

# Start IPFS node
docker-compose up -d

# Start backend
npm run dev

# In another terminal, start frontend
cd ..
npm run dev

# Open http://localhost:3000
```

### Project Structure

```
walt/
├── pages/              # Next.js pages
│   ├── dashboard.tsx   # Main app interface
│   ├── api/           # API routes (proxy to backend)
│   └── index.tsx      # Landing page
├── components/        # React components
├── lib/              # Utilities and helpers
├── backend/          # Backend server
│   ├── server.js     # Express server
│   ├── billingUtils.js  # Billing logic
│   └── paymentService.js # Payment integration
├── styles/           # CSS modules
├── hooks/            # React hooks
└── docs/             # Documentation
```

---

## 🤝 Contributing

We love contributions! Here's how you can help:

- 🐛 **Report bugs**: Open an issue with detailed reproduction steps
- 💡 **Suggest features**: Share your ideas in discussions
- 📝 **Improve docs**: Fix typos, add examples, write guides
- 💻 **Submit PRs**: Fix bugs or add features

**[Read our Contributing Guide →](CONTRIBUTING.md)**

### Good First Issues

New to the project? Look for issues labeled [`good first issue`](https://github.com/aayushman-singh/walt/labels/good%20first%20issue)

---

## 🌍 Community

- 💬 **[GitHub Discussions](https://github.com/aayushman-singh/walt/discussions)** - Ask questions, share ideas
- 🐛 **[Issue Tracker](https://github.com/aayushman-singh/walt/issues)** - Report bugs, request features
- 📢 **[Twitter](https://twitter.com/YOUR_TWITTER)** - Follow for updates
- 📧 **Email**: aayushman2702@gmail.com

---

## 💰 Pricing (Hosted Version)

Our hosted version at [walt.aayushman.dev](https://walt.aayushman.dev):

| Tier | Storage | Price |
|------|---------|-------|
| **Free** | 5 GB | $0/month |
| **Pay-as-you-go** | Above 5 GB | $0.40/GB/month |

**Why self-host?**
- Full control over your data
- No usage limits
- Customize as needed
- Learn IPFS and decentralized tech

---

## 📊 Roadmap

- [x] Basic file upload/download
- [x] IPFS integration
- [x] User authentication
- [x] Folder organization
- [x] File sharing
- [x] Billing system
- [ ] Mobile app (React Native)
- [ ] Team collaboration features
- [ ] Client-side encryption
- [ ] IPFS cluster support
- [ ] S3-compatible API
- [ ] Desktop app (Electron)

**[View Full Roadmap →](https://github.com/aayushman-singh/walt/projects)**

---

## 🔒 Security

Security is our priority. If you discover a vulnerability:

- 🚨 **Do NOT** open a public issue
- 📧 Email security concerns to: your-security-email@example.com
- 📖 Read our [Security Policy](SECURITY.md)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**TL;DR**: You can use, modify, and distribute this software freely, even commercially. Just keep the copyright notice.

---

## 🙏 Acknowledgments

Built with these amazing open-source projects:

- [IPFS](https://ipfs.tech/) - Decentralized storage protocol
- [Next.js](https://nextjs.org/) - React framework
- [Firebase](https://firebase.google.com/) - Authentication
- [Express](https://expressjs.com/) - Backend framework
- [SQLite](https://sqlite.org/) - Database

---

## 🌟 Star History

If you find Walt useful, give it a star! ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=aayushman-singh/walt&type=Date)](https://star-history.com/#aayushman-singh/walt&Date)

---

## 📧 Contact

- **Author**: Your Name
- **Website**: [walt.aayushman.dev](https://walt.aayushman.dev)
- **Email**: aayushman2702@gmail.com
- **Twitter**: [@aayushman2703](https://twitter.com/your_handle)

---

<div align="center">

**[⬆ Back to Top](#walt---self-hostable-ipfs-file-storage)**

Made with ❤️ by the open-source community

[⭐ Star us on GitHub](https://github.com/aayushman-singh/walt) · [🐛 Report Bug](https://github.com/aayushman-singh/walt/issues) · [💡 Request Feature](https://github.com/aayushman-singh/walt/issues)

</div>
