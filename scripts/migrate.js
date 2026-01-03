import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../app/infrastructure/database/pool.js';
import '../app/infrastructure/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../migrations');

const pool = getPool();

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS applied_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT now()
      )
    `);

    const applied = await client.query(
      'SELECT filename FROM applied_migrations'
    );
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    const files = (await fs.readdir(migrationsDir))
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = await fs.readFile(
        path.join(migrationsDir, file),
        'utf-8'
      );

      console.log(`Applying migration: ${file}`);
      await client.query(sql);
      await client.query(
        'INSERT INTO applied_migrations (filename) VALUES ($1)',
        [file]
      );
    }

    await client.query('COMMIT');
    console.log('Migrations applied successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
