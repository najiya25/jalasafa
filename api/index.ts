/**
 * Vercel serverless entry point.
 *
 * vercel.json rewrites /api/* → this handler; the static UI (dist/) is served
 * by Vercel's CDN, with any other path falling back to index.html (SPA).
 * It is the exact same Express app as `npm start` — no logic lives here.
 *
 * Database: Turso (hosted libSQL) when TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
 * are set in the Vercel environment; otherwise the local SQLite file (dev).
 * See server/db.ts.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../server/app';
import { dbReady } from '../server/db';

/** The Express app invoked as a plain Node (req, res) handler — how Vercel runs functions. */
const handle = app as unknown as (req: IncomingMessage, res: ServerResponse) => void;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await dbReady; // schema + idempotent seed finished before the first query
  handle(req, res);
}
