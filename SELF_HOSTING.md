# Self-Hosting Guide for Walt IPFS Drive

Complete guide to self-hosting Walt on your own infrastructure.

## 🎯 Overview

Walt consists of two parts:
1. **Frontend**: Next.js app (deploy on Vercel, Netlify, or your server)
2. **Backend**: Node.js + IPFS node (deploy on AWS, DigitalOcean, or your server)

**Estimated Setup Time**: 1-2 hours  
**Monthly Cost**: $10-30 depending on provider  
**Difficulty**: Intermediate

---

## 📋 Prerequisites

- Linux server (Ubuntu 22.04 LTS recommended)
- 2GB RAM minimum (4GB recommended)
- 50GB disk space minimum
- Domain name (optional but recommended)
- Firebase account (free tier works)
- Cashfree account (optional, only for billing)

---

## 🚀 Part 1: Backend Setup

### Option A: AWS EC2 (Recommended for Production)

#### 1. Launch EC2 Instance

```bash
# Instance Type: t4g.small (ARM) or t3.small (x86)
# AMI: Ubuntu 22.04 LTS
# Storage: 50-100GB EBS
# Security Group:
#   - Port 22 (SSH) - Your IP only
#   - Port 3001 (Backend API) - Anywhere (will add nginx later)
#   - Port 80/443 (HTTP/HTTPS) - Anywhere
```

#### 2. Connect and Setup

```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu
newgrp docker

# Install nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Install git
sudo apt install -y git
```

### Option B: DigitalOcean Droplet

```bash
# Create Droplet:
# - $12/month (2GB RAM, 50GB disk)
# - Ubuntu 22.04 LTS
# - Add SSH key
# - Enable IPv6

# SSH in and follow same setup as AWS above
```

### Option C: Local/Home Server

```bash
# Requirements:
# - Linux machine or Raspberry Pi 4 (4GB+)
# - Static IP or DDNS
# - Port forwarding on router
# - Same software setup as above
```

### 3. Setup IPFS Node

```bash
# Create project directory
mkdir -p ~/ipfs-drive
cd ~/ipfs-drive

# Clone backend
git clone https://github.com/aayushman-singh/walt.git backend
cd backend

# Create docker-compose.yml for IPFS
cat > docker-compose.yml << 'EOF'
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
EOF

# Start IPFS
docker-compose up -d

# Verify IPFS is running
curl http://127.0.0.1:5001/api/v0/version
```

### 4. Configure Backend

```bash
cd ~/ipfs-drive/backend

# Install dependencies
npm install

# Create database directory
mkdir -p ~/ipfs-drive/data

# Copy environment template
cp env.example .env

# Edit .env file
nano .env
```

**Edit `.env` with your settings**:

```bash
# Database
DATABASE_URL=sqlite:///home/ubuntu/ipfs-drive/data/ipfs-drive.db

# IPFS (local node)
IPFS_API_URL=http://127.0.0.1:5001

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key here\n-----END PRIVATE KEY-----\n"

# Server
PORT=3001
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Billing (optional)
FREE_TIER_GB=5
COST_PER_GB_USD=0.40

# Cashfree (optional, only if you want billing)
CASHFREE_X_CLIENT_ID=your_client_id
CASHFREE_X_CLIENT_SECRET=your_client_secret
CASHFREE_ENVIRONMENT=PRODUCTION
```

### 5. Setup systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/walt-backend.service
```

**Add this content**:

```ini
[Unit]
Description=Walt IPFS Drive Backend
After=network.target docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ipfs-drive/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/walt-backend.log
StandardError=append:/var/log/walt-backend-error.log

[Install]
WantedBy=multi-user.target
```

**Enable and start**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable walt-backend
sudo systemctl start walt-backend

# Check status
sudo systemctl status walt-backend

# View logs
sudo tail -f /var/log/walt-backend.log
```

### 6. Setup Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/walt-backend
```

**Add this configuration**:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 500M;

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for large uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # IPFS Gateway
    location /ipfs/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable site**:

```bash
sudo ln -s /etc/nginx/sites-available/walt-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup SSL Certificate

```bash
sudo certbot --nginx -d api.yourdomain.com
```

Follow prompts to get free SSL from Let's Encrypt.

---

## 🌐 Part 2: Frontend Setup

### Option A: Vercel (Easiest)

1. **Fork the repository** on GitHub

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your forked repository

3. **Add Environment Variables** in Vercel dashboard:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_BACKEND_API_URL=https://api.yourdomain.com
   NEXT_PUBLIC_IPFS_GATEWAY=https://api.yourdomain.com/ipfs
   ```

4. **Deploy**
   - Vercel will auto-deploy
   - Add your custom domain in settings

### Option B: Self-Host Frontend

```bash
# On your server (can be same as backend)
cd ~/ipfs-drive
git clone https://github.com/aayushman-singh/walt.git frontend
cd frontend

# Install dependencies
npm install

# Create .env.local
cp .env.local.example .env.local
nano .env.local
# Add your environment variables

# Build
npm run build

