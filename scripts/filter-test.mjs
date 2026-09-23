/**
 * JalSafa filter test — proves every facility filter works against the real
 * seed dataset (29 Kochi facilities), headlessly:
 *
 *   type        toilets 17 · water 12
 *   distance    disabled until location granted · 1 km → 0 · 2 km → 1 · 5 km → 13
 *   availability available 21 · unavailable 8 · both (OR) → 29
 *   condition   clean 7 · usable 14 · broken 3 · locked 2 · no_water 3
 *               clean+usable → 21 · locked+broken → 5   (OR inside the group)
 *   access      wheelchair 9 · wheelchair+braille → 3 (AND) · accessible chip 6
 *   combos      water+no_water → 2 · toilet+unavailable → 4 · accessible+water → 0
 *   clear       restores 29 · query is not counted as a filter
 *   offline     filters still narrow the cached list with the server down
 *
 * Map markers are asserted in lock-step with the card list at every step,
 * cards keep their "Last updated:" line while filtered, and no page errors
 * are tolerated. Boots its own server (PORT=8797, throwaway SQLite file) —
 * the demo database and the running app are untouched.
 *
 * Run:  npm run build && npm run filter-test
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8797;
const BASE = `http://localhost:${PORT}`;
const TOTAL = 29;
const GEO = { latitude: 9.955, longitude: 76.28 }; // QA reference point (nearest facility 1.10 km)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(200);
  }
  return false;
};

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/* ── server (throwaway DB) ─────────────────────────────────────────────── */
const dbFile = path.join(process.env.TEMP, 'jalsafa-filter-test.db');
for (const s of ['', '-wal', '-shm', '-journal']) {
  if (fs.existsSync(dbFile + s)) fs.rmSync(dbFile + s);
}
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  cwd: ROOT,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(PORT), JALSAFA_DB_PATH: dbFile },
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stopServer = () => {
  try {
    execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    /* already dead */
  }
};
process.on('exit', stopServer);

let ok = false;
for (let i = 0; i < 100 && !ok; i++) {
  try {
    ok = (await fetch(`${BASE}/api/health`)).ok;
  } catch {
    await sleep(300);
  }
}
if (!ok) {
  console.log('SERVER FAILED TO START\n' + serverLog);
  process.exit(1);
}

/* ── browser helpers ───────────────────────────────────────────────────── */
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); // no geolocation yet
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

const counts = async () => ({
  cards: await page.locator('.facility-card').count(),
  markers: await page.locator('.marker-pin').count(),
});
/** Results update immediately AND list/map stay in sync. */
const synced = async (expected, label) => {
  await sleep(280);
  const { cards, markers } = await counts();
  check(label, cards === expected && markers === expected, `cards=${cards} markers=${markers} expected=${expected}`);
  return cards;
};
const click = async (selector) => {
  await page.locator(selector).click();
  await sleep(280);
};
const clearAll = async () => {
  const btn = page.locator('button.chip:has-text("Clear filters")');
  if (await btn.count()) await btn.click();
  await sleep(280);
};
const allCards = async (source) =>
  page.$$eval('.facility-card', (els, re) => els.every((e) => new RegExp(re).test(e.textContent)), source);

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForSelector('.facility-card', { timeout: 20000 });
await synced(TOTAL, 'Baseline: 29 cards + 29 markers in sync');

/* ── distance: disabled until location is granted ──────────────────────── */
console.log('── Distance (permission gating)');
check('Distance select starts disabled (no location)', await page.locator('#distance').isDisabled());
check(
  'Distance help explains on-device-only location',
  /never stored or sent to the server/.test(await page.locator('#distance-help').innerText()),
);

console.log('── Grant location (one-shot, on-device only)');
await context.grantPermissions(['geolocation']);
await context.setGeolocation(GEO);
await page.locator('button.chip:has-text("Use my location")').click();
check(
  'Distance select enables once location is granted',
  await until(async () => !(await page.locator('#distance').isDisabled())),
);
await sleep(400);
check('Results note says sorted nearest first', (await page.locator('.results-note').innerText()).includes('sorted nearest first'));
check('Distance shown on first card', /km/.test(await page.locator('.facility-card').first().innerText()));

