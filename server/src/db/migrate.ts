import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PoolClient } from 'pg';

import { logger } from '../utils/logger.js';
import { createMigrationPool } from './pool.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = existsSync(path.join(currentDir, 'migrations'))
  ? path.join(currentDir, 'migrations')
  : path.resolve(currentDir, '../../src/db/migrations');
const migrationPool = createMigrationPool();

interface MigrationRow {
  checksum: string;
}

async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applyMigration(
  client: PoolClient,
  filename: string,
  sql: string,
): Promise<void> {
  const checksum = createHash('sha256').update(sql).digest('hex');

  const existing = await client.query<MigrationRow>(
    'SELECT checksum FROM schema_migrations WHERE filename = $1',
    [filename],
  );

  const applied = existing.rows[0];

  if (applied) {
    if (applied.checksum !== checksum) {
      throw new Error(
        `Checksum mismatch for ${filename}. The file changed after it was applied; create a new migration instead of editing history.`,
      );
    }

    logger.info('Migration already applied', { filename });
    return;
  }

  logger.info('Applying migration', { filename });

  await client.query('BEGIN');

  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
      filename,
      checksum,
    ]);
    await client.query('COMMIT');
    logger.info('Migration applied', { filename });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original failure is the one worth reporting.
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const client = await migrationPool.connect();

  try {
    await ensureLedger(client);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((filename) => filename.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    if (files.length === 0) {
      logger.warn('No migration files found', { directory: MIGRATIONS_DIR });
      return;
    }

    for (const filename of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
      await applyMigration(client, filename, sql);
    }

    logger.info('Database migrations are up to date', { count: files.length });
  } finally {
    client.release();
  }
}

void main()
  .catch((error: unknown) => {
    logger.error('Migration failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void migrationPool.end();
  });
