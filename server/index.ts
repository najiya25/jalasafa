/**
 * JalSafa server — LOCAL entry point (the Express app itself lives in app.ts).
 *
 * Run dev:  npm run dev:api  (tsx watch, port 8787, proxied by Vite)
 * Run prod: npm run build && npm start  (same process serves UI + API)
 *
 * On Vercel there is no `listen`: api/index.ts exports the same app instead.
 */
import fs from 'node:fs';
import app, { distDir } from './app';
import { client, dbReady } from './db';

const PORT = Number(process.env.PORT ?? 8787);

await dbReady;
app.listen(PORT, () => {
  console.log(`JalSafa API listening on http://localhost:${PORT}`);
  console.log(`  UI: ${fs.existsSync(distDir) ? `served from ${distDir}` : 'not built (use npm run dev)'}`);
  console.log('  Routing workflow: SIMULATED (demo) — no live government API connected.');
});

process.on('SIGINT', () => {
  client.close();
  process.exit(0);
});
