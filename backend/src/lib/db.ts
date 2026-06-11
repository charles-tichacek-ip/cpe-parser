import pg from 'pg';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await db.query(sql, params);
  return result.rows;
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const result = await db.query(sql, params);
  return result.rows[0] ?? null;
}
