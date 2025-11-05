/**
 * SQLite Database Connection and Query Utilities
 * File-based database on the same EC2 instance
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';  

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

// Database connection
let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const databaseUrl = process.env.DATABASE_URL || './data/ipfs-drive.db';
  
  // Extract file path from sqlite:// or file:// URL
  let filePath = databaseUrl;
  if (filePath.startsWith('sqlite://')) {
    filePath = filePath.replace('sqlite://', '');
  } else if (filePath.startsWith('file:')) {
    filePath = filePath.replace('file:', '');
  } else if (filePath.startsWith('postgresql://')) {
    // If DATABASE_URL is still PostgreSQL format, use default SQLite path
    filePath = './data/ipfs-drive.db';
  }

  // Remove leading slash if present
  if (filePath.startsWith('/')) {
    filePath = filePath.substring(1);
  }

  // Ensure directory exists
  const path = require('path');
  const fs = require('fs');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(filePath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Initialize schema if tables don't exist
  initializeSchema();
  
  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema(): void {
  const database = getDatabase();
  
  // Create users table
  database.exec(`
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
  `);

  // Create folders table
  database.exec(`
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
  `);

  // Create files table
  database.exec(`
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
  `);

  // Create shares table
  database.exec(`
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
  `);

  // Create activity_logs table
  database.exec(`
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

/**
 * Convert PostgreSQL-style query to SQLite
 */
function convertQuery(text: string, params?: any[]): { sql: string; params: any[] } {
  let sql = text;
  const convertedParams: any[] = [];

  // Replace $1, $2, etc. with ? (SQLite uses ? placeholders)
  const paramMap = new Map<number, any>();
  if (params) {
    params.forEach((param, index) => {
      paramMap.set(index + 1, param);
    });
  }

  // Replace $1, $2, etc. with ?
  sql = sql.replace(/\$(\d+)/g, (match, num) => {
    const paramIndex = parseInt(num, 10);
    const param = paramMap.get(paramIndex);
    if (param !== undefined) {
      convertedParams.push(param);
      return '?';
    }
    return match;
  });

  // Replace PostgreSQL functions
  sql = sql.replace(/NOW\(\)/gi, "datetime('now')");
  sql = sql.replace(/gen_random_uuid\(\)/gi, '?');
  if (sql.includes('gen_random_uuid')) {
    convertedParams.push(uuidv4());
  }

  // Replace ILIKE with LIKE (SQLite doesn't have ILIKE, we'll handle case-insensitive in WHERE)
  sql = sql.replace(/ILIKE/gi, 'LIKE');

  // Replace TRUE/FALSE with 1/0 for boolean fields
  // This is handled in the query execution below

  // Replace RETURNING - SQLite supports it natively
  // But we need to handle it in the execution

  return { sql, params: convertedParams };
}

/**
 * Execute a query
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const database = getDatabase();
  const { sql, params: convertedParams } = convertQuery(text, params);
  
  const start = Date.now();
  
  try {
    // Convert boolean values to integers for SQLite
    const finalParams = convertedParams.map(param => {
      if (typeof param === 'boolean') {
        return param ? 1 : 0;
      }
      return param;
    });

    // Check if it's a SELECT query
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    const hasReturning = sql.toUpperCase().includes('RETURNING');
    
    if (isSelect) {
      const stmt = database.prepare(sql);
      const rows = stmt.all(...finalParams) as T[];
      
      // Convert boolean fields back from integers
      const convertedRows = rows.map(row => convertRowFromSQLite(row));
      
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.log('Query executed:', { text: sql, duration, rows: convertedRows.length });
      }
      
      return {
        rows: convertedRows,
        rowCount: convertedRows.length
      };
    } else {
      // INSERT, UPDATE, DELETE
      const stmt = database.prepare(sql);
      const result = stmt.run(...finalParams);
      
      // If query has RETURNING, fetch the row
      if (hasReturning && result.lastInsertRowid) {
        // Extract table name from INSERT statement
        const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const selectStmt = database.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`);
          const rows = selectStmt.all(result.lastInsertRowid) as T[];
          const convertedRows = rows.map(row => convertRowFromSQLite(row));
          
          const duration = Date.now() - start;
          if (process.env.NODE_ENV === 'development') {
            console.log('Query executed:', { text: sql, duration, rows: convertedRows.length });
          }
          
          return {
            rows: convertedRows,
            rowCount: result.changes || 0
          };
        }
      }
      
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.log('Query executed:', { text: sql, duration, rows: result.changes });
      }
      
      return {
        rows: [],
        rowCount: result.changes || 0
      };
    }
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', convertedParams);
    throw error;
  }
}

/**
 * Convert SQLite row (with integer booleans) back to JavaScript booleans
 */
