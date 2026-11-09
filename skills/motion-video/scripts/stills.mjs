#!/usr/bin/env node
/**
 * stills.mjs — headless QA harness for seek()-contract pages. One browser, many instants:
 * iterate on poses, layout and timing at a fraction of a full render's cost.
 *
 *   --times   render chosen instants to PNG (style gates, pose checks, before/after proofs)
 *   --scan    seek EVERY frame once, no screenshots: surfaces any JS error at any t
 *   --determinism  render each instant twice on FRESH pages and byte-compare
 *                  (accumulated state survives same-page re-seeks — a fresh page doesn't)
 *
 * Usage (from the video project's parent directory, like render_frames.mjs):
 *   node <skill>/scripts/stills.mjs --file video/index.html --times 1.0,4.5,8.3 --out out/qa
 *   node <skill>/scripts/stills.mjs --file video/index.html --scan
 *   node <skill>/scripts/stills.mjs --file video/index.html --times 1.0,8.3 --determinism
 *   Options: --selector "#stage" (element to capture; default: first canvas)
 *
 * Exit 1 on any page error or determinism mismatch. Note: a NaN drawn to canvas renders
 * NOTHING and logs NOTHING — pair --scan with an init-time finiteness audit in the page
 * (see references/verify.md) and with video-qa's disco.mjs on the final render.
 * Requires playwright resolvable from the CURRENT project.
 */
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    times: { type: 'string' },
    out: { type: 'string', default: 'out/qa-stills' },
    scan: { type: 'boolean', default: false },
    determinism: { type: 'boolean', default: false },
    selector: { type: 'string', default: 'canvas' },
  },
});
if (!args.file || (!args.times && !args.scan)) {
  console.error('usage: node stills.mjs --file video/index.html (--times 1.0,4.5 [--determinism] | --scan) [--out out/qa]');
  process.exit(1);
}

const require = createRequire(path.join(process.cwd(), 'package.json'));
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require('playwright-core')); } catch {
    console.error('✗ playwright is not resolvable from the current project.\n' +
      '  npm i -D playwright && npx playwright install chromium   (then re-run from that directory)');
    process.exit(1);
  }
}

const url = pathToFileURL(path.resolve(args.file)).href;
const errors = new Set();
const browser = await chromium.launch();
async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.add(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.add(`console: ${m.text()}`); });
  await page.goto(url);
  await page.evaluate(async () => { if (window.onReady) await window.onReady(); });
  return page;
}
async function shoot(page, t) {
  await page.evaluate((tt) => window.seek(tt), t);
  const el = await page.$(args.selector);
  if (!el) throw new Error(`no element matches ${args.selector}`);
  return el.screenshot({ type: 'png' });
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
      try { await page.evaluate((tt) => window.seek(tt), i / V.fps); }
      catch (e) { errors.add(`seek(${(i / V.fps).toFixed(3)}): ${e.message.split('\n')[0]}`); }
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
