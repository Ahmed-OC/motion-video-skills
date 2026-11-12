#!/usr/bin/env node
/**
 * stills.mjs (v2.0) — headless QA harness for seek()-contract pages.
 *
 *   --times   render chosen instants to PNG (dual-seek warmed on fresh pages)
 *   --scan    seek EVERY frame once: surfaces JS errors + NaN canvas calls via MVS telemetry
 *   --determinism  render each instant twice on FRESH pages and SHA-256 byte-compare
 */
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    times: { type: 'string' },
    out: { type: 'string', default: 'out/qa-stills' },
    scan: { type: 'boolean', default: false },
    determinism: { type: 'boolean', default: false },
    selector: { type: 'string', default: '' },
  },
});
if (!args.file || (!args.times && !args.scan)) {
  console.error('usage: node stills.mjs --file video/index.html (--times 1.0,4.5 [--determinism] | --scan) [--out out/qa]');
  process.exit(1);
}

function resolvePlaywright() {
  const globalNodeModules = path.resolve(process.execPath, '..', '..', 'lib', 'node_modules');
  const bases = [
    path.join(process.cwd(), 'package.json'),
    path.join(__dirname, '..', '..', '..', 'package.json'),
    path.join(globalNodeModules, 'playwright', 'package.json'),
    path.join(globalNodeModules, 'playwright-core', 'package.json'),
    path.join(os.homedir(), 'template_cache', 'package.json'),
    '/usr/lib/node_modules/playwright/package.json',
  ];
  for (const b of bases) {
    if (!existsSync(b)) continue;
    try { return createRequire(b)('playwright'); } catch {}
    try { return createRequire(b)('playwright-core'); } catch {}
  }
  console.error('✗ playwright not found. Install: npm i -g playwright-core && npx playwright install chromium');
  process.exit(1);
}

async function launchChromium(chromium) {
  const launchArgs = ['--allow-file-access-from-files'];
  try {
    return await chromium.launch({ args: launchArgs });
  } catch (err) {
    const msCache = path.join(os.homedir(), '.cache', 'ms-playwright');
    if (existsSync(msCache)) {
      const { readdirSync } = await import('node:fs');
      const dirs = readdirSync(msCache).filter((d) => d.startsWith('chromium-')).sort().reverse();
      for (const d of dirs) {
        for (const sub of [['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome']]) {
          const exe = path.join(msCache, d, ...sub);
          if (existsSync(exe)) return chromium.launch({ executablePath: exe, args: launchArgs });
        }
      }
    }
    throw err;
  }
}

const { chromium } = resolvePlaywright();
const kitPath = path.resolve(__dirname, '..', 'assets', 'motion-kit.js');
const kitCode = existsSync(kitPath) ? readFileSync(kitPath, 'utf8') : '';

const url = pathToFileURL(path.resolve(args.file)).href;
const errors = new Set();
const browser = await launchChromium(chromium);

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.add(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.add(`console: ${m.text()}`); });
  if (kitCode) await page.addInitScript({ content: kitCode });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (window.onReady) await window.onReady();
  });
  const V = await page.evaluate(() => window.VIDEO);
  if (V && V.width && V.height) await page.setViewportSize({ width: Math.round(V.width), height: Math.round(V.height) });
  // Dual-seek warm-up on fresh page
  await page.evaluate(async () => {
    const r = window.seek(0);
    if (r && typeof r.then === 'function') await r;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  });
  return page;
}

async function shoot(page, t) {
  await page.evaluate(async (tt) => {
    const r = window.seek(tt);
    if (r && typeof r.then === 'function') await r;
  }, t);
  if (args.selector) {
    const el = await page.$(args.selector);
    if (!el) throw new Error(`no element matches ${args.selector}`);
    return el.screenshot({ type: 'png' });
  }
  return page.screenshot({ type: 'png' });
}

let failed = false;
const times = (args.times || '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);

if (args.scan) {
  const page = await freshPage();
  const V = await page.evaluate(() => window.VIDEO);
  if (!V || !V.fps || !V.duration) {
    console.error('✗ window.VIDEO { fps, duration } missing — cannot scan');
    failed = true;
  } else {
    const n = Math.round(V.duration * V.fps);
    for (let i = 0; i < n; i++) {
      try {
        const nanErrs = await page.evaluate(async (tt) => {
          if (window.__MVS_TELEMETRY__) window.__MVS_TELEMETRY__.beginFrame(tt, 'scan');
          const r = window.seek(tt);
          if (r && typeof r.then === 'function') await r;
          return window.__MVS_TELEMETRY__ ? window.__MVS_TELEMETRY__.snapshot().nanErrors : [];
        }, i / V.fps);
        if (nanErrs.length) errors.add(`NaN canvas call @ t=${(i / V.fps).toFixed(3)}s: ${nanErrs[0].op}`);
      } catch (e) {
        errors.add(`seek(${(i / V.fps).toFixed(3)}): ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`scan: ${n} frames seeked`);
  }
  await page.close();
}

if (times.length) {
  mkdirSync(args.out, { recursive: true });
  const pageA = await freshPage();
  const shotsA = [];
  for (const t of times) {
    const png = await shoot(pageA, t);
    shotsA.push(png);
    writeFileSync(path.join(args.out, `still_${t.toFixed(2).padStart(6, '0')}.png`), png);
  }
  await pageA.close();
  console.log(`stills: ${times.length} → ${args.out}`);
  if (args.determinism) {
    const pageB = await freshPage();
    const hash = (b) => createHash('sha256').update(b).digest('hex');
    for (let k = 0; k < times.length; k++) {
      const same = hash(await shoot(pageB, times[k])) === hash(shotsA[k]);
      if (!same) failed = true;
      console.log(`  t=${times[k]}s  ${same ? 'identical' : 'DIFFERENT — hidden time, unseeded randomness or accumulated state'}`);
    }
    await pageB.close();
  }
}

await browser.close();
if (errors.size) { failed = true; console.log('ERRORS:\n  ' + [...errors].join('\n  ')); }
console.log(failed ? 'GATE: FAIL' : 'GATE: PASS');
process.exit(failed ? 1 : 0);