function convertRowFromSQLite(row: any): any {
  if (!row || typeof row !== 'object') return row;
  
  const converted: any = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert integer booleans back to booleans
    if ((key.includes('is_') || key.includes('_is_') || key === 'is_active' || key === 'is_deleted' || key === 'is_starred' || key === 'is_pinned') && typeof value === 'number') {
      converted[key] = value === 1;
    } else if (key === 'metadata' && typeof value === 'string') {
      // Parse JSON metadata
      try {
        converted[key] = JSON.parse(value);
      } catch {
        converted[key] = value;
      }
    } else {
      converted[key] = value;
    }
  }
  return converted;
}

/**
 * Close database connection
 */
export async function closePool(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get database instance (for compatibility)
 */
export function getPool(): Database.Database {
  return getDatabase();
}

// ============================================
// Database Models and Types
// ============================================

export interface User {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  storage_used: number;
  storage_limit: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  is_starred: boolean;
  is_deleted: boolean;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface File {
  id: string;
  user_id: string;
  cid: string;
  filename: string;
  original_filename: string | null;
  size: number;
  mime_type: string | null;
  parent_folder_id: string | null;
  is_pinned: boolean;
  pin_service: string | null;
  pin_status: string;
  is_starred: boolean;
  is_deleted: boolean;
  deleted_at: Date | string | null;
  last_accessed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Share {
  id: string;
  file_id: string | null;
  folder_id: string | null;
  user_id: string;
  share_token: string;
  permission_level: 'viewer' | 'editor';
  password_hash: string | null;
  expires_at: Date | string | null;
  max_downloads: number | null;
  download_count: number;
  access_count: number;
  is_active: boolean;
  created_at: Date | string;
  last_accessed_at: Date | string | null;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  file_id: string | null;
  folder_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: Date | string;
}

// ============================================
// User Operations
// ============================================

export const UserDB = {
  /**
   * Get or create user by Firebase UID
   */
  async getOrCreate(firebaseUid: string, email: string, displayName?: string): Promise<User> {
    // First try to get existing user
    const existing = await this.getByFirebaseUid(firebaseUid);
    if (existing) {
      // Update email/display_name if changed
      if (existing.email !== email || existing.display_name !== displayName) {
        const result = await query<User>(
          `UPDATE users 
           SET email = ?, display_name = ?, updated_at = datetime('now')
           WHERE firebase_uid = ?
           RETURNING *`,
          [email, displayName || null, firebaseUid]
        );
        return result.rows[0];
      }
      return existing;
    }

    // Create new user
    const userId = uuidv4();
    const result = await query<User>(
      `INSERT INTO users (id, firebase_uid, email, display_name)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
      [userId, firebaseUid, email, displayName || null]
    );
    return result.rows[0];
  },

  /**
   * Get user by Firebase UID
   */
  async getByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE firebase_uid = ?',
      [firebaseUid]
    );
    return result.rows[0] || null;
  },

  /**
   * Update user storage
   */
  async updateStorage(userId: string, storageUsed: number): Promise<void> {
    await query(
      "UPDATE users SET storage_used = ?, updated_at = datetime('now') WHERE id = ?",
      [storageUsed, userId]
    );
  },

  /**
   * Get storage stats
   */
  async getStorageStats(userId: string): Promise<{ used: number; limit: number }> {
    const result = await query<{ storage_used: number; storage_limit: number }>(
      'SELECT storage_used, storage_limit FROM users WHERE id = ?',
      [userId]
    );
    const user = result.rows[0];
    return {
      used: Number(user?.storage_used || 0),
      limit: Number(user?.storage_limit || 0)
    };
  }
};

// ============================================
// File Operations
// ============================================

export const FileDB = {
  /**
   * Create a new file record
   */
  async create(data: {
    userId: string;
    cid: string;
    filename: string;
    size: number;
    mimeType?: string;
    parentFolderId?: string;
    isPinned?: boolean;
    pinService?: string;
  }): Promise<File> {
    const fileId = uuidv4();
    const result = await query<File>(
      `INSERT INTO files (
        id, user_id, cid, filename, original_filename, size, mime_type,
        parent_folder_id, is_pinned, pin_service, pin_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
        fileId,
        data.userId,
        data.cid,
        data.filename,
        data.filename,
        data.size,
        data.mimeType || null,
        data.parentFolderId || null,
        data.isPinned ? 1 : 0,
        data.pinService || null,
        data.isPinned ? 'pinned' : 'unpinned'
      ]
    );
    return result.rows[0];
  },

  /**
   * Get file by ID
   */
  async getById(fileId: string, userId: string): Promise<File | null> {
    const result = await query<File>(
      'SELECT * FROM files WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [fileId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get file by CID
   */
  async getByCid(cid: string, userId: string): Promise<File | null> {
    const result = await query<File>(
      'SELECT * FROM files WHERE cid = ? AND user_id = ? AND is_deleted = 0',
      [cid, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * List files in a folder
   */
  async listByFolder(userId: string, folderId: string | null): Promise<File[]> {
    if (folderId) {
      const result = await query<File>(
        `SELECT * FROM files 
         WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0
         ORDER BY created_at DESC`,
        [userId, folderId]
      );
      return result.rows;
    } else {
      const result = await query<File>(
        `SELECT * FROM files 
         WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0
         ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows;
    }
  },

  /**
   * Search files
   */
  async search(userId: string, searchTerm: string): Promise<File[]> {
    const term = `%${searchTerm}%`;
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = ? AND is_deleted = 0 
       AND (filename LIKE ? OR original_filename LIKE ?)
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId, term, term]
    );
    return result.rows;
  },

  /**
   * Get starred files
   */
  async getStarred(userId: string): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = ? AND is_starred = 1 AND is_deleted = 0
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Get recent files
   */
  async getRecent(userId: string, limit: number = 10): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = ? AND is_deleted = 0
       ORDER BY last_accessed_at DESC, created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return result.rows;
  },

  /**
   * Update file
   */
  async update(fileId: string, userId: string, data: Partial<File>): Promise<File | null> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        // Convert boolean to integer
        if (typeof value === 'boolean') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return null;

    fields.push("updated_at = datetime('now')");
    values.push(fileId, userId);
    
    const result = await query<File>(
      `UPDATE files SET ${fields.join(', ')}
       WHERE id = ? AND user_id = ?
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Soft delete file
   */
  async softDelete(fileId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE files 
       SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [fileId, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  /**
   * Permanently delete file
   */
  async hardDelete(fileId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM files WHERE id = ? AND user_id = ?',
      [fileId, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  /**
   * Get trash files
   */
  async getTrash(userId: string): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = ? AND is_deleted = 1
       ORDER BY deleted_at DESC`,
      [userId]
    );
    return result.rows;
  },

  /**
   * Restore from trash
   */
  async restore(fileId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE files 
       SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [fileId, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  /**
   * Update last accessed time
   */
  async updateLastAccessed(fileId: string): Promise<void> {
    await query(
      "UPDATE files SET last_accessed_at = datetime('now') WHERE id = ?",
      [fileId]
    );
  }
};

// ============================================
// Folder Operations
// ============================================

export const FolderDB = {
  /**
   * Create a new folder
   */
  async create(data: {
    userId: string;
    name: string;
    parentFolderId?: string;
  }): Promise<Folder> {
    const folderId = uuidv4();
    const result = await query<Folder>(
      `INSERT INTO folders (id, user_id, name, parent_folder_id)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
      [folderId, data.userId, data.name, data.parentFolderId || null]
    );
    return result.rows[0];
  },

  /**
   * Get folder by ID
   */
  async getById(folderId: string, userId: string): Promise<Folder | null> {
    const result = await query<Folder>(
      'SELECT * FROM folders WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [folderId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * List folders
   */
  async listByParent(userId: string, parentFolderId: string | null): Promise<Folder[]> {
    if (parentFolderId) {
      const result = await query<Folder>(
        `SELECT * FROM folders 
         WHERE user_id = ? AND parent_folder_id = ? AND is_deleted = 0
         ORDER BY name ASC`,
        [userId, parentFolderId]
      );
      return result.rows;
    } else {
      const result = await query<Folder>(
        `SELECT * FROM folders 
         WHERE user_id = ? AND parent_folder_id IS NULL AND is_deleted = 0
         ORDER BY name ASC`,
        [userId]
      );
      return result.rows;
    }
  },

  /**
   * Update folder
   */
  async update(folderId: string, userId: string, data: Partial<Folder>): Promise<Folder | null> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        // Convert boolean to integer
        if (typeof value === 'boolean') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return null;

    fields.push("updated_at = datetime('now')");
    values.push(folderId, userId);
    
    const result = await query<Folder>(
      `UPDATE folders SET ${fields.join(', ')}
       WHERE id = ? AND user_id = ?
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Soft delete folder
   */
  async softDelete(folderId: string, userId: string): Promise<boolean> {
    const result = await query(
      `UPDATE folders 
       SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [folderId, userId]
    );
    return (result.rowCount || 0) > 0;
  }
};

// ============================================
// Activity Log Operations
// ============================================

export const ActivityLogDB = {
  /**
   * Log an activity
   */
  async create(data: {
    userId: string;
    fileId?: string;
    folderId?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    const logId = uuidv4();
    await query(
      `INSERT INTO activity_logs (id, user_id, file_id, folder_id, action, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        data.userId,
        data.fileId || null,
        data.folderId || null,
        data.action,
        data.ipAddress || null,
        data.userAgent || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    );
  },

  /**
   * Get recent activity
   */
  async getRecent(userId: string, limit: number = 20): Promise<ActivityLog[]> {
    const result = await query<ActivityLog>(
      `SELECT * FROM activity_logs 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return result.rows;
  }
};

interface DatabaseAdapter {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  close(): Promise<void>;
}

export function getPostgreSQLAdapter(): DatabaseAdapter {
  return {
    async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
      const result = await query<T>(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    },
    async close(): Promise<void> {
      await closePool();
    }
  };
}

export default {
  query,
  getPool,
  closePool,
  getPostgreSQLAdapter,
  UserDB,
  FileDB,
  FolderDB,
  ActivityLogDB
};
