#!/usr/bin/env node
/**
 * render_frames.mjs — deterministic video renderer for seek()-contract HTML pages.
 *
 * The page must expose:
 *   window.VIDEO   = { width, height, fps, duration }        // numbers
 *   window.seek(t) // paints the exact frame at time t (seconds); may return a Promise
 *   window.renderAudio()  // OPTIONAL → { mime:'wav', base64:'...' } or a bare base64 string
 *   window.onReady()      // OPTIONAL async preload hook (fonts, images) called once before frame 0
 *
 * In render context the page must NOT use rAF, setTimeout, CSS transitions/animations,
 * Date.now() or unseeded Math.random() — every frame must be a pure function of t.
 *
 * Usage (from the video project's parent directory):
 *   node <skill>/scripts/render_frames.mjs --file video/index.html --out out/video.mp4
 *   node <skill>/scripts/render_frames.mjs --file video/index.html --still 3.2 --out out/poster.png
 *   node <skill>/scripts/render_frames.mjs --url http://localhost:5173 --fps 30 --duration 15
 *   Options: --scale 2 (2× supersampling) · --png (lossless frames, slower) · --query "ar=9:16"
 *
 * Requires: node ≥18 · playwright resolvable from the CURRENT project · ffmpeg on PATH.
 * If missing, this script prints the exact install commands.
 */
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    url: { type: 'string' },
    out: { type: 'string' },
    fps: { type: 'string' },
    duration: { type: 'string' },
    width: { type: 'string' },
    height: { type: 'string' },
    scale: { type: 'string' },
    quality: { type: 'string' },
    png: { type: 'boolean', default: false },
    still: { type: 'string' },
    query: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
// parseArgs only supports string|boolean — coerce numerics here
const num = (v, label) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) { console.error(`✗ --${label}: not a number (${v})`); process.exit(1); }
  return n;
};
const opt = {
  fps: num(args.fps, 'fps'), duration: num(args.duration, 'duration'),
  width: num(args.width, 'width'), height: num(args.height, 'height'),
  scale: num(args.scale, 'scale') ?? 1, quality: num(args.quality, 'quality') ?? 92,
  still: num(args.still, 'still'),
};

if (args.help || (!args.file && !args.url)) {
  console.log(`Usage: render_frames.mjs --file <page.html> | --url <url> [--out out/video.mp4]
  --still <seconds>      render a single frame to PNG instead of the video (style gates, posters)
  --fps/--duration/--width/--height   override window.VIDEO values
  --scale <n>            device scale factor (2 = render at 2× resolution)
  --query "a=b&c=d"      appended to the page URL (e.g. "ar=9:16" multi-aspect recomposition)
  --png                  capture lossless PNG frames (slower, for pixel-art/alpha work)`);
  process.exit(args.help ? 0 : 1);
}

