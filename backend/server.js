import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import Database from 'better-sqlite3';
import { create } from 'ipfs-http-client';
import { readFile } from 'fs/promises';
import { randomUUID as uuidv4 } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import * as paymentService from './paymentService.js';
import * as billingUtils from './billingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Works from both project root and backend directory
dotenv.config({ path: join(__dirname, '.env') });

// Handle empty string env vars from shell - prioritize .env file values
const firebaseVarsEmpty = 
  process.env.FIREBASE_PROJECT_ID === '' || 
  process.env.FIREBASE_CLIENT_EMAIL === '' || 
  process.env.FIREBASE_PRIVATE_KEY === '';

if (firebaseVarsEmpty) {
  dotenv.config({ path: join(__dirname, '.env'), override: true });
}

const app = express();
const upload = multer({ dest: '/tmp' });

let firestore = null;
let firebaseAuth = null;
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

  const hasProjectId = !!serviceAccount.project_id;
  const hasClientEmail = !!serviceAccount.client_email;
  const hasPrivateKey = !!serviceAccount.private_key;

  if (hasProjectId && hasClientEmail && hasPrivateKey) {
    try {
      initializeApp({
        credential: cert(serviceAccount),
      });
      firestore = getFirestore();
      firebaseAuth = getAuth();
      console.log('✓ Firebase Admin initialized successfully');
    } catch (error) {
      console.error('✗ Firebase Admin initialization failed:', error.message);
      console.error('Error details:', error);
    }
  } else {
    console.warn('Firebase Admin not initialized: Missing required credentials');
    console.warn(`  - FIREBASE_PROJECT_ID: ${hasProjectId ? 'SET' : 'MISSING'}`);
    console.warn(`  - FIREBASE_CLIENT_EMAIL: ${hasClientEmail ? 'SET' : 'MISSING'}`);
    console.warn(`  - FIREBASE_PRIVATE_KEY: ${hasPrivateKey ? 'SET' : 'MISSING'}`);
    console.warn('⚠ Authentication will not work without Firebase credentials');
  }
} else {
  firestore = getFirestore();
  firebaseAuth = getAuth();
}

const dbPath = process.env.DATABASE_URL?.replace('sqlite://', '') || './data/ipfs-drive.db';
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL'); // Better concurrency for writes
function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT,
      storage_used INTEGER DEFAULT 0,
      storage_limit INTEGER DEFAULT 10737418240,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
    
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      parent_folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      is_starred INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
    
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cid TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT,
      size INTEGER,
      mime_type TEXT,
      parent_folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      is_pinned INTEGER DEFAULT 0,
      pin_service TEXT,
      pin_status TEXT,
      is_starred INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      last_accessed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
    CREATE INDEX IF NOT EXISTS idx_files_cid ON files(cid);
    CREATE INDEX IF NOT EXISTS idx_files_parent_folder ON files(parent_folder_id);
    
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
      folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_token TEXT UNIQUE NOT NULL,
      permission_level TEXT DEFAULT 'viewer',
      password_hash TEXT,
      expires_at TEXT,
      max_downloads INTEGER,
      download_count INTEGER DEFAULT 0,
      access_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_accessed_at TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);
    
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
      folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_file_id ON activity_logs(file_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    
    CREATE TABLE IF NOT EXISTS billing_info (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_method_added INTEGER DEFAULT 0,
      payment_info_received_at TEXT,
      services_blocked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_billing_info_user_id ON billing_info(user_id);
    
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cashfree_order_id TEXT UNIQUE,
      order_amount REAL NOT NULL,
      order_currency TEXT DEFAULT 'INR',
      order_status TEXT DEFAULT 'PENDING',
      payment_session_id TEXT,
      payment_link TEXT,
      billing_period_start TEXT,
      billing_period_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_cashfree_order_id ON orders(cashfree_order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      billing_day INTEGER NOT NULL,
      last_billed_at TEXT,
      next_billing_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    
    CREATE TABLE IF NOT EXISTS short_links (
      id TEXT PRIMARY KEY,
      short_code TEXT UNIQUE NOT NULL,
      file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
      folder_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_id TEXT REFERENCES shares(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      access_count INTEGER DEFAULT 0,
      last_accessed_at TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(short_code);
    CREATE INDEX IF NOT EXISTS idx_short_links_file_id ON short_links(file_id);
    CREATE INDEX IF NOT EXISTS idx_short_links_user_id ON short_links(user_id);
  `);
}

// Short code generation utility
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateShortCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += BASE62[Math.floor(Math.random() * BASE62.length)];
  }
  return code;
}

function getUniqueShortCode(db, maxAttempts = 10) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const code = generateShortCode();
    const existing = db.prepare('SELECT id FROM short_links WHERE short_code = ?').get(code);
    
    if (!existing) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique short code after multiple attempts');
}

initializeSchema();

const ipfsUrl = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';
const ipfs = create({ url: ipfsUrl });

let allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || ['https://walt.aayushman.dev'];
if (!allowedOrigins.includes('http://localhost:3000')) {
  allowedOrigins.push('http://localhost:3000');
}
allowedOrigins = [...new Set(allowedOrigins)];

// CORS handled by nginx to avoid duplicate headers
// Uncomment if accessing backend directly:
// app.use(cors({ origin: allowedOrigins, credentials: true }));

// Raw body needed for webhook signature verification
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    return next();
  }
  return jsonParser(req, res, next);
});
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!firebaseAuth) {
      return res.status(503).json({ 
        error: 'Authentication service unavailable', 
        message: 'Firebase Admin is not initialized. Please configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.' 
      });
    }
    
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
function getOrCreateUser(firebaseUid, email, displayName) {
  let user = db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(firebaseUid);
  
  if (!user) {
    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, firebase_uid, email, display_name)
      VALUES (?, ?, ?, ?)
    `).run(userId, firebaseUid, email, displayName || null);
    user = db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(firebaseUid);
  } else if (user.email !== email || user.display_name !== displayName) {
    db.prepare(`
      UPDATE users SET email = ?, display_name = ?, updated_at = datetime('now')
      WHERE firebase_uid = ?
    `).run(email, displayName || null, firebaseUid);
    user = db.prepare('SELECT * FROM users WHERE firebase_uid = ?').get(firebaseUid);
  }
  
  return user;
}

function rowToObject(row) {
  if (!row) return null;
  const obj = { ...row };
  // SQLite stores booleans as integers
  Object.keys(obj).forEach(key => {
    if ((key.includes('is_') || key === 'is_active' || key === 'is_deleted' || key === 'is_starred' || key === 'is_pinned') && typeof obj[key] === 'number') {
      obj[key] = obj[key] === 1;
    }
    if (key === 'metadata' && typeof obj[key] === 'string') {
      try {
        obj[key] = JSON.parse(obj[key]);
      } catch {}
    }
  });
  return obj;
}
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ipfs/status', verifyAuth, async (req, res) => {
  try {
    const id = await ipfs.id();
    const peers = await ipfs.swarm.peers();
    const stats = await ipfs.repo.stat();
    
    res.json({
      healthy: true,
      peerCount: peers.length,
      repoSize: Number(stats.repoSize),
      storageMax: Number(stats.storageMax),
      nodeId: id.id.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'IPFS not available', message: error.message });
  }
});

