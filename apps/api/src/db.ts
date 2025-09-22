import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL ?? 'postgres://localhost:5432/flstudio';

export const pool = new Pool({ connectionString });

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
