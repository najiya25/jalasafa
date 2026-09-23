/**
 * JalSafa end-to-end QA harness (hackathon judging flow).
 *
 * Covers the 19 test areas:
 *   1 map loading · 2 facility markers · 3 nearby search · 4 filters
 *   5 accessibility info · 6 condition info · 7 last-updated timestamp
 *   8 offline/cached mode · 9 report submission · 10 ticket generation
 *   11 local-body routing · 12 ticket status · 13 mobile responsiveness
 *   14 accessibility · 15 privacy · 16 build/deployment
 *   17 prototype account (guest/sign-up/sign-in) · 18 language switcher
 *   19 facilities along my route (simulated corridor)
 *
 * It boots its own production server (PORT=8791, throwaway SQLite file),
 * drives a real headless Chromium through the full judging flow, kills the
 * server mid-run to prove offline mode, then reports PASS/FAIL per area.
 *
 * Run:  npm run build && npm run qa
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8791;
const BASE = `http://localhost:${PORT}`;

/* ── tiny test harness ─────────────────────────────────────────────────── */
const results = [];
let server = null;
let serverLog = '';

function section(title) {
  console.log(`\n── ${title}`);
}
function check(item, name, ok, detail = '') {
  const r = { item, name, ok: Boolean(ok), detail };
  results.push(r);
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'} [${String(item).padStart(2)}] ${name}${detail ? ` — ${detail}` : ''}`);
  return r.ok;
}
function failSilent(item, name, detail) {
  return check(item, name, false, detail);
}

/* ── server lifecycle ──────────────────────────────────────────────────── */
function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const pids = new Set(
      out
        .split('\n')
        .filter((l) => l.includes('LISTENING'))
        .map((l) => l.trim().split(/\s+/).pop())
        .filter(Boolean),
    );
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

function startServer(dbFile) {
  server = spawn('npx', ['tsx', 'server/index.ts'], {
    cwd: ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), JALSAFA_DB_PATH: dbFile },
  });
  server.stdout.on('data', (d) => (serverLog += d.toString()));
  server.stderr.on('data', (d) => (serverLog += d.toString()));
}