// No auth required - used for homepage demo uploads
app.post('/api/ipfs/upload/guest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const MAX_GUEST_SIZE = 200 * 1024 * 1024; // 200 MB
    if (req.file.size > MAX_GUEST_SIZE) {
      return res.status(413).json({
        error: 'File too large for guest upload',
        maxSize: MAX_GUEST_SIZE,
      });
    }

    // Not pinned to conserve resources
    const fileBuffer = await readFile(req.file.path);
    const result = await ipfs.add(fileBuffer, { pin: false });
    const cid = result.cid.toString();
    const size = Number(result.size);

    console.log(`Guest upload: ${req.file.originalname} (${size} bytes) -> ${cid}`);

    res.json({
      cid,
      size,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Guest upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});
app.post('/api/ipfs/upload', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const storageStats = db.prepare('SELECT storage_used, storage_limit FROM users WHERE id = ?').get(user.id);
    if (storageStats.storage_used + req.file.size > storageStats.storage_limit) {
      return res.status(413).json({
        error: 'Storage quota exceeded',
        used: storageStats.storage_used,
        limit: storageStats.storage_limit,
      });
    }

    // Check user preference from Firestore, fallback to auto-pin
    let storedAutoPinPreference = true;
    if (firestore) {
      try {
        const userDoc = await firestore.collection('users').doc(req.user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        if (userData && typeof userData.autoPinEnabled === 'boolean') {
          storedAutoPinPreference = userData.autoPinEnabled;
        }
      } catch (prefError) {
        console.warn('Failed to load auto-pin preference from Firestore:', prefError);
      }
    }

    // Request body overrides stored preference
    let shouldPinOnUpload;
    if (typeof req.body.isPinned !== 'undefined' || typeof req.body.autoPin !== 'undefined') {
      shouldPinOnUpload = req.body.isPinned === 'true' || req.body.autoPin === 'true';
    } else {
      shouldPinOnUpload = storedAutoPinPreference;
    }

    const fileBuffer = await readFile(req.file.path);
    const result = await ipfs.add(fileBuffer, { pin: shouldPinOnUpload });
    const cid = result.cid.toString();
    const size = Number(result.size);

    const fileId = uuidv4();
    const folderId = req.body.folderId || null;
    const isPinned = shouldPinOnUpload;
    
    db.prepare(`
      INSERT INTO files (
        id, user_id, cid, filename, original_filename, size, mime_type,
        parent_folder_id, is_pinned, pin_service, pin_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId, user.id, cid, req.file.originalname, req.file.originalname,
      size, req.file.mimetype, folderId, isPinned ? 1 : 0,
      isPinned ? 'local' : null, isPinned ? 'pinned' : 'unpinned'
    );

    db.prepare("UPDATE users SET storage_used = storage_used + ?, updated_at = datetime('now') WHERE id = ?")
      .run(size, user.id);

    db.prepare(`
      INSERT INTO activity_logs (id, user_id, file_id, action, ip_address, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), user.id, fileId, 'upload',
      req.ip, req.get('user-agent'),
      JSON.stringify({ cid, filename: req.file.originalname, size })
    );

    res.json({
      success: true,
      file: {
        id: fileId,
        cid,
        filename: req.file.originalname,
        size,
        mimeType: req.file.mimetype,
        isPinned,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

app.get('/api/ipfs/list', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const folderId = req.query.folderId || null;

    const filesQuery = folderId
      ? 'SELECT * FROM files WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0 ORDER BY created_at DESC'
      : 'SELECT * FROM files WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0 ORDER BY created_at DESC';
    
    const files = folderId
      ? db.prepare(filesQuery).all(user.id, folderId).map(rowToObject)
      : db.prepare(filesQuery).all(user.id).map(rowToObject);

    const foldersQuery = folderId
      ? 'SELECT * FROM folders WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0 ORDER BY name ASC'
      : 'SELECT * FROM folders WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0 ORDER BY name ASC';
    
    const folders = folderId
      ? db.prepare(foldersQuery).all(user.id, folderId).map(rowToObject)
      : db.prepare(foldersQuery).all(user.id).map(rowToObject);

    res.json({ files, folders });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list files', message: error.message });
  }
});

app.get('/api/ipfs/download', verifyAuth, async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { cid, fileId } = req.query;

    let fileRecord;
    if (fileId) {
      fileRecord = rowToObject(db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').get(fileId, user.id));
      if (!fileRecord) {
        return res.status(404).json({ error: 'File not found' });
      }
    } else if (cid) {
      fileRecord = rowToObject(db.prepare('SELECT * FROM files WHERE cid = ? AND user_id = ? AND is_deleted = 0').get(cid, user.id));
      if (!fileRecord) {
        return res.status(404).json({ error: 'File not found' });
      }
    } else {
      return res.status(400).json({ error: 'Missing cid or fileId parameter' });
    }

    // Get file from IPFS
    const chunks = [];
    for await (const chunk of ipfs.cat(fileRecord.cid)) {
      chunks.push(chunk);
    }

    // Update last accessed
    db.prepare("UPDATE files SET last_accessed_at = datetime('now') WHERE id = ?").run(fileRecord.id);

    // Log activity
    db.prepare(`
      INSERT INTO activity_logs (id, user_id, file_id, action, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), user.id, fileRecord.id, 'download', req.ip, req.get('user-agent'));

    // Send file
    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.original_filename || fileRecord.filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed', message: error.message });
  }
});

app.post('/api/folders', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { name, parentFolderId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folderId = uuidv4();
    db.prepare(`
      INSERT INTO folders (id, user_id, name, parent_folder_id)
      VALUES (?, ?, ?, ?)
    `).run(folderId, user.id, name, parentFolderId || null);

    const folder = rowToObject(db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId));
    res.json(folder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder', message: error.message });
  }
});

app.get('/api/folders', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const parentFolderId = req.query.parentFolderId || null;

    const query = parentFolderId
      ? 'SELECT * FROM folders WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0 ORDER BY name ASC'
      : 'SELECT * FROM folders WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0 ORDER BY name ASC';

    const folders = db.prepare(query).all(user.id, parentFolderId).map(rowToObject);
    res.json(folders);
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ error: 'Failed to list folders', message: error.message });
  }
});

app.put('/api/folders/:id', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { id } = req.params;

    const folder = rowToObject(db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(id, user.id));
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const updates = [];
    const values = [];
    if (req.body.name !== undefined) {
      updates.push('name = ?');
      values.push(req.body.name);
    }
    if (req.body.isStarred !== undefined) {
      updates.push('is_starred = ?');
      values.push(req.body.isStarred ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id, user.id);
      db.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    }

    const updated = rowToObject(db.prepare('SELECT * FROM folders WHERE id = ?').get(id));
    res.json(updated);
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Failed to update folder', message: error.message });
  }
});

app.delete('/api/folders/:id', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { id } = req.params;

    db.prepare(`
      UPDATE folders SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(id, user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder', message: error.message });
  }
});

app.get('/api/user/profile', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      storageUsed: user.storage_used,
      storageLimit: user.storage_limit,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', message: error.message });
  }
});

app.get('/api/user/storage', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    res.json({
      used: user.storage_used,
      limit: user.storage_limit,
      percentage: (user.storage_used / user.storage_limit) * 100,
    });
  } catch (error) {
    console.error('Get storage error:', error);
    res.status(500).json({ error: 'Failed to get storage stats', message: error.message });
  }
});

app.get('/api/activity', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const limit = parseInt(req.query.limit) || 20;

    const logs = db.prepare(`
      SELECT * FROM activity_logs WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(user.id, limit).map(rowToObject);

    res.json(logs);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity', message: error.message });
  }
});

app.get('/api/files/:id', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { id } = req.params;

    const file = rowToObject(db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0').get(id, user.id));
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json(file);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file', message: error.message });
  }
});

app.put('/api/files/:id', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { id } = req.params;

    const file = rowToObject(db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(id, user.id));
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const updates = [];
    const values = [];
    if (req.body.filename !== undefined) {
      updates.push('filename = ?');
      values.push(req.body.filename);
    }
    if (req.body.isStarred !== undefined) {
      updates.push('is_starred = ?');
      values.push(req.body.isStarred ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id, user.id);
      db.prepare(`UPDATE files SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    }

    const updated = rowToObject(db.prepare('SELECT * FROM files WHERE id = ?').get(id));
    res.json(updated);
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ error: 'Failed to update file', message: error.message });
  }
});

