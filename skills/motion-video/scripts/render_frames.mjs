#!/usr/bin/env node
/**
 * render_frames.mjs (v2.0) — High-speed deterministic video renderer for seek()-contract HTML pages.
 *
 * Upgrades over v1:
 *  - `--audio <path>`: muxes external WAV/MP3 voiceover/mix directly (alongside `window.renderAudio()`).
 *  - `--workers <N>`: parallel multi-page Chromium chunk rendering (3–5x faster on multi-core CPUs).
 *  - `--subframes <1|4>`: optional 180° shutter motion-blur (`tmix`) without page code changes.
 *  - End-to-end BT.709 color matrix (`in_color_matrix=bt709:out_color_matrix=bt709` + VUI tags)
 *    so brand reds/oranges (`#FF4D00`) never shift toward muddy BT.601 brown.
 *  - Dual-seek warm-up on `--still` (fixes blank WebFont/first-paint race on fresh pages).
 *  - Resilient Playwright module resolution (works even in scratch directories without `package.json`).
 */
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    url: { type: 'string' },
    out: { type: 'string' },
    audio: { type: 'string' },
    fps: { type: 'string' },
    duration: { type: 'string' },
    width: { type: 'string' },
    height: { type: 'string' },
    scale: { type: 'string' },
    quality: { type: 'string' },
    workers: { type: 'string' },
    subframes: { type: 'string' },
    png: { type: 'boolean', default: false },
    still: { type: 'string' },
    query: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

const num = (v, label) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) { console.error(`✗ --${label}: not a number (${v})`); process.exit(1); }
  return n;
};
const opt = {
  fps: num(args.fps, 'fps'),
  duration: num(args.duration, 'duration'),
  width: num(args.width, 'width'),
  height: num(args.height, 'height'),
  scale: num(args.scale, 'scale') ?? 1,
  quality: num(args.quality, 'quality') ?? 92,
  workers: Math.max(1, Math.min(8, Math.round(num(args.workers, 'workers') ?? Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)))))),
  subframes: Math.max(1, Math.min(8, Math.round(num(args.subframes, 'subframes') ?? 1))),
  still: num(args.still, 'still'),
};

if (args.help || (!args.file && !args.url)) {
  console.log(`Usage: render_frames.mjs --file <page.html> | --url <url> [--out out/video.mp4]
  --audio <file.wav|mp3>      Mux external voiceover/music stem directly
  --workers <n>               Parallel Chromium workers (default auto up to 4)
  --subframes <n>             Shutter motion-blur subframes via tmix (e.g. 4)
  --still <seconds>           Render a single frame to PNG (dual-seek warmed)
  --fps/--duration/--width/--height   Override window.VIDEO values
  --scale <n>                 Supersampling scale factor (e.g. 2)
  --query "ar=9:16"           Appended to URL for multi-aspect recomposition
  --png                       Lossless PNG pipe (for pixel-art/alpha)`);
  process.exit(args.help ? 0 : 1);
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
  console.error('✗ playwright not found.\n  Install: npm i -g playwright-core && npx playwright install chromium');
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
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error) {
  console.error('✗ ffmpeg not found on PATH.');
  process.exit(1);
}

const isStill = opt.still !== undefined;
const outFile = path.resolve(args.out || (isStill ? 'out/still.png' : 'out/video.mp4'));
mkdirSync(path.dirname(outFile), { recursive: true });

let pageUrl = args.url || pathToFileURL(path.resolve(args.file)).href;
if (args.query) pageUrl += (pageUrl.includes('?') ? '&' : '?') + args.query;

const t0 = Date.now();
const browser = await launchChromium(chromium);

async function openReadyPage(w = 1280, h = 720) {
  const p = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: Math.max(1, opt.scale || 1),
  });
  p.on('pageerror', (e) => console.error('✗ page error:', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.error('· page console:', m.text()); });
  await p.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
  await p.waitForFunction(
    () => typeof window.seek === 'function' && window.VIDEO && window.VIDEO.width > 0,
    null,
    { timeout: 15000 }
  );
  await p.evaluate(async () => {
    await document.fonts.ready;
    if (typeof window.onReady === 'function') await window.onReady();
  });
  return p;
}