// ---- resolve playwright from the CURRENT project (cwd), not from the skill dir ----
const require = createRequire(path.join(process.cwd(), 'package.json'));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try {
    ({ chromium } = require('playwright-core'));
  } catch {
    console.error('✗ playwright not found in this project.\n' +
      '  Install it here first:\n' +
      '    npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

const ffmpegProbe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
if (ffmpegProbe.error) {
  console.error('✗ ffmpeg not found on PATH.\n' +
    '  Windows: winget install Gyan.FFmpeg   (or https://gyan.dev/ffmpeg/builds)\n' +
    '  macOS:   brew install ffmpeg\n' +
    '  Linux:   sudo apt install ffmpeg');
  process.exit(1);
}

const isStill = opt.still !== undefined;
const outFile = path.resolve(args.out || (isStill ? 'out/still.png' : 'out/video.mp4'));
mkdirSync(path.dirname(outFile), { recursive: true });

const t0 = Date.now();
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: Math.max(1, opt.scale || 1),
});
page.on('pageerror', (e) => console.error('✗ page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('· page console:', m.text()); });

let pageUrl = args.url || pathToFileURL(path.resolve(args.file)).href;
if (args.query) pageUrl += (pageUrl.includes('?') ? '&' : '?') + args.query;

try {
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => typeof window.seek === 'function' && window.VIDEO && window.VIDEO.width > 0,
    null, { timeout: 15000 },
  ).catch(() => {
    throw new Error('page does not implement the seek contract: it must define ' +
      'window.VIDEO = {width,height,fps,duration} and window.seek(t). ' +
      'Start from the skill\'s assets/seek-template.html.');
  });

  const meta = await page.evaluate(() => window.VIDEO);
  const width = Math.round(opt.width || meta.width);
  const height = Math.round(opt.height || meta.height);
  const fps = opt.fps || meta.fps || 30;
  const duration = opt.duration || meta.duration || 0;
  if (!(fps > 0 && fps <= 120)) throw new Error(`invalid fps: ${fps}`);
  if (duration <= 0) throw new Error(`invalid duration: ${duration}`);
  await page.setViewportSize({ width, height });

  await page.evaluate(async () => {
    await document.fonts.ready;
    if (typeof window.onReady === 'function') await window.onReady();
  });

  // ---- still mode: one frame, done ----
  if (isStill) {
    await page.evaluate((t) => window.seek(t), opt.still);
    await page.screenshot({ path: outFile });
    await browser.close();
    console.log(`✓ still @ t=${args.still}s → ${outFile}`);
    process.exit(0);
  }

  // ---- audio stem first (deterministic, doesn't depend on the frame loop) ----
  let audioPath = null;
  const hasAudio = await page.evaluate(() => typeof window.renderAudio === 'function');
  if (hasAudio) {
    const res = await page.evaluate(() => window.renderAudio());
    const b64 = res ? (typeof res === 'string' ? res : res.base64) : null;
    if (b64) {
      audioPath = path.join(path.dirname(outFile), 'audio.wav');
      writeFileSync(audioPath, Buffer.from(b64, 'base64'));
      console.log(`· audio stem → ${audioPath}`);
    }
  }

  // ---- ffmpeg: frames piped from screenshots ----
  const total = Math.max(1, Math.round(duration * fps));
  const ffArgs = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0',
    ...(audioPath ? ['-i', audioPath] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    ...(audioPath ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-movflags', '+faststart', outFile,
  ];
  const ff = spawn('ffmpeg', ffArgs);
  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d.toString(); });

  const shotType = args.png ? 'png' : 'jpeg';
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => {
      const r = window.seek(t);
      return r && typeof r.then === 'function' ? r : null;
    }, f / fps);
    const buf = await page.screenshot({
      type: shotType,
      ...(shotType === 'jpeg' ? { quality: Math.min(100, Math.max(50, opt.quality)) } : {}),
      clip: { x: 0, y: 0, width, height },
    });
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    if (f % 60 === 0 || f === total - 1) {
      const rate = ((f + 1) / ((Date.now() - t0) / 1000)).toFixed(1);
      process.stdout.write(`\r· frame ${f + 1}/${total} (${rate} fps)      `);
    }
  }
  ff.stdin.end();
  const [code] = await once(ff, 'exit');
  await browser.close();
  process.stdout.write('\n');
  if (code !== 0) {
    console.error(`✗ ffmpeg exited ${code}\n${ffErr.slice(-2000)}`);
    process.exit(1);
  }
  const mb = (statSync(outFile).size / 1048576).toFixed(2);
  console.log(`✓ ${outFile}  (${total} frames · ${width}x${height} @${fps} · ${mb} MB` +
    `${audioPath ? ' · audio muxed' : ''} · ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log('  Next: probe it (scripts/probe.sh) and review a contact sheet ' +
    '(scripts/contact_sheet.sh) before shipping.');
} catch (e) {
  await browser.close().catch(() => {});
  console.error('✗ ' + e.message);
  process.exit(1);
}
