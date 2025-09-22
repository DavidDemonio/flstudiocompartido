import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db';

type Migration = {
  id: string;
  sql: string;
};

async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.resolve(process.cwd(), 'apps/api/migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  return files.map((filename) => ({
    id: filename,
    sql: fs.readFileSync(path.join(migrationsDir, filename), 'utf8'),
  }));
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function hasMigration(id: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>('SELECT id FROM schema_migrations WHERE id = $1', [id]);
  return Boolean(result.rows[0]);
}

async function run() {
  await ensureTable();
  const migrations = await loadMigrations();

  for (const migration of migrations) {
    if (await hasMigration(migration.id)) {
      continue;
    }
    console.log(`Running migration ${migration.id}`);
    await pool.query(migration.sql);
    await pool.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
  }

  await pool.end();
  console.log('Migrations complete');
}

run().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