# Setup systemd service
sudo nano /etc/systemd/system/walt-frontend.service
```

**Service file**:

```ini
[Unit]
Description=Walt IPFS Drive Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ipfs-drive/frontend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable walt-frontend
sudo systemctl start walt-frontend
```

**Nginx config** for frontend:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable SSL**:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🔧 Part 3: Firebase Setup

1. **Create Firebase Project**
   - Go to [console.firebase.google.com](https://console.firebase.google.com)
   - Click "Add project"
   - Follow wizard

2. **Enable Authentication**
   - Go to Authentication → Get Started
   - Enable Email/Password
   - Add authorized domains: `yourdomain.com`, `api.yourdomain.com`

3. **Get Web Credentials**
   - Project Settings → Your apps → Web app
   - Copy config for frontend `.env.local`

4. **Get Admin SDK Credentials**
   - Project Settings → Service Accounts
   - Generate new private key
   - Use in backend `.env`

5. **Setup Firestore** (optional, for user preferences)
   - Go to Firestore Database
   - Create database in production mode
   - Add security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 💰 Part 4: Billing Setup (Optional)

Only needed if you want to charge users.

### 1. Cashfree Setup

1. **Create account** at [cashfree.com](https://www.cashfree.com)
2. Get API credentials from dashboard
3. Add to backend `.env`

### 2. Configure Webhook

In Cashfree dashboard:
- Webhook URL: `https://api.yourdomain.com/api/payment/webhook`
- Enable payment success notifications

### 3. Test Mode First

```bash
# In backend .env
CASHFREE_ENVIRONMENT=SANDBOX
FREE_TIER_GB=0.1  # Small for testing

# Upload files > 100MB to trigger billing
```

---

## 🔒 Security Hardening

### 1. Firewall Setup

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Auto-Updates

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 4. Backup Script

```bash
nano ~/backup.sh
```

**Add**:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups/$DATE

mkdir -p $BACKUP_DIR

# Backup database
cp ~/ipfs-drive/data/ipfs-drive.db $BACKUP_DIR/

# Backup IPFS data
tar -czf $BACKUP_DIR/ipfs-data.tar.gz ~/ipfs-drive/backend/ipfs-data/

# Keep only last 7 days
find ~/backups -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR"
```

**Make executable and schedule**:

```bash
chmod +x ~/backup.sh
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * /home/ubuntu/backup.sh
```

---

## 📊 Monitoring

### Check Backend Logs

```bash
sudo journalctl -u walt-backend -f
```

### Check IPFS Status

```bash
docker logs -f ipfs-node
curl http://127.0.0.1:5001/api/v0/swarm/peers | jq length
```

### Check Disk Usage

```bash
df -h
du -sh ~/ipfs-drive/backend/ipfs-data
```

### Monitor System Resources

```bash
htop
```

---

## 🚨 Troubleshooting

### Backend won't start

```bash
# Check logs
sudo journalctl -u walt-backend -n 50

# Check if port 3001 is in use
sudo lsof -i :3001

# Restart service
sudo systemctl restart walt-backend
```

### IPFS node issues

```bash
# Check Docker status
docker ps

# Restart IPFS
docker-compose restart

# Check IPFS logs
docker logs ipfs-node
```

### Database errors

```bash
# Check permissions
ls -la ~/ipfs-drive/data/ipfs-drive.db

# Should be owned by ubuntu
sudo chown ubuntu:ubuntu ~/ipfs-drive/data/ipfs-drive.db
```

### Upload timeouts

```bash
# Increase nginx timeouts in /etc/nginx/sites-available/walt-backend
client_max_body_size 1G;
proxy_connect_timeout 600;
proxy_send_timeout 600;
proxy_read_timeout 600;

# Reload nginx
sudo systemctl reload nginx
```

---

## 📈 Scaling

### For Higher Traffic

1. **Upgrade server**:
   - AWS: t4g.medium (4GB RAM)
   - Add more disk space

2. **Add caching**:
   - Enable nginx caching
   - Use Cloudflare CDN

3. **Database optimization**:
   - Consider PostgreSQL for multi-user
   - Add read replicas

4. **IPFS optimization**:
   - Add IPFS cluster for redundancy
   - Use dedicated gateway

---

## 💡 Tips

- **Start small**: Test on a $5/month VPS first
- **Monitor costs**: Set AWS billing alerts
- **Backup regularly**: Automate with cron
- **Update often**: `git pull && npm install && restart`
- **Use monitoring**: Uptime Robot, New Relic, etc.

---

## 📞 Need Help?

- **Documentation issues**: Open GitHub issue
- **Setup questions**: GitHub Discussions
- **Bug reports**: GitHub Issues with `self-hosting` label

---

## ✅ Verification Checklist

- [ ] Backend running and accessible at `https://api.yourdomain.com/api/ipfs/status`
- [ ] Frontend running at `https://yourdomain.com`
- [ ] Can create account and login
- [ ] Can upload files
- [ ] Can download files
- [ ] IPFS gateway works at `https://api.yourdomain.com/ipfs/QmXxx...`
- [ ] SSL certificates valid
- [ ] Firewall configured
- [ ] Backups scheduled
- [ ] Monitoring in place

---

**Congratulations! You're now self-hosting Walt!** 🎉

For production use, consider:
- Setting up monitoring (Prometheus, Grafana)
- Implementing rate limiting
- Adding Cloudflare for DDoS protection
- Setting up log aggregation (ELK stack)