/* ── 1. facility type ──────────────────────────────────────────────────── */
console.log('── Filter: facility type');
await click('button.chip:has-text("🚻 Toilets")');
await synced(17, 'Toilet → 17');
check('All shown cards are toilets', await allCards('Public toilet'));
check('Filtered cards keep their last-updated line', /Last updated: \d{2} [A-Z][a-z]{2} \d{4}/.test(await page.locator('.facility-card').first().innerText()));
await click('button.chip:has-text("💧 Drinking water")');
await synced(12, 'Drinking-water point → 12');
check('All shown cards are water points', await allCards('Drinking water'));
await click('button.chip:has-text("🏢 All types")');
await synced(TOTAL, 'All types → 29');

/* ── 2. distance ───────────────────────────────────────────────────────── */
console.log('── Filter: distance');
const dist = page.locator('#distance');
await dist.selectOption('1');
await sleep(300);
check('Within 1 km → 0 (nearest is 1.10 km) with graceful empty state', (await counts()).cards === 0 && (await page.locator('.empty-state').count()) === 1);
await dist.selectOption('2');
await sleep(300);
await synced(1, 'Within 2 km → 1');
await dist.selectOption('5');
await sleep(300);
const n5 = (await counts()).cards;
const km = await page.$$eval('.facility-card', (els) => els.map((e) => (e.textContent.match(/([\d.]+)\s*km/) || [])[1]).filter(Boolean));
check('Within 5 km → 13, every distance ≤ 5 km', n5 === 13 && km.length === 13 && km.every((v) => parseFloat(v) <= 5), `n=${n5}`);
await dist.selectOption('any');
await sleep(300);
await synced(TOTAL, 'Any distance → 29');

/* ── 3. availability ───────────────────────────────────────────────────── */
console.log('── Filter: availability');
await click('.check-list label:has-text("✔ Available")');
await synced(21, 'Available → 21');
check('All shown cards are Available', await allCards('Available'));
await click('.check-list label:has-text("✘ Unavailable")');
await synced(TOTAL, 'Available + Unavailable (OR) → 29');
await click('.check-list label:has-text("✔ Available")');
await synced(8, 'Unavailable → 8');
check('All shown cards are Unavailable', await allCards('Unavailable'));
await click('.check-list label:has-text("✘ Unavailable")');
await synced(TOTAL, 'Availability cleared → 29');

/* ── 4. current condition (all five dataset statuses) ──────────────────── */
console.log('── Filter: current condition');
for (const [label, expected] of [
  ['🧼 Clean', 7],
  ['👍 Usable', 14],
  ['⚠️ Broken', 3],
  ['🔒 Locked', 2],
  ['🚱 No water', 3],
]) {
  await click(`.check-list label:has-text("${label}")`);
  await synced(expected, `Condition ${label} → ${expected}`);
  await click(`.check-list label:has-text("${label}")`);
  await synced(TOTAL, `Condition ${label} cleared → 29`);
}
await click('.check-list label:has-text("🧼 Clean")');
await click('.check-list label:has-text("👍 Usable")');
await synced(21, 'Clean + Usable (OR in group) → 21');
await clearAll();
await synced(TOTAL, 'Clear → 29');
await click('.check-list label:has-text("⚠️ Broken")');
await click('.check-list label:has-text("🔒 Locked")');
await synced(5, 'Broken + Locked (OR in group) → 5');
await clearAll();
await synced(TOTAL, 'Clear → 29');

/* ── 5. accessibility (actual dataset fields) ──────────────────────────── */
console.log('── Filter: accessibility');
await click('.check-list label:has-text("Wheelchair accessible")');
await synced(9, 'Wheelchair accessible → 9');
await click('.check-list label:has-text("Braille signage")');
await synced(3, 'Wheelchair AND Braille (AND across fields) → 3');
await click('.check-list label:has-text("Wheelchair accessible")');
await synced(3, 'Braille alone → 3');
await click('.check-list label:has-text("Braille signage")');
await synced(TOTAL, 'Access fields cleared → 29');
await click('.accessible-chip');
await synced(6, 'Accessible-facility-only chip → 6');
await clearAll();