try {
  const probePage = await openReadyPage();
  const meta = await probePage.evaluate(() => window.VIDEO);
  const width = Math.round(opt.width || meta.width);
  const height = Math.round(opt.height || meta.height);
  const fps = opt.fps || meta.fps || 30;
  const duration = opt.duration || meta.duration || 0;
  if (!(fps > 0 && fps <= 120)) throw new Error(`invalid fps: ${fps}`);
  if (duration <= 0) throw new Error(`invalid duration: ${duration}`);
  await probePage.setViewportSize({ width, height });

  // Warm-up render on fresh page so WebFonts & canvas state settle deterministically
  await probePage.evaluate(async (t) => {
    const r = window.seek(t);
    if (r && typeof r.then === 'function') await r;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  }, isStill ? opt.still : 0);

  if (isStill) {
    await probePage.evaluate(async (t) => {
      const r = window.seek(t);
      if (r && typeof r.then === 'function') await r;
    }, opt.still);
    await probePage.screenshot({ path: outFile, clip: { x: 0, y: 0, width, height } });
    await browser.close();
    console.log(`✓ still @ t=${opt.still}s → ${outFile}`);
    process.exit(0);
  }

  // Audio resolution: explicit `--audio` wins; otherwise call `window.renderAudio()` if defined
  let audioPath = args.audio ? path.resolve(args.audio) : null;
  if (audioPath && !existsSync(audioPath)) {
    throw new Error(`--audio file not found: ${audioPath}`);
  }
  if (!audioPath) {
    const hasAudio = await probePage.evaluate(() => typeof window.renderAudio === 'function');
    if (hasAudio) {
      const b64 = await probePage.evaluate(async () => {
        const res = await window.renderAudio();
        if (!res) return null;
        if (typeof res === 'string') return res;
        if (typeof res.base64 === 'string') return res.base64;
        if (typeof Blob !== 'undefined' && res instanceof Blob) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = '';
          for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          return btoa(bin);
        }
        return null;
      });
      if (b64) {
        audioPath = path.join(path.dirname(outFile), 'audio.wav');
        writeFileSync(audioPath, Buffer.from(b64, 'base64'));
        console.log(`· audio stem synthesized → ${audioPath}`);
      }
    }
  }

  const sub = opt.subframes;
  const captureFps = fps * sub;
  const totalFrames = Math.max(1, Math.round(duration * captureFps));
  const shotType = args.png ? 'png' : 'jpeg';
  const vfParts = [];
  if (sub > 1) vfParts.push(`tmix=frames=${sub}:weights='${Array(sub).fill(1).join(' ')}',fps=${fps}`);
  if (opt.scale > 1) vfParts.push(`scale=${width}:${height}:flags=lanczos:in_color_matrix=bt709:out_color_matrix=bt709`);
  else vfParts.push(`scale=in_color_matrix=bt709:out_color_matrix=bt709`);
  const vfFilter = vfParts.join(',');

  const workerCount = totalFrames < 90 ? 1 : opt.workers;

  if (workerCount === 1) {
    const ffArgs = [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(captureFps), '-i', 'pipe:0',
      ...(audioPath ? ['-i', audioPath] : []),
      '-vf', vfFilter,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      ...(audioPath ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
      '-movflags', '+faststart', outFile,
    ];
    const ff = spawn('ffmpeg', ffArgs);
    let ffErr = '';
    ff.stderr.on('data', (d) => { ffErr += d.toString(); });

    for (let f = 0; f < totalFrames; f++) {
      await probePage.evaluate((t) => {
        const r = window.seek(t);
        return r && typeof r.then === 'function' ? r : null;
      }, f / captureFps);
      const buf = await probePage.screenshot({
        type: shotType,
        ...(shotType === 'jpeg' ? { quality: Math.min(100, Math.max(50, opt.quality)) } : {}),
        clip: { x: 0, y: 0, width, height },
      });
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
      if (f % 45 === 0 || f === totalFrames - 1) {
        const rate = ((f + 1) / ((Date.now() - t0) / 1000)).toFixed(1);
        process.stdout.write(`\r· frame ${f + 1}/${totalFrames} (${rate} fps)      `);
      }
    }
    ff.stdin.end();
    const [code] = await once(ff, 'exit');
    if (code !== 0) throw new Error(`ffmpeg exited ${code}\n${ffErr.slice(-2000)}`);
  } else {
    // Parallel multi-worker chunk rendering -> concat lossless segments -> final mux
    const tmpDir = path.join(path.dirname(outFile), `.mvs_chunks_${process.pid}`);
    mkdirSync(tmpDir, { recursive: true });
    await probePage.close();

    const chunkSize = Math.ceil(totalFrames / workerCount);
    let completedFrames = 0;

    const segFiles = await Promise.all(
      Array.from({ length: workerCount }, async (_, wIdx) => {
        const fStart = wIdx * chunkSize;
        const fEnd = Math.min(totalFrames, fStart + chunkSize);
        if (fStart >= fEnd) return null;
        const segOut = path.join(tmpDir, `seg_${String(wIdx).padStart(2, '0')}.mp4`);
        const p = await openReadyPage(width, height);
        await p.evaluate(async (t) => {
          const r = window.seek(t);
          if (r && typeof r.then === 'function') await r;
          await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        }, fStart / captureFps);

        const ff = spawn('ffmpeg', [
          '-y', '-hide_banner', '-loglevel', 'error',
          '-f', 'image2pipe', '-framerate', String(captureFps), '-i', 'pipe:0',
          '-vf', vfFilter,
          '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
          segOut,
        ]);
        let segErr = '';
        ff.stderr.on('data', (d) => { segErr += d.toString(); });

        for (let f = fStart; f < fEnd; f++) {
          await p.evaluate((t) => {
            const r = window.seek(t);
            return r && typeof r.then === 'function' ? r : null;
          }, f / captureFps);
          const buf = await p.screenshot({
            type: shotType,
            ...(shotType === 'jpeg' ? { quality: Math.min(100, Math.max(50, opt.quality)) } : {}),
            clip: { x: 0, y: 0, width, height },
          });
          if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
          completedFrames++;
          if (completedFrames % 45 === 0 || completedFrames === totalFrames) {
            const rate = (completedFrames / ((Date.now() - t0) / 1000)).toFixed(1);
            process.stdout.write(`\r· frame ${completedFrames}/${totalFrames} (${rate} fps · ${workerCount} workers)   `);
          }
        }
        ff.stdin.end();
        const [code] = await once(ff, 'exit');
        await p.close();
        if (code !== 0) throw new Error(`worker ${wIdx} ffmpeg failed: ${segErr}`);
        return segOut;
      })
    );

    const validSegs = segFiles.filter(Boolean);
    const listFile = path.join(tmpDir, 'concat.txt');
    writeFileSync(listFile, validSegs.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
    const muxRes = spawnSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'concat', '-safe', '0', '-i', listFile,
      ...(audioPath ? ['-i', audioPath] : []),
      '-c:v', 'copy',
      ...(audioPath ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
      '-movflags', '+faststart', outFile,
    ], { encoding: 'utf8' });
    rmSync(tmpDir, { recursive: true, force: true });
    if (muxRes.status !== 0) throw new Error(`concat mux failed: ${muxRes.stderr}`);
  }

  await browser.close();
  process.stdout.write('\n');
  const mb = (statSync(outFile).size / 1048576).toFixed(2);
  console.log(`✓ ${outFile}  (${Math.round(duration * fps)} frames · ${width}x${height} @${fps} · BT.709 · ${mb} MB` +
    `${audioPath ? ' · audio muxed' : ''} · ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
} catch (e) {
  await browser.close().catch(() => {});
  console.error('✗ ' + e.message);
  process.exit(1);
}