app.delete('/api/files/:id', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { id } = req.params;

    db.prepare(`
      UPDATE files SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(id, user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file', message: error.message });
  }
});

app.post('/api/shares', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { fileId, folderId, permissionLevel, password, expiresAt, maxDownloads } = req.body;

    const shareId = uuidv4();
    const shareToken = uuidv4().replace(/-/g, '');

    db.prepare(`
      INSERT INTO shares (id, file_id, folder_id, user_id, share_token, permission_level, password_hash, expires_at, max_downloads)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      shareId, fileId || null, folderId || null, user.id, shareToken,
      permissionLevel || 'viewer', password || null, expiresAt || null, maxDownloads || null
    );

    // Generate short link automatically
    let shortCode = null;
    let shortUrl = null;
    try {
      const shortLinkId = uuidv4();
      shortCode = getUniqueShortCode(db);
      
      db.prepare(`
        INSERT INTO short_links (id, short_code, file_id, folder_id, user_id, share_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        shortLinkId, shortCode, fileId || null, folderId || null, user.id, shareId
      );
      
      shortUrl = `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/s/${shortCode}`;
    } catch (shortLinkError) {
      console.warn('Failed to create short link:', shortLinkError);
      // Continue without short link - not critical
    }

    res.json({
      shareId,
      shareToken,
      shareUrl: `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/share/${shareToken}`,
      shortCode,
      shortUrl,
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Failed to create share', message: error.message });
  }
});

app.get('/api/shares/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const share = rowToObject(db.prepare('SELECT * FROM shares WHERE share_token = ? AND is_active = 1').get(token));

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    // Check max downloads
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return res.status(410).json({ error: 'Share download limit reached' });
    }

    // Get file or folder
    if (share.file_id) {
      const file = rowToObject(db.prepare('SELECT * FROM files WHERE id = ?').get(share.file_id));
      res.json({ share, file });
    } else if (share.folder_id) {
      const folder = rowToObject(db.prepare('SELECT * FROM folders WHERE id = ?').get(share.folder_id));
      res.json({ share, folder });
    } else {
      res.status(404).json({ error: 'Share target not found' });
    }
  } catch (error) {
    console.error('Get share error:', error);
    res.status(500).json({ error: 'Failed to get share', message: error.message });
  }
});

app.get('/api/s/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const shortLink = rowToObject(db.prepare('SELECT * FROM short_links WHERE short_code = ?').get(code));

    if (!shortLink) {
      return res.status(404).json({ error: 'Short link not found' });
    }

    db.prepare(`
      UPDATE short_links 
      SET access_count = access_count + 1,
          last_accessed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(shortLink.id);

    // Get the associated share
    let share = null;
    if (shortLink.share_id) {
      share = rowToObject(db.prepare('SELECT * FROM shares WHERE id = ? AND is_active = 1').get(shortLink.share_id));
    } else if (shortLink.file_id) {
      // If no share exists, find or create one
      share = rowToObject(db.prepare('SELECT * FROM shares WHERE file_id = ? AND is_active = 1 LIMIT 1').get(shortLink.file_id));
    }

    if (share) {
      // Redirect to share page
      const shareUrl = `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/share/${share.share_token}`;
      return res.redirect(shareUrl);
    }

    // If no share, try direct file access
    if (shortLink.file_id) {
      const file = rowToObject(db.prepare('SELECT * FROM files WHERE id = ? AND is_deleted = 0').get(shortLink.file_id));
      if (file) {
        // Redirect to download or file view
        const downloadUrl = `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/api/ipfs/download?fileId=${file.id}`;
        return res.redirect(downloadUrl);
      }
    }

    return res.status(404).json({ error: 'File or share not found' });
  } catch (error) {
    console.error('Short link redirect error:', error);
    res.status(500).json({ error: 'Failed to process short link', message: error.message });
  }
});

