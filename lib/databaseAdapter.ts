/**
 * Database Adapter - Supports both PostgreSQL and SQLite
 * Automatically detects which database to use based on DATABASE_URL
 */

interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

interface DatabaseAdapter {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

let adapter: DatabaseAdapter | null = null;

/**
 * Initialize database adapter based on DATABASE_URL
 */
export async function initializeDatabase(): Promise<DatabaseAdapter> {
  if (adapter) {
    return adapter;
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Default to SQLite (everything uses SQLite now)
  // database.ts is now SQLite-based
  const sqliteAdapter = await import('./database');
  adapter = sqliteAdapter.getPostgreSQLAdapter(); // This function returns SQLite adapter
  return adapter;
}

/**
 * Get database adapter
 */
export async function getAdapter(): Promise<DatabaseAdapter> {
  if (!adapter) {
    return initializeDatabase();
  }
  return adapter;
}

/**
 * Execute a query (automatically uses correct adapter)
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const db = await getAdapter();
  return db.query<T>(text, params);
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

