import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../src/infrastructure/db/pool.js';
import '../src/infrastructure/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../migrations');

const pool = getPool();

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(`
      SELECT filename FROM applied_migrations
      ORDER BY applied_at DESC
      LIMIT 1
    `);

    if (!res.rowCount) {
      console.log('No migrations to rollback');
      return;
    }

    const filename = res.rows[0].filename;
    const rollbackFile = filename.replace('.sql', '.down.sql');

    const sql = await fs.readFile(
      path.join(migrationsDir, rollbackFile),
      'utf-8'
    );

    console.log(`Rollback migration: ${filename}`);
    await client.query(sql);
    await client.query(
      'DELETE FROM applied_migrations WHERE filename = $1',
      [filename]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

run().catch(console.error);