async function waitHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function stopServer() {
  if (server?.pid) {
    try {
      execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      /* already dead */
    }
  }
  server = null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parse "⌖ 1.2 km" / "⌖ 450 m" into km. */
function distKm(text) {
  const m = (text || '').match(/([\d.]+)\s*(km|m)/);
  if (!m) return null;
  const v = Number.parseFloat(m[1]);
  return m[2] === 'm' ? v / 1000 : v;
}

/* ── main ──────────────────────────────────────────────────────────────── */
let browser;
const pageErrors = [];
const consoleErrors = [];
let TOTAL = 0;

async function main() {
  // Fresh throwaway database so runs are repeatable.
  const dbFile = path.join(os.tmpdir(), `jalsafa-qa-${Date.now()}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(dbFile + suffix);
    } catch {
      /* fresh anyway */
    }
  }

  killPort(PORT);
  startServer(dbFile);
  if (!(await waitHealth())) {
    throw new Error(`QA server never became healthy.\n--- server log ---\n${serverLog.slice(-3000)}`);
  }
  TOTAL = (await (await fetch(`${BASE}/api/facilities`)).json()).length;
  const bodies = await (await fetch(`${BASE}/api/local-bodies`)).json();
  const kmcName = bodies.find((b) => b.id === 'kmc')?.name ?? 'Kochi Municipal Corporation';
  const kalName = bodies.find((b) => b.id === 'kalamassery-mun')?.name ?? 'Kalamassery Municipality';

  browser = await chromium.launch();

  /* ══════════ Desktop context (no location permission) ══════════ */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  let tilesOk = 0;
  let tilesTotal = 0;
  page.on('response', (r) => {
    if (r.url().includes('tile.openstreetmap.org')) {
      tilesTotal += 1;
      if (r.status() === 200) tilesOk += 1;
    }
  });
  const apiRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiRequests.push(`${r.url()} ${r.postData() ?? ''}`);
  });

  /* ── 1 · 2 · 16: map, markers, built app served ── */
  section('1 · Map loading / 2 · Facility markers / 16 · Build & deploy');
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  await page.waitForSelector('.marker-pin', { timeout: 15000 });
  await page.waitForSelector('.leaflet-tile-loaded', { timeout: 20000 }).catch(() => {}); // OSM can be slow/rate-limited
  await sleep(500); // let remaining tile responses land

  check(1, 'Leaflet map container renders', (await page.locator('.map.leaflet-container').count()) === 1);
  check(1, 'OSM tiles load over HTTP 200', tilesOk >= 1, `${tilesOk}/${tilesTotal} tile responses ok`);
  check(1, 'Tile images decoded into the DOM', (await page.locator('.leaflet-tile-loaded').count()) > 0);

  const markers = await page.locator('.marker-pin').count();
  const toilets = await page.locator('.marker-pin.toilet').count();
  const waters = await page.locator('.marker-pin.water').count();
  check(2, `All ${TOTAL} facility markers present`, markers === TOTAL, `${markers} markers`);
  check(2, 'Distinct toilet vs drinking-water pins', toilets > 0 && waters > 0 && toilets + waters === markers, `toilets=${toilets} water=${waters}`);
  const g1 = await page.locator('.marker-pin.toilet').first().innerText();
  const g2 = await page.locator('.marker-pin.water').first().innerText();
  check(2, 'Toilet pin shows 🚻, water pin shows 💧', g1.includes('🚻') && g2.includes('💧'));

  // Demo-readiness: the DEFAULT home screen must show every facility as-is.
  const defaultCards = await page.locator('.facility-card').count();
  const defaultNote = await page.locator('.results-note').innerText();
  const accPressedDefault = await page.getAttribute('.accessible-chip', 'aria-pressed');
  check(
    1,
    'Default home lists all facilities with no restrictive filter active',
    defaultCards === TOTAL && !defaultNote.includes('filter active') && accPressedDefault === 'false',
    `${defaultCards}/${TOTAL} cards, note: "${defaultNote.replace(/\s+/g, ' ').slice(0, 60)}"`,
  );

  const html = await (await fetch(`${BASE}/`)).text();
  const asset = (html.match(/src="(\/assets\/[^"]+\.js)"/) || [])[1];
  const cssAsset = (html.match(/href="(\/assets\/[^"]+\.css)"/) || [])[1];
  const assetOk = asset ? (await fetch(`${BASE}${asset}`)).status === 200 : false;
  check(16, 'npm start serves built SPA + hashed JS bundle', html.includes('<div id="root">') && assetOk, asset ?? 'no asset tag');
  const cssBody = cssAsset ? await (await fetch(`${BASE}${cssAsset}`)).text() : '';
  check(16, 'Built CSS served and contains :focus-visible', cssBody.includes(':focus-visible'));

  /* ── 14: accessibility (home) ── */
  section('14 · Accessibility');
  await page.keyboard.press('Tab');
  const firstStop = await page.evaluate(() => (document.activeElement?.textContent || '').trim());
  check(14, 'Skip link is the first keyboard tab stop', firstStop === 'Skip to main content', firstStop);

  const landmarks = await page.evaluate(() => ({
    header: !!document.querySelector('header'),
    nav: !!document.querySelector('nav[aria-label]'),
    main: !!document.querySelector('main'),
    footer: !!document.querySelector('footer'),
    h1: document.querySelectorAll('h1').length,
    lang: document.documentElement.lang === 'en',
  }));
  check(14, 'Semantic landmarks + lang + exactly one h1', Object.values(landmarks).every((v) => v === true || v === 1), JSON.stringify(landmarks));

  const unnamed = await page.evaluate(() => {
    const els = [...document.querySelectorAll('input,select,textarea,button,a[href]')];
    return els
      .filter((el) => {
        const text = (el.innerText || el.value || '').trim();
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
        const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        const wrapping = el.closest('label');
        const placeholder = el.getAttribute('placeholder');
        return !(text || aria || labelFor || wrapping || placeholder);
      })
      .map((el) => el.outerHTML.slice(0, 100));
  });
  check(14, 'Every control & link has an accessible name', unnamed.length === 0, unnamed.join(' | '));

  check(14, 'Results count region is aria-live', (await page.getAttribute('.results-note', 'aria-live')) === 'polite');
  check(14, 'Map has role=application + aria-label', (await page.getAttribute('.map', 'aria-label'))?.includes('Kochi'));

  await page.locator('.contrast-btn').click();
  const contrastState = await page.evaluate(() => ({
    pressed: document.querySelector('.contrast-btn')?.getAttribute('aria-pressed'),
    data: document.documentElement.dataset.contrast,
    amber: getComputedStyle(document.documentElement).getPropertyValue('--amber').trim(),
  }));
  check(14, 'High-contrast toggle works (aria-pressed + data attr + real var change)', contrastState.pressed === 'true' && contrastState.data === 'high' && contrastState.amber === '#000000', JSON.stringify(contrastState));
  await page.locator('.contrast-btn').click();

  const badgesIconText = await page.$$eval('.facility-card .badge', (els) =>
    els.every((b) => {
      const t = (b.textContent || '').trim();
      return t.length > 2 && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t);
    }),
  );
  check(14, 'Status badges pair an icon with text (never colour alone)', badgesIconText);

  /* ── 4: markers & cards are actually interactive ── */
  section('4 · Map markers & facility cards');
  // Real click event dispatched on the pin; it bubbles to Leaflet's marker
  // handler exactly like a user click (adjacent pins may overlap, which would
  // otherwise make raw hit-testing click the neighbour instead).
  await page.locator('.marker-pin').first().dispatchEvent('click');
  await sleep(400);
  check(4, 'Clicking a map marker selects it (action strip appears)', (await page.locator('.selected-strip').count()) === 1);
  await page.locator('.facility-card a:has-text("View details")').first().click();
  await page.waitForURL('**/facility/**', { timeout: 8000 });
  check(4, 'Card "View details" opens the facility detail page', /\/facility\//.test(page.url()), page.url().replace(BASE, ''));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('.facility-card', { timeout: 15000 });

  /* ── 3 (part 1): search ── */
  section('3 · Search / nearby');
  await page.fill('#q', 'Marine Drive');
  await sleep(350);
  const searchCount = await page.locator('.facility-card').count();
  const allMatch = await page.$$eval('.facility-card', (els, q) => els.every((e) => e.textContent.includes(q)), 'Marine Drive');
  check(3, 'Text search narrows the results', searchCount > 0 && searchCount < TOTAL, `${searchCount} of ${TOTAL}`);
  check(3, 'Every result actually matches the query', allMatch);
  await page.fill('#q', '');
  await sleep(300);

  /* ── 4: filters (combinable) ── */
  section('4 · Filters');
  check(4, 'Distance filter disabled until location is granted', await page.locator('#distance').isDisabled());
  const help = await page.locator('#distance-help').innerText();
  check(4, 'Distance help explains privacy (never stored/sent)', /never stored or sent to the server/.test(help));

  await page.click('button.chip:has-text("🚻 Toilets")');
  await sleep(300);
  const nToilet = await page.locator('.facility-card').count();
  const onlyToilets = await page.$$eval('.facility-card', (els) => els.every((e) => e.textContent.includes('Public toilet')));
  check(4, 'Type filter returns only toilets', onlyToilets && nToilet > 0 && nToilet < TOTAL, `${nToilet} toilets`);
  check(4, 'Map markers follow the filter', (await page.locator('.marker-pin').count()) === nToilet);
  check(4, 'Type filter exposes aria-pressed', (await page.getAttribute('button.chip:has-text("🚻 Toilets")', 'aria-pressed')) === 'true');

  await page.click('.accessible-chip');
  await sleep(300);
  const nAcc = await page.locator('.facility-card').count();
  const accCombo = await page.$$eval('.facility-card', (els) =>
    els.every((e) => e.textContent.includes('Wheelchair') && e.textContent.includes('Public toilet')),
  );
  check(4, 'Accessible-only combines with type filter (AND)', accCombo && nAcc > 0, `${nAcc} accessible toilets`);
  check(4, 'Accessible filter is obvious + aria-pressed', (await page.getAttribute('.accessible-chip', 'aria-pressed')) === 'true');
  await page.click('.accessible-chip'); // off
  await page.click('button.chip:has-text("🏢 All types")');
  await sleep(250);

  await page.locator('.check-list label:has-text("🚱 No water")').click();
  await sleep(300);
  const nNoWater = await page.locator('.facility-card').count();
  const onlyNoWater = await page.$$eval('.facility-card', (els) => els.every((e) => e.textContent.includes('No water')));
  check(4, 'Condition filter (No water) works', onlyNoWater && nNoWater > 0, `${nNoWater} with no water`);

  await page.locator('.check-list label:has-text("Unavailable")').click();
  await sleep(300);
  const nCombo = await page.locator('.facility-card').count();
  const comboOk = await page.$$eval('.facility-card', (els) =>
    els.every((e) => e.textContent.includes('No water') && e.textContent.includes('Unavailable')),
  );
  check(4, 'Condition + availability combine', comboOk && nCombo > 0 && nCombo <= nNoWater, `${nCombo} both`);

  const clearBtn = page.locator('button.chip:has-text("Clear filters")');
  check(4, 'Clear-filters control appears with active count', (await clearBtn.count()) === 1, await clearBtn.innerText().catch(() => ''));
  await clearBtn.click();
  await sleep(300);
  const noteAfterClear = await page.locator('.results-note').innerText();
  check(4, 'Clear restores the full list', (await page.locator('.facility-card').count()) === TOTAL && !noteAfterClear.includes('filter active'));

  // Regression: availability alone, an accessibility field (AND semantics),
  // and clearing while a search query is present (query must not count as a filter).
  await page.locator('.check-list label:has-text("✔ Available")').click();
  await sleep(300);
  const nAvail = await page.locator('.facility-card').count();
  check(4, 'Availability filter alone (Available → 21)', nAvail === 21, `${nAvail} available`);
  await page.locator('.check-list label:has-text("✔ Available")').click();
  await sleep(250);

  await page.locator('.check-list label:has-text("Wheelchair accessible")').click();
  await sleep(300);
  const nWheel = await page.locator('.facility-card').count();
  check(4, 'Accessibility field filter (Wheelchair → 9)', nWheel === 9, `${nWheel} wheelchair-accessible`);
  await page.locator('.check-list label:has-text("Wheelchair accessible")').click();
  await sleep(250);

  await page.fill('#q', 'Marine');
  await sleep(350);
  const nMarine = await page.locator('.facility-card').count();
  await page.click('button.chip:has-text("🚻 Toilets")');
  await sleep(300);
  const clearWithQuery = page.locator('button.chip:has-text("Clear filters")');
  const clearLabel = (await clearWithQuery.innerText()).trim();
  check(4, 'Clear count excludes the search query (query + toilets → "(1)")', clearLabel.endsWith('(1)'), clearLabel);
  await clearWithQuery.click();
  await sleep(300);
  const noteQueryClear = await page.locator('.results-note').innerText();
  const nQueryClear = await page.locator('.facility-card').count();
  check(4, 'Clear with a query restores search-only results', nQueryClear === nMarine && !noteQueryClear.includes('filter active'), `n=${nQueryClear} (search gives ${nMarine})`);
  await page.fill('#q', '');
  await sleep(300);
  check(4, 'Query cleared → full list again', (await page.locator('.facility-card').count()) === TOTAL);

  /* ── 7 (part 1): freshness on a card ── */
  section('5 · Accessibility info / 6 · Condition info / 7 · Last updated');
  const cardFresh = await page.locator('.facility-card .freshness').first().innerText();
  check(7, 'Card shows exact format "Last updated: DD Mon YYYY, H:MM AM/PM"', /Last updated: \d{2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)/.test(cardFresh), cardFresh.replace(/\s+/g, ' ').slice(0, 80));
  const firstCardBadges = await page.locator('.facility-card').first().innerText();
  check(6, 'Card shows condition + availability + open status', /(Clean|Usable|Broken|Locked|No water)/.test(firstCardBadges) && /(Available|Unavailable)/.test(firstCardBadges) && /(Open|Closed|Hours unknown)/.test(firstCardBadges));
  check(6, 'Card shows responsible local body', /Local body/.test(firstCardBadges));
  check(5, 'Card shows accessibility tags or explicit "none"', (await page.locator('.facility-card').first().innerText()).includes('accessibility') || (await page.locator('.access-tag').count()) > 0);

  /* ── 5 · 6 · 7: facility detail (toilet) ── */
  await page.goto(`${BASE}/facility/f07`, { waitUntil: 'load' });
  await page.waitForSelector('.access-table', { timeout: 15000 });
  const detail = await page.locator('main').innerText();
  check(5, 'Accessibility table lists all 7 fields', (await page.locator('.access-table tr').count()) === 7);
  check(5, 'Wheelchair row has icon + text Yes/No', /Wheelchair[\s\S]{0,160}✔\s*Yes|Wheelchair[\s\S]{0,160}Yes/.test(detail));
  check(5, 'Detail page has exactly one h1', (await page.locator('h1').count()) === 1);
  check(6, 'Detail shows condition with icon + text', /Condition: (Clean|Usable|Broken|Locked|No water)/.test(detail) && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}? Condition:/u.test(detail.replace(/\s+/g, ' ')));
  check(6, 'Detail shows responsible local body', detail.includes(kmcName));
  check(6, 'Detail shows opening status + hours', /(Open|Closed|Hours unknown)/.test(detail));
  check(7, 'Detail "Last updated" exact format', /Last updated: \d{2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)/.test(detail));
  check(7, 'Freshness explanation shown under the timestamp', detail.includes('Facility conditions can change at any time'));
  check(15, 'Detail page has privacy note (no reporter identity)', /No reporter name, phone number, email/i.test(detail));

  /* water point → N/A row */
  await page.goto(`${BASE}/facility/f22`, { waitUntil: 'load' });
  await page.waitForSelector('.access-table', { timeout: 15000 });
  const waterDetail = await page.locator('main').innerText();
  check(5, 'Water point marks toilet row as not applicable', waterDetail.includes('Not applicable (water point)'));
  check(6, 'Water point routed to its own local body', waterDetail.includes(kalName));
  check(6, 'Water point still shows condition + freshness', /(No water|Clean|Usable|Broken|Locked)/.test(waterDetail) && /Last updated: \d{2} [A-Z][a-z]{2}/.test(waterDetail));

  /* ── 9 · 10 · 11 · 15: report → ticket ── */
  section('9 · Report submission / 10 · Ticket generation / 11 · Routing / 15 · Privacy');
  await page.goto(`${BASE}/report/f07`, { waitUntil: 'load' });
  await page.waitForSelector('input[name="issue"]', { timeout: 15000 });

  const fields = await page.evaluate(() =>
    [...document.querySelectorAll('input,textarea,select')].map((el) => ({
      type: el.type || el.tagName.toLowerCase(),
      name: el.name || '',
      id: el.id || '',
    })),
  );
  const textFieldTypes = fields.filter((f) => ['text', 'email', 'tel', 'url', 'number'].includes(f.type));
  const identityNamed = fields.filter((f) => /name|phone|email|mobile|reporter|contact/i.test(`${f.name} ${f.id}`) && !/issue/i.test(f.name));
  const locationField = fields.filter((f) => /lat|lng|location|coords|geo/i.test(`${f.name} ${f.id}`));
  check(15, 'Report form: no identity input fields', textFieldTypes.length === 0 && identityNamed.length === 0, JSON.stringify(fields));
  check(15, 'Report form: no location field', locationField.length === 0);
  check(15, 'Report form = issue radio group + optional description only', fields.some((f) => f.name === 'issue') && fields.some((f) => f.id === 'desc'));
  const formPrivacy = await page.locator('.privacy-note').innerText();
  check(15, 'Privacy statement visible before submitting', /No name, phone number or email is asked for/i.test(formPrivacy));
  const reportH1 = await page.locator('h1').innerText();
  check(14, 'Report page has one h1', (await page.locator('h1').count()) === 1, reportH1.replace(/\s+/g, ' '));
  const formUnnamed = await page.evaluate(() =>
    [...document.querySelectorAll('input,textarea')]
      .filter((el) => {
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        return !(aria || labelFor || el.closest('label'));
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  check(14, 'All report-form fields are labelled', formUnnamed.length === 0, formUnnamed.join(' | '));

  // Validation: no issue chosen yet
  await page.locator('button:has-text("Submit report")').click();
  const alertVisible = await page.locator('[role="alert"]').isVisible().catch(() => false);
  const alertText = alertVisible ? await page.locator('[role="alert"]').innerText() : '';
  check(9, 'Submitting without choosing an issue is blocked with a message', alertVisible && /choose/i.test(alertText), alertText.slice(0, 60));

  // Valid submission
  await page.check('input[name="issue"][value="no_water"]');
  await page.fill('#desc', 'QA test: tap near the entrance is dry.');
  await page.locator('button:has-text("Submit report")').click();
  await page.waitForURL('**/ticket/**', { timeout: 15000 });
  const ticketId = page.url().split('/ticket/')[1];
  check(9, 'Report submits online and lands on confirmation screen', /^JS-\d{8}-[A-Z0-9]{4}$/.test(ticketId), ticketId);
  check(10, 'Ticket ID generated (JS-YYYYMMDD-XXXX)', /^JS-\d{8}-[A-Z0-9]{4}$/.test(ticketId));

  // Wait until the confirmation screen has fully rendered before reading text.
  await page.waitForSelector('.stepper li', { timeout: 15000 });
  const ticketText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  check(10, 'Confirmation shows status Submitted', /Status:\s*Submitted/s.test(ticketText));
  check(10, 'Confirmation shows priority + response target', /priority/i.test(ticketText) && /response expected within/i.test(ticketText));
  check(10, 'Confirmation shows submitted time', /\d{2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (AM|PM)/.test(ticketText));
  check(11, 'Ticket routed to the responsible local body', ticketText.includes(kmcName));
  check(11, 'Five-step workflow chain rendered', (await page.locator('.stepper li').count()) === 5);
  check(11, 'Stepper names all five judging steps', ['User report', 'Ticket created', 'local body identified', 'Ticket routed', 'Status'].every((s) => ticketText.toLowerCase().includes(s.toLowerCase())));
  check(15, 'Confirmation states no personal information collected', /No personal information was collected/i.test(ticketText));
  check(14, 'Ticket page has one h1 (the ticket ID)', (await page.locator('h1').count()) === 1);

  // API-level privacy audit
  const postResp = await (
    await fetch(`${BASE}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId: 'f22', issue: 'broken', description: 'api privacy audit' }),
    })
  ).json();
  const leakyKeys = ['name', 'phone', 'email', 'reporter', 'lat', 'lng', 'location', 'coords', 'ip', 'device'].filter((k) => k in (postResp.ticket ?? {}));
  check(15, 'API ticket response carries no identity/location keys', leakyKeys.length === 0, leakyKeys.join(','));
  const advanceResp = await fetch(`${BASE}/api/tickets/${postResp.ticket.id}/advance`, { method: 'PATCH' });
  check(12, 'PATCH /advance works over HTTP', advanceResp.status === 200);

  const storage = await page.evaluate(() => Object.keys({ ...localStorage }));
  const badKeys = storage.filter((k) => /coord|location|geoloc|movement|history|phone|email|reporter/i.test(k));
  check(15, 'localStorage holds no location/identity keys', badKeys.length === 0, `${badKeys.join(',')} | all: ${storage.join(', ')}`);

  const dbSrc = fs.readFileSync(path.join(ROOT, 'server', 'db.ts'), 'utf8');
  const tStart = dbSrc.indexOf('CREATE TABLE IF NOT EXISTS tickets');
  const tBlock = tStart >= 0 ? dbSrc.slice(tStart, dbSrc.indexOf('`', tStart)) : '';
  const schemaLeak = /reporter|phone|email|mobile|latitude|longitude|location|user_name|full_name/i.test(tBlock);
  check(15, 'tickets table schema has no identity/location columns', tStart >= 0 && !schemaLeak);

  /* ── 11 · 12: admin ticket desk ── */
  section('11 · Local-body routing / 12 · Ticket status (demo admin)');
  await page.goto(`${BASE}/admin`, { waitUntil: 'load' });
  await page.waitForSelector('.ticket-card', { timeout: 15000 });
  const ticketCard = page.locator('.ticket-card', { hasText: ticketId });
  check(11, 'New ticket visible on the demo ticket desk', (await ticketCard.count()) === 1);
  check(11, 'Simulated-workflow label displayed', (await page.locator('.pill.sim').count()) >= 1);
  check(11, 'Five-node flow chain diagram present', (await page.locator('.flow-chain .node').count()) === 5);
  check(12, 'Status stats row present (4 statuses)', (await page.locator('.stat').count()) === 4);
  const adminText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  check(15, 'Admin desk states reporter identity & location are never collected', /Reporter identity and location history are never collected/i.test(adminText));
  check(15, 'Admin desk has no reporter-identifying inputs', (await page.locator('input[type="text"], input[type="email"], input[type="tel"]').count()) === 0);

  await ticketCard.scrollIntoViewIfNeeded();
  check(12, 'Ticket starts at status Submitted', (await ticketCard.innerText()).includes('Submitted'));

  await ticketCard.locator('button:has-text("Assign ticket")').click();
  await ticketCard.locator('.badge', { hasText: 'Assigned' }).waitFor({ timeout: 15000 });
  check(12, 'Advance: submitted → assigned', (await ticketCard.innerText()).includes('Assigned'));

  await ticketCard.locator('button:has-text("Start work")').click();
  await ticketCard.locator('.badge', { hasText: 'In progress' }).waitFor({ timeout: 15000 });
  check(12, 'Advance: assigned → in progress', (await ticketCard.innerText()).includes('In progress'));

  await ticketCard.locator('button:has-text("Mark resolved")').click();
  await ticketCard.locator('.badge', { hasText: 'Resolved' }).waitFor({ timeout: 15000 });
  check(12, 'Advance: in progress → resolved (journey complete)', (await ticketCard.innerText()).includes('Journey complete'));

  // Local-body filter
  const bodySelect = page.locator('.admin-filters select').first();
  await bodySelect.selectOption('kmc');
  await sleep(300);
  const kmcCards = await page.locator('.ticket-card').count();
  const allKmc = await page.$$eval('.ticket-card', (els, name) => els.every((e) => e.textContent.includes(name)), kmcName);
  check(11, 'Filter by local body (KMC) shows only its tickets', kmcCards > 0 && allKmc, `${kmcCards} KMC tickets`);
  await bodySelect.selectOption('kakkanad-tp');
  await sleep(300);
  const emptyShown = (await page.locator('.ticket-list .empty-state').count()) > 0;
  check(11, 'Filtering to a body with no tickets shows a clear empty state', emptyShown);
  await bodySelect.selectOption('all');
  await sleep(250);

  const statusSelect = page.locator('.admin-filters select').nth(1);
  await statusSelect.selectOption('resolved');
  await sleep(300);
  const allResolved = await page.$$eval('.ticket-card', (els) => els.every((e) => e.textContent.includes('Resolved')));
  check(12, 'Filter by status works', allResolved && (await page.locator('.ticket-card').count()) > 0);
  await statusSelect.selectOption('all');
  await sleep(250);

  /* ── 17: prototype account (guest / sign up / sign in) ── */
  section('17 · Prototype account (guest · sign up · sign in)');
  const actx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const ap = await actx.newPage();
  ap.on('pageerror', (e) => pageErrors.push(`[auth] ${e}`));

  await ap.goto(`${BASE}/`, { waitUntil: 'load' });
  await ap.waitForSelector('.facility-card', { timeout: 15000 });
  const welcomeShown = await ap.locator('.welcome-bar').isVisible().catch(() => false);
  check(17, 'First visit shows the optional welcome bar (guest / sign in / sign up)', welcomeShown);

  await ap.locator('.welcome-bar button:has-text("Continue as Guest")').click();
  await ap.waitForSelector('.welcome-bar', { state: 'detached', timeout: 8000 }).catch(() => {});
  const guestChip = (await ap.locator('.account-chip').innerText()).replace(/\s+/g, ' ').trim();
  check(
    17,
    'Continue as Guest reaches the finder with a "Guest" account indicator',
    (await ap.locator('.welcome-bar').count()) === 0 && /Guest/.test(guestChip),
    guestChip,
  );

  // Sign-up validation: short password, then mismatch, then a real account.
  await ap.goto(`${BASE}/signup`, { waitUntil: 'load' });
  await ap.waitForSelector('#name', { timeout: 10000 });
  await ap.fill('#name', 'QA Tester');
  await ap.fill('#email', 'qa-check@example.com');
  await ap.fill('#password', 'short');
  await ap.fill('#confirm', 'short');
  await ap.locator('form button[type="submit"]').click();
  const pwErr = await ap.locator('[role="alert"]').innerText().catch(() => '');
  check(17, 'Sign-up validates password length with a friendly message', /at least 8/i.test(pwErr), pwErr.slice(0, 60));

  await ap.fill('#password', 'qa-password-123');
  await ap.fill('#confirm', 'different-password');
  await ap.locator('form button[type="submit"]').click();
  const mmErr = await ap.locator('[role="alert"]').innerText().catch(() => '');
  check(17, 'Sign-up catches a password mismatch', /do not match/i.test(mmErr), mmErr.slice(0, 60));

  await ap.fill('#confirm', 'qa-password-123');
  await ap.locator('form button[type="submit"]').click();
  await ap.waitForURL((u) => u.pathname === '/', { timeout: 15000 }).catch(() => {});
  const signupChip = (await ap.locator('.account-chip').innerText()).replace(/\s+/g, ' ').trim();
  check(17, 'Sign-up lands on the finder with the name shown in the navbar', /QA Tester/.test(signupChip), signupChip);

  await ap.reload({ waitUntil: 'load' });
  await ap.waitForSelector('.account-chip', { timeout: 10000 });
  const reloadedChip = (await ap.locator('.account-chip').innerText()).replace(/\s+/g, ' ').trim();
  check(17, 'Session survives a reload (token re-validated with the server)', /QA Tester/.test(reloadedChip), reloadedChip);

  await ap.locator('button.account-signout').click();
  await sleep(300);
  const outChip = (await ap.locator('.account-chip').innerText()).replace(/\s+/g, ' ').trim();
  check(17, 'Sign out returns to guest browsing', /Guest/.test(outChip), outChip);

  await ap.goto(`${BASE}/signin`, { waitUntil: 'load' });
  await ap.waitForSelector('#email', { timeout: 10000 });
  await ap.fill('#email', 'qa-check@example.com');
  await ap.fill('#password', 'wrong-password-999');
  await ap.locator('form button[type="submit"]').click();
  const badErr = await ap.locator('[role="alert"]').innerText().catch(() => '');
  check(17, 'Wrong password is rejected with a friendly error', /incorrect/i.test(badErr), badErr.slice(0, 60));

  await ap.fill('#password', 'qa-password-123');
  await ap.locator('form button[type="submit"]').click();
  await ap.waitForURL((u) => u.pathname === '/', { timeout: 15000 }).catch(() => {});
  const inChip = (await ap.locator('.account-chip').innerText()).replace(/\s+/g, ' ').trim();
  check(17, 'Correct password signs the user back in', /QA Tester/.test(inChip), inChip);

  await ap.goto(`${BASE}/signup`, { waitUntil: 'load' });
  await ap.waitForSelector('#name', { timeout: 10000 });
  await ap.fill('#name', 'QA Tester');
  await ap.fill('#email', 'qa-check@example.com');
  await ap.fill('#password', 'qa-password-123');
  await ap.fill('#confirm', 'qa-password-123');
  await ap.locator('form button[type="submit"]').click();
  const dupErr = await ap.locator('[role="alert"]').innerText().catch(() => '');
  check(17, 'Duplicate sign-up is rejected with a friendly error', /already registered/i.test(dupErr), dupErr.slice(0, 70));

  // HTTP-level audit: status codes + no password material ever leaves the server.
  const dupResp = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'QA Tester', email: 'qa-check@example.com', password: 'qa-password-123' }),
  });
  check(17, 'Duplicate sign-up rejected over HTTP (409)', dupResp.status === 409, `status=${dupResp.status}`);
  const badLogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa-check@example.com', password: 'definitely-wrong-1' }),
  });
  check(17, 'Wrong credentials rejected over HTTP (401)', badLogin.status === 401, `status=${badLogin.status}`);
  const noTokMe = await fetch(`${BASE}/api/auth/me`);
  check(17, 'GET /api/auth/me without a token is 401', noTokMe.status === 401, `status=${noTokMe.status}`);
  const okLogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa-check@example.com', password: 'qa-password-123' }),
  });
  const okBody = await okLogin.json();
  const userKeys = Object.keys(okBody.user ?? {});
  const bodyText = JSON.stringify(okBody);
  check(
    17,
    'Auth responses carry a token + user, never password material',
    okLogin.status === 200 &&
      typeof okBody.token === 'string' &&
      !bodyText.includes('qa-password-123') &&
      !bodyText.includes('scrypt') &&
      userKeys.every((k) => !/password|hash|salt/i.test(k)),
    `user keys: ${userKeys.join(',') || '(none)'}`,
  );
  await actx.close();

  /* ── 18: language switcher ── */
  section('18 · Language switcher (English · മലയാളം · हिन्दी · தமிழ்)');
  const lctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const lp = await lctx.newPage();
  lp.on('pageerror', (e) => pageErrors.push(`[lang] ${e}`));

  await lp.goto(`${BASE}/`, { waitUntil: 'load' });
  await lp.waitForSelector('.facility-card', { timeout: 15000 });
  const heroEn = await lp.locator('.hero-strip h1').innerText();
  check(
    18,
    'Default UI is English with a 🌐 language switcher in the navbar',
    /Find a usable toilet/.test(heroEn) && (await lp.locator('#lang').count()) === 1,
    heroEn.slice(0, 50),
  );

  await lp.selectOption('#lang', 'ml');
  await sleep(250);
  const heroMl = await lp.locator('.hero-strip h1').innerText();
  const langMl = await lp.evaluate(() => document.documentElement.lang);
  const cardsMl = await lp.locator('.facility-card').count();
  check(
    18,
    'Malayalam applies instantly — html[lang] + translated text, no reload, data intact',
    langMl === 'ml' && heroMl !== heroEn && cardsMl === TOTAL,
    heroMl.slice(0, 40),
  );

  await lp.reload({ waitUntil: 'load' });
  await lp.waitForSelector('.facility-card', { timeout: 15000 });
  const langPersisted = await lp.evaluate(() => document.documentElement.lang);
  check(18, 'Language choice persists after reload (saved locally)', langPersisted === 'ml', langPersisted);

  await lp.selectOption('#lang', 'hi');
  await sleep(250);
  const navHi = (await lp.locator('header nav').innerText()).replace(/\s+/g, ' ');
  const langHi = await lp.evaluate(() => document.documentElement.lang);
  check(18, 'Hindi: navbar + hero translated from the central dictionary', navHi.includes('सुविधाएँ खोजें') && langHi === 'hi', navHi.slice(0, 70));

  await lp.selectOption('#lang', 'ta');
  await sleep(250);
  const heroTa = await lp.locator('.hero-strip h1').innerText();
  check(18, 'Tamil: hero headline translated', heroTa.startsWith('பயணத்திற்கு முன்'), heroTa.slice(0, 40));

  await lp.selectOption('#lang', 'en');
  await sleep(250);
  const heroBack = await lp.locator('.hero-strip h1').innerText();
  const noteBack = await lp.locator('.results-note').innerText();
  const cardsBack = await lp.locator('.facility-card').count();
  check(
    18,
    'Back to English: original strings intact and facility data untouched',
    heroBack === heroEn && /Showing \d+ of \d+ facilities/.test(noteBack) && cardsBack === TOTAL,
    noteBack.replace(/\s+/g, ' ').slice(0, 60),
  );
  await lctx.close();

  /* ── 19: facilities along my route (simulated corridor) ── */
  section('19 · Facilities Along My Route (simulated corridor)');
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const rp = await rctx.newPage();
  rp.on('pageerror', (e) => pageErrors.push(`[route] ${e}`));

  await rp.goto(`${BASE}/route`, { waitUntil: 'load' });
  await rp.waitForSelector('.route-form', { timeout: 15000 });
  await rp.waitForSelector('main .empty-state', { state: 'detached', timeout: 15000 }).catch(() => {});
  const routeH1 = await rp.locator('h1').innerText();
  const simPill = await rp.locator('.route-intro .pill.sim').innerText();
  const explainTxt = await rp.locator('.route-intro').innerText();
  check(
    19,
    'Route page: clear title + SIMULATED label + honest explanation',
    routeH1 === 'Facilities Along My Route' && /SIMULATED/.test(simPill) && /NOT real turn-by-turn navigation/.test(explainTxt),
    `${routeH1} | ${simPill}`,
  );

  await rp.locator('button.route-submit').click();
  const needBoth = await rp.locator('.route-form [role="alert"]').innerText().catch(() => '');
  check(19, 'Empty start/destination → friendly validation error', /both a start location and a destination/.test(needBoth), needBoth.slice(0, 70));

  await rp.fill('#route-start', 'Paris');
  await rp.fill('#route-dest', 'Aluva');
  await rp.locator('button.route-submit').click();
  const unknownErr = await rp.locator('.route-form [role="alert"]').innerText().catch(() => '');
  check(19, 'Unknown place names are rejected and echoed back', /do not know/.test(unknownErr) && unknownErr.includes('Paris'), unknownErr.slice(0, 80));

  await rp.fill('#route-start', 'Kochi');
  await rp.fill('#route-dest', 'Kochi');
  await rp.locator('button.route-submit').click();
  const sameErr = await rp.locator('.route-form [role="alert"]').innerText().catch(() => '');
  check(19, 'Same start and destination rejected', /same place/.test(sameErr), sameErr.slice(0, 70));

  await rp.fill('#route-start', 'Kochi');
  await rp.fill('#route-dest', 'Aluva');
  await rp.locator('button.route-submit').click();
  await rp.waitForSelector('.facility-card', { timeout: 15000 });
  const routeSummary = (await rp.locator('.route-summary .results-note').innerText()).replace(/\s+/g, ' ');
  check(
    19,
    'Summary states count, corridor width and the simulated straight line',
    /facilities within 1 km of the simulated route/.test(routeSummary) && /straight line/.test(routeSummary),
    routeSummary.slice(0, 110),
  );
  const nRoute1 = await rp.locator('.facility-card').count();
  check(19, 'Kochi → Aluva at 1 km returns the expected corridor set', nRoute1 === 7, `${nRoute1} facilities (expected 7)`);
  check(19, 'Dashed simulated corridor drawn on the map', (await rp.locator('path.route-line').count()) >= 1);
  const routeMarkers = await rp.locator('.marker-pin').count();
  check(19, 'Map markers match the listed results', routeMarkers === nRoute1, `markers=${routeMarkers} cards=${nRoute1}`);
  const firstDist = await rp.locator('.facility-card .distance').first().innerText();
  check(19, 'Cards show distance from the route', /from route/.test(firstDist), firstDist);
  const routeDists = (await rp.$$eval('.facility-card .distance', (els) => els.map((e) => e.textContent))).map(distKm);
  const routeSorted = routeDists.every((d, i) => i === 0 || (d != null && routeDists[i - 1] != null && d >= routeDists[i - 1] - 1e-9));
  check(19, 'Results sorted nearest-to-route first', routeDists.every((d) => d != null) && routeSorted, `first=${routeDists[0]}`);
  const detailHref = await rp.locator('.facility-card a:has-text("View details")').first().getAttribute('href');
  check(19, 'Results reuse the existing facility detail page', /^\/facility\//.test(detailHref ?? ''), detailHref);

  await rp.locator('button.chip:has-text("Available only")').click();
  await sleep(350);
  const nAvailRoute = await rp.locator('.facility-card').count();
  const availSummary = await rp.locator('.route-summary .results-note').innerText();
  const availPressed = await rp.getAttribute('button.chip:has-text("Available only")', 'aria-pressed');
  check(
    19,
    '"Available only" narrows the corridor results (aria-pressed, filtered count shown)',
    nAvailRoute > 0 &&
      nAvailRoute < nRoute1 &&
      /Showing \d+ after filters/.test(availSummary) &&
      availPressed === 'true',
    `${nAvailRoute} of ${nRoute1}`,
  );
  await rp.locator('button.chip:has-text("Available only")').click();
  await sleep(300);

  await rp.selectOption('#route-width', '2');
  await sleep(350);
  const nRoute2 = await rp.locator('.facility-card').count();
  check(19, 'Widening the corridor to 2 km adds results', nRoute2 > nRoute1, `${nRoute2} within 2 km (vs ${nRoute1} at 1 km)`);
  await rp.selectOption('#route-width', '1');
  await sleep(300);

  await rp.goto(`${BASE}/route`, { waitUntil: 'load' });
  await rp.waitForSelector('.route-form', { timeout: 15000 });
  await rp.waitForSelector('main .empty-state', { state: 'detached', timeout: 15000 }).catch(() => {});
  await rp.fill('#route-start', 'Aluva');
  await rp.fill('#route-dest', 'Kadamakudy');
  await rp.locator('button.route-submit').click();
  await rp.waitForSelector('.empty-state', { timeout: 15000 });
  const emptyRouteTxt = await rp.locator('.empty-state').innerText();
  check(
    19,
    'Empty corridor shows a clear message + widen action',
    /No facilities are within 1 km of this route/.test(emptyRouteTxt) &&
      (await rp.locator('button:has-text("Search within 2 km")').count()) === 1,
    emptyRouteTxt.replace(/\s+/g, ' ').slice(0, 80),
  );
  await rp.locator('button:has-text("Search within 2 km")').click();
  await sleep(350);
  check(
    19,
    'Widen action re-runs the search and hides itself at 2 km',
    (await rp.locator('.empty-state').count()) >= 1 &&
      (await rp.locator('button:has-text("Search within 2 km")').count()) === 0,
  );
  await rctx.close();

  /* ── 8: offline / cached mode ── */
  section('8 · Offline / cached mode');
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('.facility-card', { timeout: 15000 });
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i += 1) await new Promise((r) => setTimeout(r, 100));
    return !!navigator.serviceWorker.controller;
  });
  check(8, 'Service worker registered and controlling the page', swReady);

  stopServer();
  await ctx.setOffline(true);
  let reloadOk = true;
  try {
    await page.reload({ waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    reloadOk = false;
    failSilent(8, 'App shell reloads offline (service worker)', String(e).slice(0, 200));
  }
  if (reloadOk) {
    check(8, 'App shell reloads offline (service worker)', true);
    await page.waitForSelector('.facility-card', { timeout: 15000 });
    const netInd = await page.locator('.net-indicator').innerText();
    check(8, 'Header shows clear "Offline mode" indicator', /Offline mode/.test(netInd), netInd.replace(/\s+/g, ' '));
    const homeNotice = await page
      .locator('.notice.warn')
      .first()
      .innerText()
      .catch(() => '(no offline notice found)');
    check(8, 'Home explains the cached copy + that reporting needs a connection', /browsing the copy saved on this device/.test(homeNotice) && /needs a connection/.test(homeNotice), homeNotice.slice(0, 90));
    const offlineCards = await page.locator('.facility-card').count();
    check(8, 'Facility list fully available from cache', offlineCards === TOTAL, `${offlineCards} cards`);
    check(8, 'Map container still present offline', (await page.locator('.leaflet-container').count()) === 1);

    await page.goto(`${BASE}/facility/f07`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForSelector('.access-table', { timeout: 15000 });
    const offlineDetail = await page.locator('main').innerText();
    check(8, 'Recently viewed facility readable offline', offlineDetail.includes('Vyttila') && /Last updated: \d{2} [A-Z][a-z]{2}/.test(offlineDetail));
    const offlineReportBtn = page.locator('button.btn:has-text("Report a problem")');
    const disabledOffline = (await offlineReportBtn.count()) === 1 && (await offlineReportBtn.first().isDisabled());
    check(8, 'Offline: report button disabled with explanation', disabledOffline && offlineDetail.includes('Reporting needs an internet connection'));

    await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForSelector('.facility-card', { timeout: 15000 });
    check(8, 'Recently viewed (cached) chips shown on home', (await page.locator('.recent-row').count()) === 1);

    // restore
    await ctx.setOffline(false);
    startServer(dbFile);
    if (!(await waitHealth())) throw new Error(`QA server did not restart.\n${serverLog.slice(-2000)}`);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.facility-card', { timeout: 15000 });
    const backOnline = await page.locator('.net-indicator').innerText();
    check(8, 'Back online: indicator returns to live data', /Online/.test(backOnline), backOnline.replace(/\s+/g, ' '));
    const liveNote = await page.locator('.results-note').innerText();
    check(8, 'Live data resumes after reconnect', liveNote.includes(`of ${TOTAL}`));
  }

  /* ── 13: mobile ── */
  section('13 · Mobile responsiveness (375 × 720)');
  const mctx = await browser.newContext({
    viewport: { width: 375, height: 720 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => pageErrors.push(`[mobile] ${e}`));
  for (const p of ['/', '/facility/f07', '/route', '/admin']) {
    await mp.goto(`${BASE}${p}`, { waitUntil: 'load' });
    await mp.waitForSelector('main .card, main article, .ticket-card, .facility-card', { timeout: 15000 }).catch(() => {});
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(13, `No horizontal overflow on ${p}`, overflow <= 1, `overflow=${overflow}px`);
  }
  await mp.goto(`${BASE}/`, { waitUntil: 'load' });
  await mp.waitForSelector('.facility-card', { timeout: 15000 });
  const cols = await mp.evaluate(() => getComputedStyle(document.querySelector('.split')).gridTemplateColumns);
  check(13, 'Map & results stack into one column', cols.trim().split(/\s+/).length === 1, cols);
  check(13, 'Search field visible on mobile', await mp.locator('#q').isVisible());
  const mapBox = await mp.locator('.map').boundingBox();
  check(13, 'Map has usable height on mobile', !!mapBox && mapBox.height >= 250, mapBox ? `${Math.round(mapBox.height)}px` : 'no box');
  const noHScroll = await mp.evaluate(() => document.querySelectorAll('.facility-card').length);
  check(13, 'Facility cards render on mobile', noHScroll === TOTAL, `${noHScroll} cards`);
  await mctx.close();

  /* ── 3 (part 2) + 15: geolocation granted context ── */
  section('3 · Nearby sort with granted location / 15 · Location privacy');
  const gctx = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    permissions: ['geolocation'],
    geolocation: { latitude: 9.955, longitude: 76.28 }, // Ernakulam, Kochi
  });
  const gp = await gctx.newPage();
  gp.on('pageerror', (e) => pageErrors.push(`[geo] ${e}`));
  const geoApiReqs = [];
  gp.on('request', (r) => {
    if (r.url().includes('/api/')) geoApiReqs.push(`${r.url()} ${r.postData() ?? ''}`);
  });
  await gp.goto(`${BASE}/`, { waitUntil: 'load' });
  await gp.waitForSelector('.facility-card', { timeout: 15000 });
  let autoChip = true;
  try {
    await gp.waitForSelector('span.chip-active:has-text("Nearby sorted by distance")', { timeout: 12000 });
  } catch {
    autoChip = false;
  }
  const deniedShown = (await gp.locator('.badge.warn:has-text("permission denied")').count()) > 0;
  check(3, 'Granted location is used automatically (no repeat prompt, not denied)', autoChip && !deniedShown, autoChip ? 'nearby chip visible' : 'chip missing');
  const geoNote = await gp.locator('.results-note').innerText();
  check(3, 'Results note says sorted nearest first', geoNote.includes('sorted nearest first'), geoNote.replace(/\s+/g, ' '));

  const dists = (await gp.$$eval('.facility-card .distance', (els) => els.map((e) => e.textContent))).map(distKm);
  check(3, 'Distances shown on every card', dists.length === TOTAL && dists.every((d) => d != null), `${dists.filter((d) => d != null).length}/${TOTAL} distances`);
  const sorted = dists.every((d, i) => i === 0 || (d !== null && dists[i - 1] !== null && d >= dists[i - 1] - 1e-9));
  check(3, 'List sorted nearest → farthest', sorted, `first=${dists[0]?.toFixed(2)} km, last=${dists[dists.length - 1]?.toFixed(2)} km`);

  check(3, 'Distance filter enabled once location is granted', !(await gp.locator('#distance').isDisabled()));
  await gp.selectOption('#distance', '1');
  await sleep(300);
  const zeroCards = await gp.locator('.facility-card').count();
  const zeroState = (await gp.locator('.empty-state').count()) > 0;
  check(4, 'Zero-result state is graceful (message + clear-all button)', zeroCards === 0 && zeroState && (await gp.locator('button:has-text("Clear all filters")').count()) === 1, `${zeroCards} cards`);
  await gp.selectOption('#distance', '2');
  await sleep(350);
  const nearDists = (await gp.$$eval('.facility-card .distance', (els) => els.map((e) => e.textContent))).map(distKm);
  check(3, '"Within 2 km" narrows results and all are ≤ 2 km', nearDists.length > 0 && nearDists.length < TOTAL && nearDists.every((d) => d !== null && d <= 2.001), `${nearDists.length} within 2 km`);

  const userDot = await gp.locator('.leaflet-overlay-pane path.leaflet-interactive').count();
  check(3, 'User location dot drawn on the map (permission-gated)', userDot >= 1, `${userDot} path(s)`);

  const coordLeaks = geoApiReqs.filter((r) => /\d\.\d/.test(r));
  check(15, 'Location NEVER sent to the server (no decimal coords in any API request)', coordLeaks.length === 0, coordLeaks.slice(0, 3).join(' | ') || `${geoApiReqs.length} api requests clean`);
  const geoStorage = await gp.evaluate(() => Object.keys({ ...localStorage }));
  const geoBad = geoStorage.filter((k) => /coord|lat|lng|location|geoloc/i.test(k));
  check(15, 'Granted location never persisted to storage', geoBad.length === 0, geoBad.join(','));
  await gctx.close();

  /* ── 16: no uncaught errors anywhere ── */
  section('16 · Build & deployment');
  check(16, 'No uncaught page errors in any context', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check(16, 'API health endpoint OK', (await (await fetch(`${BASE}/api/health`)).json()).ok === true);

  await ctx.close();
  if (consoleErrors.length) {
    console.log(`\n  note: ${consoleErrors.length} console error(s) seen (network noise only expected):`);
    for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log(`    · ${e.slice(0, 160)}`);
  }
}

/* ── run + report ──────────────────────────────────────────────────────── */
try {
  await main();
} catch (err) {
  check('!', 'QA run completed without crashing', false, String(err && err.message ? err.message : err).slice(0, 500));
} finally {
  try {
    await browser?.close();
  } catch {
    /* ignore */
  }
  stopServer();
  killPort(PORT);
}

const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);

// Coverage: every numbered area must have at least one check.
const covered = new Set(results.map((r) => r.item));
const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].filter((i) => !covered.has(i));
if (missing.length) {
  console.log(`\nCOVERAGE GAP: no checks ran for area(s): ${missing.join(', ')}`);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`QA RESULT: ${passed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} FAILED` : ''}`);
for (const f of failed) console.log(`  FAIL [${f.item}] ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
console.log('═'.repeat(60));
process.exit(failed.length === 0 && missing.length === 0 ? 0 : 1);