app.get('/api/short-links/:code/info', async (req, res) => {
  try {
    const { code } = req.params;
    const shortLink = rowToObject(db.prepare('SELECT * FROM short_links WHERE short_code = ?').get(code));

    if (!shortLink) {
      return res.status(404).json({ error: 'Short link not found' });
    }

    let file = null;
    let folder = null;
    let share = null;

    if (shortLink.file_id) {
      file = rowToObject(db.prepare('SELECT * FROM files WHERE id = ?').get(shortLink.file_id));
    }
    if (shortLink.folder_id) {
      folder = rowToObject(db.prepare('SELECT * FROM folders WHERE id = ?').get(shortLink.folder_id));
    }
    if (shortLink.share_id) {
      share = rowToObject(db.prepare('SELECT * FROM shares WHERE id = ?').get(shortLink.share_id));
    }

    res.json({
      shortCode: shortLink.short_code,
      file,
      folder,
      share,
      accessCount: shortLink.access_count,
      createdAt: shortLink.created_at,
      lastAccessedAt: shortLink.last_accessed_at,
    });
  } catch (error) {
    console.error('Get short link info error:', error);
    res.status(500).json({ error: 'Failed to get short link info', message: error.message });
  }
});

app.post('/api/ipfs/add', verifyAuth, async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { data, pin } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Missing data parameter' });
    }

    let buffer;
    if (typeof data === 'string') {
      // If it's a string, encode it as UTF-8
      buffer = Buffer.from(data, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Data must be a string' });
    }

    // Upload to IPFS
    const shouldPin = pin === true || pin === 'true';
    const result = await ipfs.add(buffer, { pin: shouldPin });
    const cid = result.cid.toString();
    const size = Number(result.size);

    res.json({
      success: true,
      cid,
      size,
      ipfsUri: `ipfs://${cid}`
    });
  } catch (error) {
    console.error('IPFS add error:', error);
    res.status(500).json({ error: 'Failed to add data to IPFS', message: error.message });
  }
});

