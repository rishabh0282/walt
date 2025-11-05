/**
 * SQLite Database Adapter
 * Converts PostgreSQL-style queries to SQLite-compatible queries
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

interface DatabaseAdapter {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

let db: Database.Database | null = null;

/**
 * Get SQLite database connection
 */
function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  
  // Extract file path from sqlite:// or file:// URL
  let filePath = databaseUrl;
  if (filePath.startsWith('sqlite://')) {
    filePath = filePath.replace('sqlite://', '');
  } else if (filePath.startsWith('file:')) {
    filePath = filePath.replace('file:', '');
  }

  // Remove leading slash if present
  if (filePath.startsWith('/')) {
    filePath = filePath.substring(1);
  }

  db = new Database(filePath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  return db;
}

/**
 * Convert PostgreSQL query to SQLite-compatible query
 */
function convertQuery(text: string, params?: any[]): { sql: string; params: any[] } {
  let sql = text;
  const convertedParams: any[] = [];

  // Replace PostgreSQL UUID generation with JavaScript UUID
  if (sql.includes('gen_random_uuid()')) {
    sql = sql.replace(/gen_random_uuid\(\)/g, '?');
    convertedParams.push(uuidv4());
  }

  // Replace NOW() with SQLite datetime('now')
  sql = sql.replace(/NOW\(\)/gi, "datetime('now')");

  // Replace RETURNING clause (SQLite supports it, but we handle it differently)
  const returningMatch = sql.match(/RETURNING\s+\*\s*$/i);
  if (returningMatch) {
    // SQLite supports RETURNING, so we can keep it
    // But we'll need to handle it in the query execution
  }

  // Replace ON CONFLICT with SQLite's INSERT OR REPLACE or INSERT ... ON CONFLICT
  if (sql.includes('ON CONFLICT')) {
    // SQLite supports ON CONFLICT, so we can keep it
    // But syntax might need adjustment
    sql = sql.replace(/ON CONFLICT\s+\(([^)]+)\)\s+DO UPDATE/gi, 'ON CONFLICT($1) DO UPDATE');
  }

  // Replace $1, $2, etc. with ? (SQLite uses ? placeholders)
  let paramIndex = 1;
  const paramMap = new Map<number, any>();
  
  // First, collect all parameters
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

  // Handle JSONB - SQLite stores JSON as TEXT
  // We'll need to stringify/parse JSON values
  convertedParams.forEach((param, index) => {
    if (param && typeof param === 'object' && !Array.isArray(param)) {
      convertedParams[index] = JSON.stringify(param);
    }
  });

  return { sql, params: convertedParams };
}

/**
 * SQLite adapter implementation
 */
export function getSQLiteAdapter(): DatabaseAdapter {
  return {
    async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
      const database = getDatabase();
      const { sql, params: convertedParams } = convertQuery(text, params);
      
      try {
        // Check if it's a SELECT query
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
        
        if (isSelect) {
          const stmt = database.prepare(sql);
          const rows = stmt.all(...convertedParams) as T[];
          return {
            rows,
            rowCount: rows.length
          };
        } else {
          // INSERT, UPDATE, DELETE
          const stmt = database.prepare(sql);
          const result = stmt.run(...convertedParams);
          
          // If query has RETURNING, we need to fetch the row
          if (sql.toUpperCase().includes('RETURNING')) {
            // SQLite doesn't support RETURNING in all contexts
            // So we'll need to fetch the last inserted row
            if (result.lastInsertRowid) {
              const selectStmt = database.prepare(`SELECT * FROM ${getTableName(sql)} WHERE rowid = ?`);
              const rows = selectStmt.all(result.lastInsertRowid) as T[];
              return {
                rows: rows.length > 0 ? rows : [],
                rowCount: result.changes || 0
              };
            }
          }
          
          return {
            rows: [],
            rowCount: result.changes || 0
          };
        }
      } catch (error) {
        console.error('SQLite query error:', error);
        console.error('SQL:', sql);
        console.error('Params:', convertedParams);
        throw error;
      }
    },

    async close(): Promise<void> {
      if (db) {
        db.close();
        db = null;
      }
    }
  };
}

/**
 * Extract table name from SQL query (for RETURNING clause handling)
 */
function getTableName(sql: string): string {
  const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (insertMatch) return insertMatch[1];
  
  const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (updateMatch) return updateMatch[1];
  
  return 'unknown';
}