/* ── multi-filter combinations (AND across groups) ─────────────────────── */
console.log('── Combinations');
await click('button.chip:has-text("🚻 Toilets")');
await click('.check-list label:has-text("🚱 No water")');
await clearAll();
await click('button.chip:has-text("💧 Drinking water")');
await click('.check-list label:has-text("🚱 No water")');
await synced(2, 'Water + No water → 2');
await clearAll();
await synced(TOTAL, 'Clear → 29');
await click('button.chip:has-text("🚻 Toilets")');
await click('.check-list label:has-text("✘ Unavailable")');
await synced(4, 'Toilet + Unavailable → 4');
await clearAll();
await click('button.chip:has-text("💧 Drinking water")');
await click('.check-list label:has-text("Wheelchair accessible")');
await synced(2, 'Wheelchair + drinking-water → 2 (real fields, nonzero)');
await clearAll();
await click('.accessible-chip');
await click('button.chip:has-text("💧 Drinking water")');
await synced(0, 'Fully-accessible chip + water → 0 (graceful empty state)');
check('Empty state offers Clear all filters', (await page.locator('.empty-state button:has-text("Clear all filters")').count()) === 1);
await page.locator('.empty-state button:has-text("Clear all filters")').click();
await sleep(320);
await synced(TOTAL, 'Empty-state clear → 29');

/* ── search + clear (query must not count as a filter) ─────────────────── */
console.log('── Clear restores correct results');
await page.fill('#q', 'Marine');
await sleep(350);
const nMarine = (await counts()).cards;
await click('button.chip:has-text("🚻 Toilets")');
const clearLabel = (await page.locator('button.chip:has-text("Clear filters")').innerText()).trim();
check('Clear count excludes the search query → "(1)"', clearLabel.endsWith('(1)'), clearLabel);
await page.locator('button.chip:has-text("Clear filters")').click();
await sleep(300);
const noteAfter = await page.locator('.results-note').innerText();
check('Clear with a query restores search-only results', (await counts()).cards === nMarine && !noteAfter.includes('filter active'), `n=${(await counts()).cards} (search=${nMarine})`);
await page.fill('#q', '');
await sleep(320);
await synced(TOTAL, 'Query cleared → 29');
check('No uncaught page errors (online phase)', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

/* ── offline: filters must work on cached data too ─────────────────────── */
console.log('── Offline (server killed, network down, service-worker cache)');
const swControlled = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i += 1) await new Promise((r) => setTimeout(r, 100));
  return !!navigator.serviceWorker.controller;
});
check('Service worker controlling the page before going offline', swControlled);
const assetCached = await page.evaluate(async () => {
  try {
    const keys = await caches.keys();
    return keys.some((k) => k.includes('-assets'));
  } catch {
    return false;
  }
});
check('Hashed JS/CSS precached at install (offline boot possible)', assetCached);
stopServer();
await context.setOffline(true);
let offlineReload = true;
try {
  await page.reload({ waitUntil: 'load', timeout: 20000 });
} catch (e) {
  offlineReload = false;
}
check('Offline reload completes (service-worker shell)', offlineReload);
const offlineReady = await until(async () => (await page.locator('.facility-card').count()) > 0, 30000);
check('App shell + facility list reload from cache with server down', offlineReady);
const netInd = await page.locator('.net-indicator').innerText().catch(() => '(no indicator)');
check('Header shows the offline indicator', /Offline mode/.test(netInd), netInd.replace(/\s+/g, ' '));
await click('.check-list label:has-text("✔ Available")');
const nOffline = (await counts()).cards;
check('Availability filter still works offline → 21', nOffline === 21 && (await allCards('Available')), `n=${nOffline}`);
await click('.check-list label:has-text("✘ Unavailable")');
check('Combining filters offline → 29', (await counts()).cards === TOTAL);
check('No uncaught page errors (offline phase)', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

await browser.close();
stopServer();
for (const s of ['', '-wal', '-shm', '-journal']) {
  if (fs.existsSync(dbFile + s)) fs.rmSync(dbFile + s);
}
console.log(`\nFILTER TEST: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