app.post('/api/ipfs/pin', verifyAuth, async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { cid } = req.body;

    if (!cid) {
      return res.status(400).json({ error: 'Missing CID parameter' });
    }

    const file = rowToObject(
      db.prepare('SELECT * FROM files WHERE cid = ? AND user_id = ? AND is_deleted = 0').get(cid, user.id)
    );
    if (!file) {
      return res.status(404).json({ error: 'File not found for this user' });
    }

    if (file.is_pinned) {
      return res.json({
        success: true,
        cid,
        message: 'File already pinned'
      });
    }

    const pinnedRecords = db
      .prepare('SELECT COUNT(*) AS count FROM files WHERE cid = ? AND is_pinned = 1 AND is_deleted = 0')
      .get(cid);

    if (!pinnedRecords || pinnedRecords.count === 0) {
      await ipfs.pin.add(cid);
    }

    db.prepare(`
      UPDATE files SET is_pinned = 1, pin_service = 'local', pin_status = 'pinned', updated_at = datetime('now')
      WHERE cid = ? AND user_id = ?
    `).run(cid, user.id);

    res.json({
      success: true,
      cid,
      message: 'File pinned successfully'
    });
  } catch (error) {
    console.error('Pin error:', error);
    res.status(500).json({ error: 'Failed to pin file', message: error.message });
  }
});

app.delete('/api/ipfs/pin/:cid', verifyAuth, async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { cid } = req.params;

    if (!cid) {
      return res.status(400).json({ error: 'Missing CID parameter' });
    }

    const file = rowToObject(
      db.prepare('SELECT * FROM files WHERE cid = ? AND user_id = ? AND is_deleted = 0').get(cid, user.id)
    );
    if (!file) {
      return res.status(404).json({ error: 'File not found for this user' });
    }

    if (!file.is_pinned) {
      return res.json({
        success: true,
        cid,
        message: 'File already unpinned'
      });
    }

    const pinnedReferences = db
      .prepare('SELECT COUNT(*) as count FROM files WHERE cid = ? AND is_pinned = 1 AND is_deleted = 0')
      .get(cid);

    if (!pinnedReferences) {
      return res.status(500).json({ error: 'Unable to verify pin references' });
    }

    if (pinnedReferences.count <= 1) {
      // Safe to unpin from node (no other pinned references)
      await ipfs.pin.rm(cid);
    }

    db.prepare(`
      UPDATE files SET is_pinned = 0, pin_service = NULL, pin_status = 'unpinned', updated_at = datetime('now')
      WHERE cid = ? AND user_id = ?
    `).run(cid, user.id);

    res.json({
      success: true,
      cid,
      message: 'File unpinned successfully'
    });
  } catch (error) {
    console.error('Unpin error:', error);
    // If the pin doesn't exist, that's okay - consider it a success
    if (error.message && error.message.includes('not pinned')) {
      res.json({
        success: true,
        cid,
        message: 'File unpinned successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to unpin file', message: error.message });
    }
  }
});

// IPFS Gateway (serve files directly)
// NOTE: Gateway is handled by nginx proxying to IPFS node's built-in gateway (port 8080)
// This endpoint is commented out as nginx routes /ipfs/ directly to http://ipfs:8080
/*
app.get('/ipfs/:cid(*)', async (req, res) => {
  try {
    const cid = req.params.cid;
    const chunks = [];
    
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (error) {
    console.error('IPFS gateway error:', error);
    res.status(500).json({ error: 'Failed to retrieve from IPFS', message: error.message });
  }
});
*/

// ============================================
// Billing & Payment Endpoints
// ============================================

