/**
 * Seed the ONE-CITY sample dataset.
 *
 *   npm run seed
 *       Local SQLite: drops server/data/jalsafa.db and re-creates a pristine
 *       demo database (schema + 29 facilities + 5 local bodies + rules + 3
 *       sample tickets). Use before a judging demo.
 *
 *   $env:TURSO_DATABASE_URL="libsql://…"; $env:TURSO_AUTH_TOKEN="…"; npm run seed
 *       Turso: creates the schema and inserts rows ONLY if the tables are
 *       empty — never wipes existing data, so it is safe to run once per DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tursoUrl = process.env.TURSO_DATABASE_URL;

if (tursoUrl) {
  const host = tursoUrl.replace(/^(\w+):\/\//, '').split('/')[0];
  console.log(`Target: Turso (${host}) — seeding only if empty (existing data is never wiped).`);
} else {
  // Drop the local file first so `npm run seed` always yields a pristine demo DB.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.join(here, 'data');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const file = path.join(dataDir, `jalsafa.db${suffix}`);
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  console.log('Target: local SQLite (server/data/jalsafa.db) — dropped + re-seeding.');
}

const { dbReady, client } = await import('./db');
await dbReady;

const facilities = await client.execute('SELECT COUNT(*) AS n FROM facilities');
const tickets = await client.execute('SELECT COUNT(*) AS n FROM tickets');
const bodies = await client.execute('SELECT COUNT(*) AS n FROM local_bodies');
console.log(
  `Seeded: ${facilities.rows[0].n} facilities, ${bodies.rows[0].n} local bodies, ${tickets.rows[0].n} sample tickets.`,
);
client.close();
