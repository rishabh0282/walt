/**
 * PostgreSQL Database Connection and Query Utilities
 * Connects to self-hosted PostgreSQL or AWS RDS
 */

import { Pool, QueryResult } from 'pg';

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false // Required for AWS RDS
      } : undefined
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  return pool;
}

/**
 * Execute a query
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', { text, duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
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
  created_at: Date;
  updated_at: Date;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  is_starred: boolean;
  is_deleted: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
  deleted_at: Date | null;
  last_accessed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Share {
  id: string;
  file_id: string | null;
  folder_id: string | null;
  user_id: string;
  share_token: string;
  permission_level: 'viewer' | 'editor';
  password_hash: string | null;
  expires_at: Date | null;
  max_downloads: number | null;
  download_count: number;
  access_count: number;
  is_active: boolean;
  created_at: Date;
  last_accessed_at: Date | null;
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
  created_at: Date;
}

// ============================================
// User Operations
// ============================================

export const UserDB = {
  /**
   * Get or create user by Firebase UID
   */
  async getOrCreate(firebaseUid: string, email: string, displayName?: string): Promise<User> {
    const result = await query<User>(
      `INSERT INTO users (firebase_uid, email, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (firebase_uid) DO UPDATE
       SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
       RETURNING *`,
      [firebaseUid, email, displayName || null]
    );
    return result.rows[0];
  },

  /**
   * Get user by Firebase UID
   */
  async getByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebaseUid]
    );
    return result.rows[0] || null;
  },

  /**
   * Update user storage
   */
  async updateStorage(userId: string, storageUsed: number): Promise<void> {
    await query(
      'UPDATE users SET storage_used = $1, updated_at = NOW() WHERE id = $2',
      [storageUsed, userId]
    );
  },

  /**
   * Get storage stats
   */
  async getStorageStats(userId: string): Promise<{ used: number; limit: number }> {
    const result = await query<{ storage_used: number; storage_limit: number }>(
      'SELECT storage_used, storage_limit FROM users WHERE id = $1',
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
    const result = await query<File>(
      `INSERT INTO files (
        user_id, cid, filename, original_filename, size, mime_type,
        parent_folder_id, is_pinned, pin_service, pin_status
      ) VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.userId,
        data.cid,
        data.filename,
        data.size,
        data.mimeType || null,
        data.parentFolderId || null,
        data.isPinned || false,
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
      'SELECT * FROM files WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE',
      [fileId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * Get file by CID
   */
  async getByCid(cid: string, userId: string): Promise<File | null> {
    const result = await query<File>(
      'SELECT * FROM files WHERE cid = $1 AND user_id = $2 AND is_deleted = FALSE',
      [cid, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * List files in a folder
   */
  async listByFolder(userId: string, folderId: string | null): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = $1 AND parent_folder_id ${folderId ? '= $2' : 'IS NULL'} AND is_deleted = FALSE
       ORDER BY created_at DESC`,
      folderId ? [userId, folderId] : [userId]
    );
    return result.rows;
  },

  /**
   * Search files
   */
  async search(userId: string, searchTerm: string): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = $1 AND is_deleted = FALSE 
       AND (filename ILIKE $2 OR original_filename ILIKE $2)
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId, `%${searchTerm}%`]
    );
    return result.rows;
  },

  /**
   * Get starred files
   */
  async getStarred(userId: string): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files 
       WHERE user_id = $1 AND is_starred = TRUE AND is_deleted = FALSE
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
       WHERE user_id = $1 AND is_deleted = FALSE
       ORDER BY last_accessed_at DESC NULLS LAST, created_at DESC
       LIMIT $2`,
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
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(fileId, userId);
    const result = await query<File>(
      `UPDATE files SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
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
       SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  /**
   * Permanently delete file
   */
  async hardDelete(fileId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM files WHERE id = $1 AND user_id = $2',
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
       WHERE user_id = $1 AND is_deleted = TRUE
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
       SET is_deleted = FALSE, deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  /**
   * Update last accessed time
   */
  async updateLastAccessed(fileId: string): Promise<void> {
    await query(
      'UPDATE files SET last_accessed_at = NOW() WHERE id = $1',
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
    const result = await query<Folder>(
      `INSERT INTO folders (user_id, name, parent_folder_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.userId, data.name, data.parentFolderId || null]
    );
    return result.rows[0];
  },

  /**
   * Get folder by ID
   */
  async getById(folderId: string, userId: string): Promise<Folder | null> {
    const result = await query<Folder>(
      'SELECT * FROM folders WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE',
      [folderId, userId]
    );
    return result.rows[0] || null;
  },

  /**
   * List folders
   */
  async listByParent(userId: string, parentFolderId: string | null): Promise<Folder[]> {
    const result = await query<Folder>(
      `SELECT * FROM folders 
       WHERE user_id = $1 AND parent_folder_id ${parentFolderId ? '= $2' : 'IS NULL'} AND is_deleted = FALSE
       ORDER BY name ASC`,
      parentFolderId ? [userId, parentFolderId] : [userId]
    );
    return result.rows;
  },

  /**
   * Update folder
   */
  async update(folderId: string, userId: string, data: Partial<Folder>): Promise<Folder | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) return null;

    values.push(folderId, userId);
    const result = await query<Folder>(
      `UPDATE folders SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
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
       SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
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
    await query(
      `INSERT INTO activity_logs (user_id, file_id, folder_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
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
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
};

export default {
  query,
  getPool,
  closePool,
  UserDB,
  FileDB,
  FolderDB,
  ActivityLogDB
};