// Get billing status for user
app.get('/api/billing/status', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    
    // Get user's pinned files total size
    const pinnedFiles = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total_pinned_size
      FROM files
      WHERE user_id = ? AND is_pinned = 1 AND is_deleted = 0
    `).get(user.id);
    
    const pinnedSizeBytes = pinnedFiles?.total_pinned_size || 0;
    const pinnedSizeGB = billingUtils.bytesToGB(pinnedSizeBytes);
    const freeTierGB = billingUtils.getFreeTierGB();
    const costPerGB = billingUtils.getCostPerGB();
    const monthlyCostUSD = billingUtils.calculateMonthlyPinCost(pinnedSizeBytes);
    const exceedsLimit = billingUtils.exceedsFreeTierLimit(pinnedSizeBytes);
    const chargeAmountINR = billingUtils.calculateChargeAmount(pinnedSizeBytes);
    
    // Get billing info
    let billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE user_id = ?').get(user.id));
    if (!billingInfo) {
      // Create billing info record
      const billingId = uuidv4();
      db.prepare(`
        INSERT INTO billing_info (id, user_id)
        VALUES (?, ?)
      `).run(billingId, user.id);
      billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE id = ?').get(billingId));
    }
    
    // Get subscription
    let subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
    if (!subscription) {
      // Create subscription with billing day from account creation
      const billingDay = billingUtils.getBillingDay(user.created_at);
      const subId = uuidv4();
      const nextBilling = billingUtils.getNextBillingDate(billingDay);
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, billing_day, next_billing_at)
        VALUES (?, ?, ?, ?)
      `).run(subId, user.id, billingDay, nextBilling.toISOString());
      subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId));
    }
    
    const isBillingDay = billingUtils.isBillingDay(subscription.billing_day);

    // If we previously blocked services but it's no longer the billing day, unblock
    if (billingInfo.services_blocked === 1 && !isBillingDay) {
      db.prepare(`
        UPDATE billing_info 
        SET services_blocked = 0,
            updated_at = datetime('now')
        WHERE user_id = ?
      `).run(user.id);
      billingInfo.services_blocked = 0;
    }

    const servicesBlocked = billingInfo.services_blocked === 1 && isBillingDay;
    const paymentInfoReceived = billingInfo.payment_method_added === 1;
    
    res.json({
      pinnedSizeBytes,
      pinnedSizeGB: parseFloat(pinnedSizeGB.toFixed(2)),
      freeTierGB,
      costPerGB,
      monthlyCostUSD: parseFloat(monthlyCostUSD.toFixed(2)),
      exceedsLimit,
      chargeAmountINR: parseFloat(chargeAmountINR.toFixed(2)),
      freeTierLimitUSD: billingUtils.getFreeTierLimitUSD(), // Legacy support
      servicesBlocked,
      paymentInfoReceived,
      billingDay: subscription.billing_day,
      nextBillingDate: subscription.next_billing_at,
      billingPeriod: billingUtils.getBillingPeriod(subscription.billing_day)
    });
  } catch (error) {
    console.error('Billing status error:', error);
    res.status(500).json({ error: 'Failed to get billing status', message: error.message });
  }
});

app.post('/api/payment/create-order', verifyAuth, async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    
    // Get user's pinned files total size
    const pinnedFiles = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total_pinned_size
      FROM files
      WHERE user_id = ? AND is_pinned = 1 AND is_deleted = 0
    `).get(user.id);
    
    const pinnedSizeBytes = pinnedFiles?.total_pinned_size || 0;
    const chargeAmountINR = billingUtils.calculateChargeAmount(pinnedSizeBytes);
    
    if (chargeAmountINR <= 0) {
      return res.status(400).json({ error: 'No chargeable amount. You are within the free tier limit.' });
    }
    
    // Get subscription for billing period
    let subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
    if (!subscription) {
      const billingDay = billingUtils.getBillingDay(user.created_at);
      const subId = uuidv4();
      const nextBilling = billingUtils.getNextBillingDate(billingDay);
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, billing_day, next_billing_at)
        VALUES (?, ?, ?, ?)
      `).run(subId, user.id, billingDay, nextBilling.toISOString());
      subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId));
    }
    
    const billingPeriod = billingUtils.getBillingPeriod(subscription.billing_day);
    
    // Create order with Cashfree
    const customerDetails = {
      customer_id: user.id,
      customer_email: user.email,
      customer_phone: req.body.phone || "9999999999",
      customer_name: user.display_name || user.email
    };
    
    const result = await paymentService.createOrder(
      user.id,
      chargeAmountINR,
      "INR",
      customerDetails,
      {
        returnUrl: `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/payment/callback?order_id={order_id}`,
        notifyUrl: `${process.env.BACKEND_URL || 'https://api-walt.aayushman.dev'}/api/payment/webhook`
      }
    );
    
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to create payment order', message: result.error });
    }

    // Hosted checkout links are deprecated for prod; rely on session-based checkout
    const paymentLink = result.paymentLink || null;
    
    // Save order to database
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (
        id, user_id, cashfree_order_id, order_amount, order_currency,
        order_status, payment_session_id, payment_link,
        billing_period_start, billing_period_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      user.id,
      result.cashfreeOrderId,
      chargeAmountINR,
      "INR",
      "PENDING",
      result.paymentSessionId,
      paymentLink,
      billingPeriod.start,
      billingPeriod.end
    );
    
    res.json({
      success: true,
      orderId, // internal UUID
      cashfreeOrderId: result.cashfreeOrderId,
      paymentSessionId: result.paymentSessionId,
      paymentLink,
      amount: chargeAmountINR,
      currency: "INR"
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order', message: error.message });
  }
});

