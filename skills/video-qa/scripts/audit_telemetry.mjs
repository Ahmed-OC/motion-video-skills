#!/usr/bin/env node
/**
 * audit_telemetry.mjs — Fast (<2s) Deterministic Visual & Geometric Compiler for `seek(t)` pages.
 *
 * Sweeps stratified timestamps across every scene in headless Chromium (zero MP4 encode, zero disk PNGs),
 * automatically injects `motion-kit.js` telemetry if not already loaded, computes an objective
 * `MVS_Q` quality score (0..100), and outputs prescriptive, compiler-style numeric fixes
 * (Minimum Separation Vector for overlaps, exact WCAG 5.5:1 hex colors, Safe-Zone clamps,
 * camera-drift patches, and LOCKED CLEAN SCENES anti-regression guards).
 *
 * Usage:
 *   node skills/video-qa/scripts/audit_telemetry.mjs --file video/index.html [--timeline video/timeline.json] [--json]
 *   Exit 0 when MVS_Q >= threshold (default 85) and zero BLOCKERs; Exit 2 when iterative repair is required.
 */
import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    url: { type: 'string' },
    timeline: { type: 'string' },
    threshold: { type: 'string', default: '85' },
    iteration: { type: 'string', default: '1' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (args.help || (!args.file && !args.url)) {
  console.log(`Usage: audit_telemetry.mjs --file <video/index.html> [--timeline video/timeline.json] [--threshold 85] [--json]`);
  process.exit(args.help ? 0 : 1);
}

function resolvePlaywright() {
  const globalNodeModules = path.resolve(process.execPath, '..', '..', 'lib', 'node_modules');
  const candidates = [
    path.join(process.cwd(), 'package.json'),
    path.join(__dirname, '..', '..', '..', 'package.json'),
    path.join(globalNodeModules, 'playwright', 'package.json'),
    path.join(globalNodeModules, 'playwright-core', 'package.json'),
    path.join(process.env.HOME || '', 'template_cache', 'package.json'),
    '/usr/lib/node_modules/playwright/package.json',
  ];
  for (const base of candidates) {
    if (!existsSync(base)) continue;
    try { return createRequire(base)('playwright'); } catch {}
    try { return createRequire(base)('playwright-core'); } catch {}
  }
  console.error('✗ playwright not found. Install: npm i -g playwright-core && npx playwright install chromium');
  process.exit(1);
}

async function launchChromium(chromium) {
  const launchArgs = ['--allow-file-access-from-files'];
  try {
    return await chromium.launch({ args: launchArgs });
  } catch (err) {
    const msCache = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
    if (existsSync(msCache)) {
      const { readdirSync } = await import('node:fs');
      const dirs = readdirSync(msCache).filter((d) => d.startsWith('chromium-')).sort().reverse();
      for (const d of dirs) {
        for (const sub of [
          ['chrome-linux64', 'chrome'],
          ['chrome-linux', 'chrome'],
          ['chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'],
          ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
        ]) {
          const exe = path.join(msCache, d, ...sub);
          if (existsSync(exe)) return chromium.launch({ executablePath: exe, args: launchArgs });
        }
      }
    }
    throw err;
  }
}

const { chromium } = resolvePlaywright();
const minScore = Number(args.threshold) || 85;
const iterNum = Number(args.iteration) || 1;

let timeline = null;
const tlCandidates = [
  args.timeline,
  args.file ? path.join(path.dirname(path.resolve(args.file)), 'timeline.json') : null,
].filter(Boolean);
for (const p of tlCandidates) {
  if (existsSync(p)) {
    try { timeline = JSON.parse(readFileSync(p, 'utf8')); break; } catch {}
  }
}

const kitPath = path.resolve(__dirname, '..', '..', 'motion-video', 'assets', 'motion-kit.js');
const kitCode = existsSync(kitPath) ? readFileSync(kitPath, 'utf8') : '';

const tStartWall = Date.now();
const browser = await launchChromium(chromium);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const runtimeErrors = [];
page.on('pageerror', (e) => runtimeErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') runtimeErrors.push(m.text()); });

// Inject Canvas/DOM telemetry BEFORE page scripts run so raw Canvas2D pages are also captured!
if (kitCode) {
  await page.addInitScript({ content: kitCode });
}

const pageUrl = args.url || pathToFileURL(path.resolve(args.file)).href;
await page.goto(pageUrl, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(
  () => typeof window.seek === 'function' && window.VIDEO && window.VIDEO.width > 0,
  null,
  { timeout: 12000 }
).catch(() => {
  console.error('✗ Page missing window.VIDEO or window.seek(t) contract.');
  process.exit(1);
});

const meta = await page.evaluate(async () => {
  await document.fonts.ready;
  if (typeof window.onReady === 'function') await window.onReady();
  return window.VIDEO;
});

const width = Math.round(meta.width || timeline?.width || 1920);
const height = Math.round(meta.height || timeline?.height || 1080);
const fps = meta.fps || timeline?.fps || 30;
const duration = meta.duration || timeline?.duration || 10;
await page.setViewportSize({ width, height });

// Build scene segments (either from timeline.json or auto-chunked every 3.5s)
const scenes = Array.isArray(timeline?.scenes) && timeline.scenes.length
  ? timeline.scenes.map((s, i) => ({
      id: s.id || `scene_${i + 1}`,
      index: i,
      start: Number(s.start ?? 0),
      duration: Number(s.duration ?? 3),
      text: s.text || '',
      transition: s.transition || null,
      device: s.device || null,
      shot: s.shot || null,
    }))
  : Array.from({ length: Math.max(1, Math.ceil(duration / 3.5)) }, (_, i) => {
      const st = i * 3.5;
      return { id: `seg_${i + 1}`, index: i, start: st, duration: Math.min(3.5, duration - st), text: '' };
    });

// Warm up fresh page fonts/layout
await page.evaluate(async () => {
  await window.seek(0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});

// Single in-browser V8 sweep across all scenes (~60-85 samples total)
const rawSweep = await page.evaluate(async ({ scenes, width, height, duration }) => {
  const thumbW = 160;
  const thumbH = Math.max(64, Math.round((160 * height) / width));
  const off = document.createElement('canvas');
  off.width = thumbW;
  off.height = thumbH;
  const octx = off.getContext('2d', { willReadFrequently: true });

  const mainCanvas = document.querySelector('canvas');
  const results = [];

  for (const sc of scenes) {
    const t0 = sc.start;
    const t1 = Math.min(duration - 0.034, sc.start + sc.duration);
    const span = Math.max(0.2, t1 - t0);
    // Stratified probe timestamps: post-transition settle, mid-scene, hold checkpoints, pre-cut
    const probes = [
      Math.min(t1, t0 + Math.min(0.45, span * 0.22)),
      t0 + span * 0.45,
      t0 + span * 0.68,
      Math.max(t0, t1 - Math.min(0.38, span * 0.16)),
      Math.max(t0, t1 - 0.08),
    ];

    const sceneSamples = [];
    let prevPixels = null;
    let earlyPixels = null;

    for (let sIdx = 0; sIdx < probes.length; sIdx++) {
      const pt = probes[sIdx];
      if (window.__MVS_TELEMETRY__) window.__MVS_TELEMETRY__.beginFrame(pt, sc.id);
      const r = window.seek(pt);
      if (r && typeof r.then === 'function') await r;

      const snap = window.__MVS_TELEMETRY__
        ? window.__MVS_TELEMETRY__.snapshot()
        : { nodes: [], nanErrors: [], shotPreset: null, cameraZoom: 1, cliches: [] };

      let meanLuma = 0;
      let stdLuma = 0;
      let activeBgDiffRatio = 0;
      let frameDiff = 0;
      let earlyVsLateDiff = 0;
      let leftMassShare = 0.5;
      const nodePixelBg = {};

      if (mainCanvas && octx) {
        octx.clearRect(0, 0, thumbW, thumbH);
        try {
          octx.drawImage(mainCanvas, 0, 0, thumbW, thumbH);
          const img = octx.getImageData(0, 0, thumbW, thumbH).data;
          const nPx = thumbW * thumbH;
          let sum = 0;
          let sumSq = 0;
          const sampleRow = Math.min(thumbH - 1, Math.round(thumbH * 0.16));
          const rowLeft = (sampleRow * thumbW + 2) * 4;
          const rowRight = (sampleRow * thumbW + (thumbW - 3)) * 4;
          const cR = (img[rowLeft] + img[rowRight]) * 0.5;
          const cG = (img[rowLeft + 1] + img[rowRight + 1]) * 0.5;
          const cB = (img[rowLeft + 2] + img[rowRight + 2]) * 0.5;
          let nonBgCount = 0;
          let diffAcc = 0;
          let earlyAcc = 0;
          let leftMass = 0;
          let rightMass = 0;

          for (let i = 0; i < img.length; i += 4) {
            const pIdx = i >> 2;
            const pxX = pIdx % thumbW;
            const lum = 0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2];
            sum += lum;
            sumSq += lum * lum;
            const distBg = Math.abs(img[i] - cR) + Math.abs(img[i + 1] - cG) + Math.abs(img[i + 2] - cB);
            if (distBg > 32) {
              nonBgCount++;
              if (pxX < thumbW * 0.5) leftMass += distBg;
              else rightMass += distBg;
            }
            if (prevPixels) {
              diffAcc += (Math.abs(img[i] - prevPixels[i]) + Math.abs(img[i + 1] - prevPixels[i + 1]) + Math.abs(img[i + 2] - prevPixels[i + 2])) / (3 * 255);
            }
            if (earlyPixels) {
              earlyAcc += (Math.abs(img[i] - earlyPixels[i]) + Math.abs(img[i + 1] - earlyPixels[i + 1]) + Math.abs(img[i + 2] - earlyPixels[i + 2])) / (3 * 255);
            }
          }
          meanLuma = sum / nPx;
          stdLuma = Math.sqrt(Math.max(0, sumSq / nPx - meanLuma * meanLuma));
          activeBgDiffRatio = nonBgCount / nPx;
          frameDiff = prevPixels ? diffAcc / nPx : 0;
          earlyVsLateDiff = earlyPixels ? earlyAcc / nPx : 0;
          if (leftMass + rightMass > 0) {
            leftMassShare = leftMass / (leftMass + rightMass);
          }
          prevPixels = new Uint8ClampedArray(img);
          if (sIdx === 0) earlyPixels = new Uint8ClampedArray(img);

          for (const nd of snap.nodes) {
            if (nd.bg || !nd.text) continue;
            const ringPts = [
              [nd.x - 4, nd.y + nd.h * 0.5],
              [nd.x + nd.w + 4, nd.y + nd.h * 0.5],
              [nd.x + nd.w * 0.25, nd.y - 4],
              [nd.x + nd.w * 0.75, nd.y - 4],
              [nd.x + nd.w * 0.25, nd.y + nd.h + 4],
              [nd.x + nd.w * 0.75, nd.y + nd.h + 4],
            ];
            const samplesRgb = ringPts.map(([px, py]) => {
              const sx = Math.max(0, Math.min(thumbW - 1, Math.floor((px / width) * thumbW)));
              const sy = Math.max(0, Math.min(thumbH - 1, Math.floor((py / height) * thumbH)));
              const idx = (sy * thumbW + sx) * 4;
              return [img[idx], img[idx + 1], img[idx + 2]];
            });
            samplesRgb.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
            const med = samplesRgb[Math.floor(samplesRgb.length / 2)];
            nodePixelBg[nd.id] = `rgb(${med[0]}, ${med[1]}, ${med[2]})`;
          }
        } catch {}
      }

      sceneSamples.push({
        t: Number(pt.toFixed(3)),
        nodes: snap.nodes,
        nanErrors: snap.nanErrors,
        shotPreset: snap.shotPreset || null,
        cameraZoom: snap.cameraZoom || 1,
        meanLuma,
        stdLuma,
        activeBgDiffRatio,
        frameDiff,
        earlyVsLateDiff,
        leftMassShare,
        nodePixelBg,
      });
    }
    results.push({ scene: sc, samples: sceneSamples });
  }
  return results;
}, { scenes, width, height, duration });

await browser.close();

// ============================================================================
// DETERMINISTIC COMPILER DIAGNOSTICS & WCAG HSL HEX SOLVER
// ============================================================================
function parseRgb(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s;
    if (h.length >= 7) {
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    }
  }
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function relLum([r, g, b]) {
  const f = (c) => {
    const x = Math.max(0, Math.min(255, c)) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relLum(rgb1);
  const l2 = relLum(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function suggestAccessibleHex(fgRgb, bgRgb, targetRatio = 5.5) {
  const bgLum = relLum(bgRgb);
  const goLight = bgLum < 0.32;
  for (let step = 0; step <= 25; step++) {
    const k = step / 25;
    const cand = goLight
      ? fgRgb.map((c) => Math.round(c + (255 - c) * k))
      : fgRgb.map((c) => Math.round(c * (1 - k)));
    if (contrastRatio(cand, bgRgb) >= targetRatio) {
      return '#' + cand.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  }
  return goLight ? '#F8FAFC' : '#0F172A';
}

function isPortrait(w, h) {
  return h > w * 1.15;
}

const safeBox = isPortrait(width, height)
  ? {
      x: Math.round((84 * width) / 1080),
      y: Math.round((240 * height) / 1920),
      w: Math.round(width - (168 * width) / 1080),
      h: Math.round(height - ((240 + 400) * height) / 1920),
      portrait: true,
    }
  : {
      x: Math.round(width * 0.035),
      y: Math.round(height * 0.04),
      w: Math.round(width * 0.93),
      h: Math.round(height * 0.92),
      portrait: false,
    };

const creativeDir = timeline?.creativeDirection || null;
const universe = String(creativeDir?.universe || timeline?.meta?.universe || '').toLowerCase();
const NON_DASHBOARD_UNIVERSES = new Set([
  'cinematic-film',
  'documentary-archive',
  'luxury-editorial',
  'storytelling-illustrated',
  '3d-photoreal',
  'hybrid-cinema',
  'fine-art',
]);
const MINIMAL_FRIENDLY_UNIVERSES = new Set([
  'cinematic-film',
  'luxury-editorial',
  'kinetic-manifesto',
  'storytelling-illustrated',
  'hybrid-cinema',
]);

const sceneReports = [];
let blockerCount = 0;

for (const { scene, samples } of rawSweep) {
  const issues = [];
  const seenKeys = new Set();
  const addIssue = (sev, code, message, fix) => {
    const key = `${code}:${message.slice(0, 40)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    issues.push({ severity: sev, code, message, fix });
  };

  if (scene.index === 0 && timeline && !creativeDir) {
    addIssue(
      'WARN',
      'MISSING_CREATIVE_DIRECTION',
      `timeline.json has no "creativeDirection" brief — autonomous director thinking was skipped.`,
      `Add timeline.creativeDirection ({ universe, emotionalArc, visualMetaphor, typographyPairing, signatureMoment, forbiddenCliches }) before coding scenes.`
    );
  }

  // 1. Runtime / NaN canvas check & Anti-AI-Slop Cliché Enforcement
  for (const smp of samples) {
    if (smp.nanErrors.length > 0) {
      const e = smp.nanErrors[0];
      addIssue(
        'BLOCKER',
        'NAN_CANVAS_CALL',
        `t=${smp.t}s: Canvas call ${e.op}() received NaN/Infinity (${JSON.stringify(e.args)}). Element vanished silently.`,
        `Replace raw division / underdamped ζ>=1 math with MVS.spring(t, f0, zeta) or MVS.clamp(v, 0, 1).`
      );
    }
    if (NON_DASHBOARD_UNIVERSES.has(universe) && Array.isArray(smp.cliches) && smp.cliches.length > 0) {
      addIssue(
        'BLOCKER',
        'CLICHE_VIOLATION',
        `Scene "${scene.id}" uses SaaS/Sci-Fi widget (${smp.cliches.join(', ')}) inside universe "${universe}"!`,
        `Remove MVS.drawMetricCard / MVS.drawHudOverlay! In "${universe}", use frameless editorial type (MVS.drawTextAutoFit), archival/cinema plates (MVS.drawImagePlate), or organic highlighters (MVS.drawHighlighter).`
      );
    }
  }

  // Evaluate settled midpoint sample (`samples[1]` or `samples[2]`) for geometry, contrast & density
  const midSample = samples[1] || samples[0];
  const isIntentionalMinimal =
    scene.shot === 'monumental-payoff' ||
    midSample?.shotPreset === 'monumental-payoff' ||
    MINIMAL_FRIENDLY_UNIVERSES.has(universe);

  if (midSample) {
    if (midSample.stdLuma < 2.2 && midSample.nodes.length === 0) {
      addIssue(
        'BLOCKER',
        'BLANK_FRAME',
        `t=${midSample.t}s: Frame is visually blank (luma stdDev=${midSample.stdLuma.toFixed(2)}).`,
        `Ensure scene "${scene.id}" draws a backdrop or image plate and visible focal elements at localT=${(midSample.t - scene.start).toFixed(2)}s.`
      );
    } else if (!isIntentionalMinimal && midSample.activeBgDiffRatio < 0.04 && midSample.nodes.length <= 2) {
      addIssue(
        'WARN',
        'SCENE_TOO_SPARSE',
        `t=${midSample.t}s: Visual occupancy is only ${(midSample.activeBgDiffRatio * 100).toFixed(1)}% ("black void / poster" look).`,
        `Add a visual anchor in "${scene.id}" using MVS.hstack/split layout + MVS.drawAreaChart, MVS.drawIsometricStack, MVS.drawGlobeWire, or MVS.drawMetricCard.`
      );
    }

    const textNodes = midSample.nodes.filter((n) => n.text && n.text.length > 0);

    // 2. Pairwise AABB Overlap Check (Text vs Text & Card vs Card) + Minimum Separation Vector
    for (let i = 0; i < textNodes.length; i++) {
      for (let j = i + 1; j < textNodes.length; j++) {
        const a = textNodes[i];
        const b = textNodes[j];
        if (a.allowOverlapIds?.includes(b.id) || b.allowOverlapIds?.includes(a.id)) continue;
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const inter = ix * iy;
        const minArea = Math.max(1, Math.min(a.w * a.h, b.w * b.h));
        if (inter / minArea > 0.04) {
          const pushDown = Math.ceil(a.y + a.h + 18 - b.y);
          addIssue(
            'BLOCKER',
            'OVERLAP_COLLISION',
            `t=${midSample.t}s: "${a.text.slice(0, 24)}" (${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.w)}x${Math.round(a.h)}) overlaps "${b.text.slice(0, 24)}" (${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)}x${Math.round(b.h)}) by ${Math.round((inter / minArea) * 100)}%.`,
            `Move second element down by +${pushDown}px (to y=${Math.round(b.y + pushDown)}), OR place both inside MVS.vstack(safe, [weightA, weightB], 24) + MVS.drawTextAutoFit().`
          );
        }
      }
    }

    // 2b. Flow-Beam Crossing Check (prevents stray diagonal lines slicing through text, cards, or globes/stacks)
    const beamNodes = midSample.nodes.filter((n) => n.role === 'beam' && Array.isArray(n.p0) && Array.isArray(n.p1));
    const obstacleNodes = midSample.nodes.filter(
      (n) => (n.text && n.text.length > 0) || n.role === 'card' || n.role === 'diagram'
    );
    for (const bm of beamNodes) {
      const [x0, y0] = bm.p0;
      const [cx, cy] = bm.ctrl || [(x0 + bm.p1[0]) * 0.5, (y0 + bm.p1[1]) * 0.5];
      const [x1, y1] = bm.p1;
      for (const ob of obstacleNodes) {
        if (bm.allowOverlapIds?.includes(ob.id)) continue;
        let hit = false;
        for (let s = 2; s <= 8; s++) {
          const u = s / 10;
          const iu = 1 - u;
          const px = iu * iu * x0 + 2 * iu * u * cx + u * u * x1;
          const py = iu * iu * y0 + 2 * iu * u * cy + u * u * y1;
          if (px > ob.x + 8 && px < ob.x + ob.w - 8 && py > ob.y + 8 && py < ob.y + ob.h - 8) {
            hit = true;
            break;
          }
        }
        if (hit) {
          addIssue(
            'BLOCKER',
            'BEAM_CROSSES_CONTENT',
            `t=${midSample.t}s: Flow beam "${bm.id}" slices across ${ob.text ? `text "${ob.text.slice(0, 22)}"` : `${ob.role} "${ob.id}"`}.`,
            `Connect MVS.drawFlowBeam ONLY across empty gutter space between two border ports ([leftBox.x + leftBox.w, midY] -> [rightBox.x, midY], arcLift: 0), or remove redundant drawFlowBeam when drawGlobeWire / drawIsometricStack / drawCodeCard already animates internally.`
          );
        }
      }
    }

    // 3. Out-of-bounds & Safe-Zone check
    for (const nd of textNodes) {
      if (nd.clippedX || nd.clippedY) {
        addIssue(
          'BLOCKER',
          'DOM_TEXT_CLIPPED',
          `Element "${nd.id}" ("${nd.text.slice(0, 22)}") overflows its DOM box.`,
          `Increase container height or render via MVS.drawTextAutoFit() which binary-searches exact fontPx.`
        );
      }
      if (nd.x < safeBox.x - 14 || nd.x + nd.w > safeBox.x + safeBox.w + 14 || nd.y < safeBox.y - 18 || nd.y + nd.h > safeBox.y + safeBox.h + 18) {
        const clampedX = Math.max(safeBox.x, Math.min(nd.x, safeBox.x + safeBox.w - nd.w));
        const clampedY = Math.max(safeBox.y, Math.min(nd.y, safeBox.y + safeBox.h - nd.h));
        addIssue(
          nd.x < 0 || nd.x + nd.w > width || nd.y < 0 || nd.y + nd.h > height ? 'BLOCKER' : 'WARN',
          'SAFE_ZONE_INTRUSION',
          `"${nd.text.slice(0, 26)}" (${Math.round(nd.x)},${Math.round(nd.y)},${Math.round(nd.w)}x${Math.round(nd.h)}) exits safe frame (${safeBox.x},${safeBox.y},${safeBox.w}x${safeBox.h}).`,
          `Clamp box inside MVS.computeSafeZone(${width}, ${height}) -> suggested (x=${Math.round(clampedX)}, y=${Math.round(clampedY)}, maxW=${safeBox.w}).`
        );
      }

      // 4. Real WCAG Contrast Check
      if (nd.skipContrast) continue;
      const fgRgb = parseRgb(nd.fg);
      const bgRgb = parseRgb(nd.bg || midSample.nodePixelBg[nd.id]);
      if (fgRgb && bgRgb) {
        const cr = contrastRatio(fgRgb, bgRgb);
        const minCr = (nd.fontPx || 24) >= 36 ? 3.2 : 4.3;
        if (cr < minCr) {
          const hexFix = suggestAccessibleHex(fgRgb, bgRgb, 5.5);
          addIssue(
            cr < 2.3 ? 'BLOCKER' : 'WARN',
            'LOW_CONTRAST',
            `"${nd.text.slice(0, 24)}" has WCAG contrast ${cr.toFixed(2)}:1 (fg=${nd.fg} on bg=${nd.bg || midSample.nodePixelBg[nd.id]}), below ${minCr}:1.`,
            `Change text color to "${hexFix}" (>=5.5:1 contrast) or place inside MVS.drawCard() dark surface.`
          );
        }
      }
    }

    // 5. Duplicate Hero Title vs Caption check
    const captions = textNodes.filter((n) => n.role === 'caption' || n.id.includes('caption'));
    const heroes = textNodes.filter((n) => n.role === 'hero' || n.role === 'title');
    for (const cap of captions) {
      for (const h of heroes) {
        const wa = new Set(cap.text.toLowerCase().split(/\s+/).filter(Boolean));
        const wb = new Set(h.text.toLowerCase().split(/\s+/).filter(Boolean));
        let inter = 0;
        for (const w of wa) if (wb.has(w)) inter++;
        if (wa.size > 0 && inter / Math.min(wa.size, wb.size) >= 0.65) {
          addIssue(
            'WARN',
            'DUPLICATE_CAPTION_TEXT',
            `Caption "${cap.text.slice(0, 28)}" duplicates Hero Title "${h.text.slice(0, 28)}" on the same frame.`,
            `Set suppressCaptions: true on scene "${scene.id}" or let MVS.drawCaptions() auto-deduplicate.`
          );
        }
      }
    }
  }

  // 6. Intra-Scene Motion Freeze Check (comparing hold samples 1, 2, 3)
  if (scene.duration >= 2.2 && samples.length >= 4) {
    const holdDiff = Math.max(samples[2].frameDiff, samples[3].frameDiff);
    if (holdDiff < 0.0006) {
      addIssue(
        'WARN',
        'STATIC_HOLD_FREEZE',
        `Scene "${scene.id}" freezes completely during hold (${(samples[1].t).toFixed(2)}s..${(samples[3].t).toFixed(2)}s, pixelDiff=${holdDiff.toFixed(5)}).`,
        `Wrap rendering in MVS.renderTimeline() (adds Yoin camera drift automatically) or apply MVS.idleNoise(localT, index) to visual elements.`
      );
    }
  }

  // 7. Reading Time Check on timeline scene text
  if (scene.text) {
    const words = scene.text.trim().split(/\s+/).filter(Boolean).length;
    const minHold = Math.max(1.4, words * 0.3 + 0.5);
    if (scene.duration + 0.05 < minHold) {
      addIssue(
        'WARN',
        'READING_TIME_SHORT',
        `Scene "${scene.id}" shows ${words} words for ${scene.duration.toFixed(2)}s (needs >= ${minHold.toFixed(2)}s).`,
        `Trim text to <= ${Math.max(2, Math.floor((scene.duration - 0.5) / 0.3))} words or extend scene duration to ${minHold.toFixed(1)}s.`
      );
    }
  }

  // 8. Quadrant Visual-Mass Balance (16:9 horizontal composition balance; skipped on intentional minimalist / cinema asymmetrical frames)
  if (!isIntentionalMinimal && width > height && midSample.activeBgDiffRatio > 0.04) {
    const ls = midSample.leftMassShare ?? 0.5;
    if (ls > 0.88 || ls < 0.12) {
      addIssue(
        'WARN',
        'QUADRANT_IMBALANCE',
        `Scene "${scene.id}" packs ${Math.round(Math.max(ls, 1 - ls) * 100)}% of visual mass on the ${ls > 0.5 ? 'LEFT' : 'RIGHT'} half, leaving the opposite side empty.`,
        `Use MVS.shotLayout(safe, 'split-lr' | 'split-rl' | 'bento-command' | 'monumental-payoff') to balance foreground visual weight across the frame.`
      );
    }
  }

  // 9. Intra-Scene 3-Act Temporal Evolution (Early 22% vs Late 84% evolution check)
  if (samples.length >= 4 && scene.duration >= 2.6) {
    const evoDiff = samples[3].earlyVsLateDiff ?? 0;
    const zoomDelta = Math.abs((samples[3].cameraZoom || 1) - (samples[0].cameraZoom || 1));
    const nodeDelta = Math.abs((samples[3].nodes?.length || 0) - (samples[0].nodes?.length || 0));
    if (evoDiff < 0.008 && zoomDelta < 0.03 && nodeDelta === 0) {
      addIssue(
        'WARN',
        'FLAT_TEMPORAL_EVOLUTION',
        `Scene "${scene.id}" shows minimal visual evolution over its ${scene.duration.toFixed(1)}s hold (early→late diff=${evoDiff.toFixed(4)}).`,
        `Add an Act-II secondary beat via MVS.sceneActs(localT, duration): e.g. MVS.withCameraFocus(..., acts.act2Focus, 1.15, ...) or MVS.drawCallout(..., { localT, delay: 1.1 }).`
      );
    }
  }

  // Compute scene horizontal polarity & focal centroid for cross-scene Master Montage checks
  const nonBgVisuals = (midSample.nodes || []).filter(
    (n) => (n.role === 'diagram' || n.role === 'graphic' || n.role === 'card') && n.w * n.h < width * height * 0.80
  );
  const diagramsOnly = nonBgVisuals.filter((n) => n.role === 'diagram' || n.role === 'graphic');
  const pool = diagramsOnly.length ? diagramsOnly : nonBgVisuals;
  const heroVisual = pool.length
    ? pool.reduce((best, cur) => (cur.w * cur.h > best.w * best.h ? cur : best), pool[0])
    : null;
  const gx = heroVisual ? heroVisual.x + heroVisual.w * 0.5 : width * 0.5;
  let polarity = midSample.shotPreset || scene.shot || null;
  if (!polarity) {
    if (heroVisual && gx > width * 0.56) polarity = 'split-lr';
    else if (heroVisual && gx < width * 0.44) polarity = 'split-rl';
    else polarity = 'center-stage';
  }

  sceneReports.push({
    sceneId: scene.id,
    range: `${scene.start.toFixed(2)}s..${(scene.start + scene.duration).toFixed(2)}s`,
    polarity,
    focalX: gx / width,
    rawIssues: issues,
  });
}

// ============================================================================
// CROSS-SCENE MASTER MONTAGE, EYE-TRACE & RHYTHM AUDIT
// ============================================================================
if (sceneReports.length >= 2) {
  for (let i = 1; i < sceneReports.length; i++) {
    const prevSc = scenes[i - 1];
    const curSc = scenes[i];
    const curRep = sceneReports[i];
    const prevRep = sceneReports[i - 1];

    const pushCross = (severity, code, message, fix) => {
      if (curRep.rawIssues.some((x) => x.code === code)) return;
      curRep.rawIssues.push({ severity, code, message, fix });
    };

    // A. Shot Framing / Polarity Monotony (3+ identical left/right splits in a row)
    if (
      i >= 2 &&
      curRep.polarity === prevRep.polarity &&
      curRep.polarity === sceneReports[i - 2].polarity &&
      (curRep.polarity === 'split-lr' || curRep.polarity === 'split-rl')
    ) {
      const alt = curRep.polarity === 'split-lr' ? 'split-rl' : 'split-lr';
      pushCross(
        'BLOCKER',
        'SHOT_POLARITY_MONOTONY',
        `3 consecutive scenes ("${sceneReports[i - 2].sceneId}" → "${prevRep.sceneId}" → "${curRep.sceneId}") repeat the exact same "${curRep.polarity}" framing!`,
        `Alternate shot composition in "${curRep.sceneId}" using MVS.shotLayout(safe, '${alt}') or 'macro-focus' / 'bento-command' / 'monumental-payoff'.`
      );
    }

    // B. Transition Monotony (consecutive identical non-cut transitions)
    const trCur = curSc.transition || 'whip';
    const trPrev = prevSc.transition || 'whip';
    if (i >= 2 && trCur !== 'cut' && trCur === trPrev) {
      pushCross(
        'WARN',
        'TRANSITION_MONOTONY',
        `Scenes "${prevSc.id}" and "${curSc.id}" repeat the same "${trCur}" wipe back-to-back.`,
        `Vary montage transitions semantically across ['cut', 'whip', 'whip-right', 'push-up', 'portal', 'zoom-out', 'iris', 'dissolve'].`
      );
    }

    // C. Consecutive Identical Visual Device
    if (curSc.device && prevSc.device && curSc.device === prevSc.device) {
      pushCross(
        'WARN',
        'DEVICE_REPETITION',
        `Scene "${curSc.id}" repeats the exact same primary visual device ("${curSc.device}") as "${prevSc.id}".`,
        `Choose a distinct visual device for "${curSc.id}" (e.g. drawGlobeWire, drawIsometricStack, drawAreaChart, drawBarChart, drawCodeCard, drawMetricCard, drawActor).`
      );
    }

    // D. Walter Murch Eye-Trace Whiplash across unmotivated hard cut
    if (trCur === 'cut' && Math.abs(curRep.focalX - prevRep.focalX) > 0.56) {
      const sug = curRep.focalX < prevRep.focalX ? 'whip-right' : 'whip';
      pushCross(
        'WARN',
        'EYE_TRACE_WHIPLASH',
        `Hard 'cut' into "${curSc.id}" jumps viewer focal point by ${Math.round(Math.abs(curRep.focalX - prevRep.focalX) * 100)}% of screen width.`,
        `Either use directional transition "${sug}" / "portal" to carry the eye, or align focal anchor closer to x=${Math.round(prevRep.focalX * width)}px.`
      );
    }

    // E. Musical Beat-Grid Alignment (when BPM is set and no VO narration overrides cuts)
    if (timeline?.bpm && !timeline?.audio?.vo && curSc.start > 0.01) {
      const beatSec = 60 / Number(timeline.bpm);
      const nearestBeat = Math.round(curSc.start / beatSec) * beatSec;
      const errMs = Math.abs(curSc.start - nearestBeat) * 1000;
      if (errMs > 68) {
        pushCross(
          'WARN',
          'OFF_BEAT_CUT',
          `Cut into "${curSc.id}" at ${curSc.start.toFixed(2)}s misses the ${timeline.bpm} BPM beat grid by ${Math.round(errMs)}ms.`,
          `Snap scene "${curSc.id}" start to ${nearestBeat.toFixed(2)}s (or half-beat ${(Math.round(curSc.start / (beatSec * 0.5)) * beatSec * 0.5).toFixed(2)}s).`
        );
      }
    }
  }
}

// Finalize per-scene scores after cross-scene montage checks
for (const sr of sceneReports) {
  let penalty = 0;
  for (const iss of sr.rawIssues) {
    if (iss.severity === 'BLOCKER') { penalty += 22; blockerCount++; }
    else penalty += 7;
  }
  sr.score = Math.max(0, 100 - penalty);
  sr.status = sr.rawIssues.some((i) => i.severity === 'BLOCKER') ? 'FAIL' : sr.score >= minScore ? 'CLEAN' : 'NEEDS_POLISH';
  sr.issues = sr.rawIssues.slice(0, 4);
  sr.totalIssueCount = sr.rawIssues.length;
  delete sr.rawIssues;
}

if (runtimeErrors.length > 0) blockerCount += runtimeErrors.length;

const avgScore = sceneReports.length
  ? Math.round(sceneReports.reduce((a, b) => a + b.score, 0) / sceneReports.length)
  : 0;
const globalScore = Math.max(0, avgScore - runtimeErrors.length * 20);
const cleanScenes = sceneReports.filter((s) => s.status === 'CLEAN').map((s) => s.sceneId);
const passed = globalScore >= minScore && blockerCount === 0;
const elapsedMs = Date.now() - tStartWall;

const report = {
  passed,
  iteration: iterNum,
  globalScore,
  threshold: minScore,
  blockerCount,
  elapsedMs,
  resolution: `${width}x${height}@${fps}`,
  runtimeErrors: runtimeErrors.slice(0, 5),
  lockedCleanScenes: cleanScenes,
  scenes: sceneReports,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`=== MVS TELEMETRY COMPILER (Iter #${iterNum} · ${elapsedMs}ms · ${width}x${height}) ===`);
  console.log(`SCORE: ${globalScore}/100 (target >= ${minScore}) · BLOCKERS: ${blockerCount} · VERDICT: ${passed ? 'PASS ✓' : 'REPAIR REQUIRED ✗'}`);
  if (runtimeErrors.length) {
    console.log(`\n[RUNTIME ERRORS]`);
    runtimeErrors.slice(0, 4).forEach((e) => console.log(`  ✗ ${e}`));
  }
  if (cleanScenes.length && !passed) {
    console.log(`\n🔒 LOCKED CLEAN SCENES (DO NOT MODIFY THESE FUNCTIONS — ANTI-REGRESSION LAW): [${cleanScenes.join(', ')}]`);
  }
  for (const sc of sceneReports) {
    const badge = sc.status === 'CLEAN' ? '✓ CLEAN' : sc.status === 'FAIL' ? '✗ FAIL ' : '⚠ WARN ';
    console.log(`\n[${badge}] Scene "${sc.sceneId}" (${sc.range}) — Score ${sc.score}/100`);
    for (const iss of sc.issues) {
      console.log(`  - [${iss.severity}] ${iss.code}: ${iss.message}`);
      console.log(`    ↳ FIX: ${iss.fix}`);
    }
  }
}

process.exit(passed ? 0 : 2);
