import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { config } from 'dotenv';

// Load environment
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY id'
  );
  return result.rows.map(row => row.name);
}

async function runMigration(name: string, sql: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (name) VALUES ($1)',
      [name]
    );
    await client.query('COMMIT');
    console.log(`✅ Executed migration: ${name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('🚀 Starting database migration...\n');

  await ensureMigrationTable();
  const executedMigrations = await getExecutedMigrations();

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let migrationsRun = 0;

  for (const file of files) {
    if (executedMigrations.includes(file)) {
      console.log(`⏭️  Skipping (already executed): ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      await runMigration(file, sql);
      migrationsRun++;
    } catch (error) {
      console.error(`❌ Failed migration: ${file}`);
      console.error(error);
      process.exit(1);
    }
  }

  if (migrationsRun === 0) {
    console.log('\n✨ Database is up to date');
  } else {
    console.log(`\n✨ Executed ${migrationsRun} migration(s)`);
  }

  await pool.end();
}

async function rollback() {
  console.log('🔄 Rolling back last migration...\n');

  await ensureMigrationTable();

  const result = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    console.log('No migrations to rollback');
    await pool.end();
    return;
  }

  const lastMigration = result.rows[0]!.name;
  console.log(`Rolling back: ${lastMigration}`);

  // For simplicity, we don't have down migrations - just remove from tracking
  // In production, you'd want proper down migrations
  await pool.query('DELETE FROM schema_migrations WHERE name = $1', [lastMigration]);
  console.log(`⚠️  Removed migration record: ${lastMigration}`);
  console.log('Note: Database changes were NOT reverted. Manual cleanup may be needed.');

  await pool.end();
}

// CLI
const command = process.argv[2];

if (command === 'down') {
  rollback().catch(console.error);
} else {
  migrate().catch(console.error);
}