app.get('/api/payment/order/:orderId', verifyAuth, async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const { orderId } = req.params;
    
    // Get order from database
    let order = rowToObject(db.prepare(`
      SELECT * FROM orders WHERE id = ? AND user_id = ?
    `).get(orderId, user.id));
    
    // Fallback: allow lookup by Cashfree order ID (used by return_url/callback)
    if (!order) {
      order = rowToObject(db.prepare(`
        SELECT * FROM orders WHERE cashfree_order_id = ? AND user_id = ?
      `).get(orderId, user.id));
    }
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Fetch latest status from Cashfree
    if (order.cashfree_order_id) {
      const cashfreeResult = await paymentService.fetchOrder(order.cashfree_order_id);
      if (cashfreeResult.success) {
        // Update order status
        const orderStatus = cashfreeResult.data?.order_status || order.order_status;
        db.prepare(`
          UPDATE orders SET order_status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(orderStatus, order.id);
        
        // If payment successful, update billing info
        if (orderStatus === 'PAID') {
          // Mark payment info as received and unblock services
          let billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE user_id = ?').get(user.id));
          if (!billingInfo) {
            const billingId = uuidv4();
            db.prepare(`INSERT INTO billing_info (id, user_id) VALUES (?, ?)`).run(billingId, user.id);
            billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE id = ?').get(billingId));
          }
          
          db.prepare(`
            UPDATE billing_info 
            SET payment_method_added = 1, 
                payment_info_received_at = datetime('now'),
                services_blocked = 0,
                updated_at = datetime('now')
            WHERE user_id = ?
          `).run(user.id);
          
          // Update subscription next billing date
          const subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
          if (subscription) {
            const nextBilling = billingUtils.getNextBillingDate(subscription.billing_day);
            db.prepare(`
              UPDATE subscriptions 
              SET next_billing_at = ?, updated_at = datetime('now')
              WHERE user_id = ?
            `).run(nextBilling.toISOString(), user.id);
          }
        }
      }
    }
    
    const updatedOrder = rowToObject(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
    res.json(updatedOrder);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order', message: error.message });
  }
});

app.post('/api/payment/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = req.body;
    
    if (!signature || !timestamp) {
      return res.status(400).json({ error: 'Missing webhook signature or timestamp' });
    }
    const verification = paymentService.verifyWebhookSignature(signature, rawBody, timestamp);
    if (!verification.success) {
      return res.status(401).json({ error: 'Invalid webhook signature', message: verification.error });
    }
    
    const webhookData = JSON.parse(rawBody.toString());
    const { orderId, orderStatus, paymentStatus } = webhookData;
    
    // Find order by Cashfree order ID
    const order = rowToObject(db.prepare('SELECT * FROM orders WHERE cashfree_order_id = ?').get(orderId));
    if (!order) {
      console.warn('Order not found for webhook:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Update order status
    db.prepare(`
      UPDATE orders SET order_status = ?, updated_at = datetime('now')
      WHERE cashfree_order_id = ?
    `).run(orderStatus, orderId);
    
    // If payment successful, update billing info
    if (orderStatus === 'PAID' && paymentStatus === 'SUCCESS') {
      const user = rowToObject(db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id));
      if (user) {
        // Mark payment info as received and unblock services
        let billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE user_id = ?').get(user.id));
        if (!billingInfo) {
          const billingId = uuidv4();
          db.prepare(`INSERT INTO billing_info (id, user_id) VALUES (?, ?)`).run(billingId, user.id);
          billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE id = ?').get(billingId));
        }
        
        db.prepare(`
          UPDATE billing_info 
          SET payment_method_added = 1, 
              payment_info_received_at = datetime('now'),
              services_blocked = 0,
              updated_at = datetime('now')
          WHERE user_id = ?
        `).run(user.id);
        
        // Update subscription next billing date
        const subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
        if (subscription) {
          const nextBilling = billingUtils.getNextBillingDate(subscription.billing_day);
          db.prepare(`
            UPDATE subscriptions 
            SET next_billing_at = ?, updated_at = datetime('now')
            WHERE user_id = ?
          `).run(nextBilling.toISOString(), user.id);
        }
      }
    }
    
    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed', message: error.message });
  }
});

// Check if services should be blocked (called before file operations)
app.get('/api/billing/check-access', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    
    // Get user's pinned files total size
    const pinnedFiles = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total_pinned_size
      FROM files
      WHERE user_id = ? AND is_pinned = 1 AND is_deleted = 0
    `).get(user.id);
    
    const pinnedSizeBytes = pinnedFiles?.total_pinned_size || 0;
    const exceedsLimit = billingUtils.exceedsFreeTierLimit(pinnedSizeBytes);
    const monthlyCostUSD = billingUtils.calculateMonthlyPinCost(pinnedSizeBytes);
    const chargeAmountINR = billingUtils.calculateChargeAmount(pinnedSizeBytes);
    
    if (!exceedsLimit) {
      return res.json({ 
        allowed: true,
        reason: null
      });
    }
    
    // Check billing info
    let billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE user_id = ?').get(user.id));
    if (!billingInfo) {
      const billingId = uuidv4();
      db.prepare(`
        INSERT INTO billing_info (id, user_id)
        VALUES (?, ?)
      `).run(billingId, user.id);
      billingInfo = rowToObject(db.prepare('SELECT * FROM billing_info WHERE id = ?').get(billingId));
    }

    // Get subscription (needed for billing day checks)
    let subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
    if (!subscription) {
      const billingDay = billingUtils.getBillingDay(user.created_at);
      const subId = uuidv4();
      const nextBilling = billingUtils.getNextBillingDate(billingDay);
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, billing_day, next_billing_at)
        VALUES (?, ?, ?, ?)
      `).run(subId, user.id, billingDay, nextBilling.toISOString());
      subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId));
    }

    const paymentInfoReceived = billingInfo.payment_method_added === 1;
    const isBillingDay = billingUtils.isBillingDay(subscription.billing_day);

    // If we exceeded the free tier but it's not billing day yet, show a warning and allow access
    if (!paymentInfoReceived && !isBillingDay) {
      if (billingInfo.services_blocked === 1) {
        db.prepare(`
          UPDATE billing_info 
          SET services_blocked = 0,
              updated_at = datetime('now')
          WHERE user_id = ?
        `).run(user.id);
      }

      return res.json({
        allowed: true,
        reason: 'FREE_TIER_EXCEEDED',
        monthlyCostUSD: parseFloat(monthlyCostUSD.toFixed(2)),
        chargeAmountINR: parseFloat(chargeAmountINR.toFixed(2)),
        freeTierLimitUSD: billingUtils.getFreeTierLimitUSD(),
        paymentInfoReceived,
        billingDay: subscription.billing_day,
        nextBillingDate: subscription.next_billing_at
      });
    }

    // If payment info already exists, allow access even on billing day
    if (paymentInfoReceived) {
      return res.json({
        allowed: true,
        reason: null,
        monthlyCostUSD: parseFloat(monthlyCostUSD.toFixed(2)),
        chargeAmountINR: parseFloat(chargeAmountINR.toFixed(2)),
        freeTierLimitUSD: billingUtils.getFreeTierLimitUSD(),
        paymentInfoReceived,
        billingDay: subscription.billing_day,
        nextBillingDate: subscription.next_billing_at
      });
    }

    // Billing day without payment info: block and require payment
    if (billingInfo.services_blocked === 0) {
      db.prepare(`
        UPDATE billing_info 
        SET services_blocked = 1,
            updated_at = datetime('now')
        WHERE user_id = ?
      `).run(user.id);
    }

    res.json({
      allowed: false,
      reason: 'BILLING_DAY_PAYMENT_REQUIRED',
      monthlyCostUSD: parseFloat(monthlyCostUSD.toFixed(2)),
      chargeAmountINR: parseFloat(chargeAmountINR.toFixed(2)),
      freeTierLimitUSD: billingUtils.getFreeTierLimitUSD(),
      paymentInfoReceived,
      billingDay: subscription.billing_day,
      nextBillingDate: subscription.next_billing_at
    });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ error: 'Failed to check access', message: error.message });
  }
});

app.post('/api/billing/test-billing', verifyAuth, async (req, res) => {
  try {
    // Only in dev/sandbox to avoid accidental charges
    if (process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoint not available in production' });
    }

    const { userId, simulateDate } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = rowToObject(db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's pinned files total size
    const pinnedFiles = db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total_pinned_size
      FROM files
      WHERE user_id = ? AND is_pinned = 1 AND is_deleted = 0
    `).get(user.id);
    
    const pinnedSizeBytes = pinnedFiles?.total_pinned_size || 0;
    const monthlyCostUSD = billingUtils.calculateMonthlyPinCost(pinnedSizeBytes);
    const chargeAmountINR = billingUtils.calculateChargeAmount(pinnedSizeBytes);
    
    if (chargeAmountINR <= 0) {
      return res.json({
        message: 'No chargeable amount. User is within free tier limit.',
        monthlyCostUSD: parseFloat(monthlyCostUSD.toFixed(2)),
        chargeAmountINR: 0,
        freeTierLimitUSD: billingUtils.getFreeTierLimitUSD()
      });
    }

    // Get or create subscription
    let subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id));
    if (!subscription) {
      const billingDay = billingUtils.getBillingDay(user.created_at);
      const subId = uuidv4();
      const nextBilling = billingUtils.getNextBillingDate(billingDay);
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, billing_day, next_billing_at)
        VALUES (?, ?, ?, ?)
      `).run(subId, user.id, billingDay, nextBilling.toISOString());
      subscription = rowToObject(db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId));
    }

    const billingPeriod = billingUtils.getBillingPeriod(subscription.billing_day);
    
    // Create payment order
    const customerDetails = {
      customer_id: user.id,
      customer_email: user.email,
      customer_phone: "9999999999",
      customer_name: user.display_name || user.email
    };
    
    const result = await paymentService.createOrder(
      user.id,
      chargeAmountINR,
      "INR",
      customerDetails,
      {
        returnUrl: `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/payment/callback?order_id={order_id}`,
        notifyUrl: `${process.env.BACKEND_URL || 'https://api-walt.aayushman.dev'}/api/payment/webhook`
      }
    );
    
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to create payment order', message: result.error });
    }
    
    // Save order to database
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (
        id, user_id, cashfree_order_id, order_amount, order_currency,
        order_status, payment_session_id, payment_link,
        billing_period_start, billing_period_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      user.id,
      result.cashfreeOrderId,
      chargeAmountINR,
      "INR",
      "PENDING",
      result.paymentSessionId,
      result.paymentLink,
      billingPeriod.start,
      billingPeriod.end
    );
    
    res.json({
      success: true,
      message: 'Test billing order created successfully',
      orderId,
      cashfreeOrderId: result.cashfreeOrderId,
      paymentLink: result.paymentLink,
      amount: chargeAmountINR,
      currency: "INR",
      monthlyCostUSD: parseFloat(monthlyCostUSD.toFixed(2)),
      chargeAmountINR: parseFloat(chargeAmountINR.toFixed(2)),
      freeTierLimitUSD: billingUtils.getFreeTierLimitUSD(),
      billingPeriod
    });
  } catch (error) {
    console.error('Test billing error:', error);
    res.status(500).json({ error: 'Failed to create test billing order', message: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  // Server started
});

