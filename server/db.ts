/**
 * SQLite connection (libsql — prebuilt N-API binaries, no compiler needed),
 * schema creation and first-run seeding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type Client } from '@libsql/client';
import { FACILITIES, LOCAL_BODIES, SEED_TICKETS, WORKFLOW_RULES } from './seed-data';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const dbPath = process.env.JALSAFA_DB_PATH ?? path.join(dataDir, 'jalsafa.db');

// Turso (hosted libSQL) when configured — same SQLite engine, identical SQL
// and schema, just served over the network. Used by the Vercel deployment;
// local development keeps the embedded file when these are unset.
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

// File mode only: create the database directory. Vercel's filesystem is
// read-only outside /tmp, so this must never run when Turso is configured.
if (!tursoUrl) fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const client: Client = tursoUrl
  ? createClient({ url: tursoUrl, authToken: tursoAuthToken })
  : createClient({ url: `file:${dbPath}` });

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS local_bodies (
     id           TEXT PRIMARY KEY,
     name         TEXT NOT NULL,
     jurisdiction TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS facilities (
     id                   TEXT PRIMARY KEY,
     name                 TEXT NOT NULL,
     type                 TEXT NOT NULL CHECK (type IN ('toilet','water')),
     address              TEXT NOT NULL,
     locality             TEXT NOT NULL,
     lat                  REAL NOT NULL,
     lng                  REAL NOT NULL,
     condition            TEXT NOT NULL CHECK (condition IN ('clean','usable','broken','locked','no_water')),
     availability         TEXT NOT NULL CHECK (availability IN ('available','unavailable')),
     open_status          TEXT NOT NULL CHECK (open_status IN ('open','closed','unknown')),
     hours                TEXT,
     wheelchair_accessible INTEGER NOT NULL DEFAULT 0,
     accessible_entrance  INTEGER NOT NULL DEFAULT 0,
     accessible_toilet    INTEGER NOT NULL DEFAULT 0,
     handrails            INTEGER NOT NULL DEFAULT 0,
     baby_changing        INTEGER NOT NULL DEFAULT 0,
     braille_signage      INTEGER NOT NULL DEFAULT 0,
     lighting             INTEGER NOT NULL DEFAULT 0,
     local_body_id        TEXT NOT NULL REFERENCES local_bodies(id),
     last_updated         TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS workflow_rules (
     issue     TEXT PRIMARY KEY,
     priority  TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
     sla_hours INTEGER NOT NULL
   )`,
  // Privacy by design: there is intentionally NO reporter name / phone / email /
  // location column anywhere. Identity cannot leak because it is never stored.
  `CREATE TABLE IF NOT EXISTS tickets (
     id            TEXT PRIMARY KEY,
     facility_id   TEXT NOT NULL REFERENCES facilities(id),
     issue         TEXT NOT NULL,
     description   TEXT NOT NULL DEFAULT '',
     status        TEXT NOT NULL CHECK (status IN ('submitted','assigned','in_progress','resolved')),
     local_body_id TEXT NOT NULL REFERENCES local_bodies(id),
     priority      TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
     sla_hours     INTEGER NOT NULL,
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL
   )`,
  // Prototype accounts (login feature). Deliberately SEPARATE from tickets:
  // an account is never linked to a report, so identity cannot leak into the
  // ticket workflow. Passwords live only as salted scrypt hashes (server/auth.ts).
  `CREATE TABLE IF NOT EXISTS users (
     id            TEXT PRIMARY KEY,
     name          TEXT NOT NULL,
     email         TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at    TEXT NOT NULL
   )`,
];

async function applySchema(): Promise<void> {
  for (const sql of SCHEMA) await client.execute(sql);
}

/** Seed sample data only when the database is empty (idempotent). */
async function seedIfEmpty(): Promise<void> {
  const rs = await client.execute('SELECT COUNT(*) AS n FROM facilities');
  if (Number(rs.rows[0].n) > 0) return;

  const batch = [
    ...LOCAL_BODIES.map((lb) => ({
      sql: 'INSERT INTO local_bodies (id, name, jurisdiction) VALUES (?, ?, ?)',
      args: [lb.id, lb.name, lb.jurisdiction] as (string | number)[],
    })),
    ...FACILITIES.map((f) => ({
      sql: `INSERT INTO facilities (
              id, name, type, address, locality, lat, lng, condition, availability, open_status, hours,
              wheelchair_accessible, accessible_entrance, accessible_toilet, handrails, baby_changing,
              braille_signage, lighting, local_body_id, last_updated
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        f.id, f.name, f.type, f.address, f.locality, f.lat, f.lng, f.condition,
        f.condition === 'clean' || f.condition === 'usable' ? 'available' : 'unavailable',
        f.openStatus, f.hours,
        f.accessibility.wheelchairAccessible ? 1 : 0,
        f.accessibility.accessibleEntrance ? 1 : 0,
        f.accessibility.accessibleToilet ? 1 : 0,
        f.accessibility.handrails ? 1 : 0,
        f.accessibility.babyChanging ? 1 : 0,
        f.accessibility.brailleSignage ? 1 : 0,
        f.accessibility.lighting ? 1 : 0,
        f.localBodyId, f.lastUpdated,
      ] as (string | number)[],
    })),
    ...WORKFLOW_RULES.map((r) => ({
      sql: 'INSERT INTO workflow_rules (issue, priority, sla_hours) VALUES (?, ?, ?)',
      args: [r.issue, r.priority, r.slaHours] as (string | number)[],
    })),
    ...SEED_TICKETS.map((t) => {
      const facility = FACILITIES.find((f) => f.id === t.facilityId);
      if (!facility) throw new Error(`Seed ticket references unknown facility ${t.facilityId}`);
      return {
        sql: `INSERT INTO tickets (id, facility_id, issue, description, status, local_body_id, priority, sla_hours, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [
          t.id, t.facilityId, t.issue, t.description, t.status, facility.localBodyId,
          t.priority, t.slaHours, t.createdAt, t.updatedAt,
        ] as (string | number)[],
      };
    }),
  ];

  await client.batch(batch, 'write');
}

/** Resolves once schema + seed data are ready; awaited by the server entry point. */
export const dbReady: Promise<void> = (async () => {
  await applySchema();
  await seedIfEmpty();
})();
