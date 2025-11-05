import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import Database from 'better-sqlite3';
import { create } from 'ipfs-http-client';
import { readFile } from 'fs/promises';
import { randomUUID as uuidv4 } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ dest: '/tmp' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

  initializeApp({
    credential: cert(serviceAccount),
  });
}

// Initialize SQLite database
const dbPath = process.env.DATABASE_URL?.replace('sqlite://', '') || './data/ipfs-drive.db';
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize database schema
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
  `);
}

initializeSchema();

// Initialize IPFS client
const ipfsUrl = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';
const ipfs = create({ url: ipfsUrl });

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://walt.aayushman.dev', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Auth middleware
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Helper: Get or create user
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

// Helper: Convert SQLite row to object
function rowToObject(row) {
  if (!row) return null;
  const obj = { ...row };
  // Convert integer booleans to booleans
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

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// IPFS Status
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

// File Upload
app.post('/api/ipfs/upload', verifyAuth, upload.single('file'), async (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check storage quota
    const storageStats = db.prepare('SELECT storage_used, storage_limit FROM users WHERE id = ?').get(user.id);
    if (storageStats.storage_used + req.file.size > storageStats.storage_limit) {
      return res.status(413).json({
        error: 'Storage quota exceeded',
        used: storageStats.storage_used,
        limit: storageStats.storage_limit,
      });
    }

    // Upload to IPFS
    const fileBuffer = await readFile(req.file.path);
    const result = await ipfs.add(fileBuffer, { pin: true });
    const cid = result.cid.toString();
    const size = Number(result.size);

    // Save to database
    const fileId = uuidv4();
    const folderId = req.body.folderId || null;
    const isPinned = req.body.isPinned === 'true' || req.body.autoPin === 'true';
    
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

    // Update storage
    db.prepare('UPDATE users SET storage_used = storage_used + ?, updated_at = datetime("now") WHERE id = ?')
      .run(size, user.id);

    // Log activity
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

// List Files
app.get('/api/ipfs/list', verifyAuth, (req, res) => {
  try {
    const user = getOrCreateUser(req.user.uid, req.user.email, req.user.name);
    const folderId = req.query.folderId || null;

    // Get files
    const filesQuery = folderId
      ? 'SELECT * FROM files WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0 ORDER BY created_at DESC'
      : 'SELECT * FROM files WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0 ORDER BY created_at DESC';
    
    const files = db.prepare(filesQuery).all(user.id, folderId).map(rowToObject);

    // Get folders
    const foldersQuery = folderId
      ? 'SELECT * FROM folders WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0 ORDER BY name ASC'
      : 'SELECT * FROM folders WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0 ORDER BY name ASC';
    
    const folders = db.prepare(foldersQuery).all(user.id, folderId).map(rowToObject);

    res.json({ files, folders });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list files', message: error.message });
  }
});

// Download File
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
    db.prepare('UPDATE files SET last_accessed_at = datetime("now") WHERE id = ?').run(fileRecord.id);

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

// Folders
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
      updates.push('updated_at = datetime("now")');
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
      UPDATE folders SET is_deleted = 1, deleted_at = datetime("now"), updated_at = datetime("now")
      WHERE id = ? AND user_id = ?
    `).run(id, user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder', message: error.message });
  }
});

// User Profile
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

// Activity Logs
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

// File Operations
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
      updates.push('updated_at = datetime("now")');
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
      UPDATE files SET is_deleted = 1, deleted_at = datetime("now"), updated_at = datetime("now")
      WHERE id = ? AND user_id = ?
    `).run(id, user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file', message: error.message });
  }
});

// Shares (basic implementation)
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

    res.json({
      shareId,
      shareToken,
      shareUrl: `${process.env.FRONTEND_URL || 'https://walt.aayushman.dev'}/share/${shareToken}`,
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

// IPFS Gateway (serve files directly)
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🌐 IPFS: ${ipfsUrl}`);
});

