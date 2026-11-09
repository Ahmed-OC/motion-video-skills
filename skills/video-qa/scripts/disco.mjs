#!/usr/bin/env node
/**
 * disco.mjs — discontinuity detector for ANY rendered video: finds pops, mono-frame flashes,
 * off-by-one cuts and frozen segments WITHOUT watching it.
 *
 * Reads the video at low resolution in gray, computes the mean absolute difference between
 * consecutive frames, then audits three things:
 *   1. CUTS        every declared cut must produce one spike exactly at its frame;
 *   2. SPIKES      any spike NOT on the cut list = pop, mono-frame flash or encoder drop;
 *   3. FROZEN RUNS long stretches with near-zero motion — legit in slow films, fatal where
 *                  motion is expected (a stuck spring or a NaN-killed element looks frozen).
 *
 * Usage:
 *   node disco.mjs video.mp4
 *   node disco.mjs video.mp4 --cuts "3.0,5.4,7.2,9.0"      # cut list = scene starts (s)
 *   node disco.mjs video.mp4 --cuts "..." --json            # machine-readable
 *   Options: --thresh 8 (spike = diff ≥ thresh × local median) · --floor 1.0 (min diff)
 *            --still 0.02 (frozen threshold) · --minlen 1.0 (frozen run, seconds)
 *            --no-strict (report only, always exit 0)
 * Declared cut times must equal frameIndex / fps (9.0 at 30 fps = frame 270).
 * Exit 1 when the gate fails: a cut landing off its frame (OFF-BY-±n) or producing no
 * discontinuity at all (NO-SPIKE). Off-list spikes are reported as warnings (a fast
 * light change or a stylized whip-transition is intentional) — add --strict-spikes to
 * fail on them too, or --no-strict to always exit 0.
 * Requires ffmpeg + ffprobe on PATH.
 */
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    cuts: { type: 'string' },
    thresh: { type: 'string', default: '8' },
    floor: { type: 'string', default: '1.0' },
    still: { type: 'string', default: '0.02' },
    minlen: { type: 'string', default: '1.0' },
    json: { type: 'boolean', default: false },
    'strict-spikes': { type: 'boolean', default: false },
    'no-strict': { type: 'boolean', default: false },
  },
});
const input = positionals[0];
if (!input) {
  console.error('usage: node disco.mjs video.mp4 [--cuts "3.0,5.4"] [--json] [--strict-spikes | --no-strict]');
  process.exit(1);
}
const THRESH = Number(args.thresh), FLOOR = Number(args.floor);
const STILL = Number(args.still), MINLEN = Number(args.minlen);
const W = 96, H = 170, N = W * H;

// ---- fps from ffprobe ----
const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=r_frame_rate', '-of', 'json', input], { encoding: 'utf8' });
if (pr.error || pr.status !== 0) {
  console.error('✗ ffprobe failed (is ffmpeg on PATH?)\n' + (pr.stderr || pr.error));
  process.exit(1);
}
const [num, den] = JSON.parse(pr.stdout).streams[0].r_frame_rate.split('/').map(Number);
const fps = num / (den || 1);

// ---- frames → gray thumbnails ----
const ff = spawn('ffmpeg', ['-v', 'error', '-i', input,
  '-vf', `scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
const chunks = [];
ff.stdout.on('data', (d) => chunks.push(d));
let ffErr = '';
ff.stderr.on('data', (d) => { ffErr += d; });
const code = await new Promise((res) => ff.on('close', res));
if (code !== 0) { console.error('✗ ffmpeg failed\n' + ffErr.slice(-1500)); process.exit(1); }
const buf = Buffer.concat(chunks);
const frames = Math.floor(buf.length / N);

// diff[i] = mean |frame i − frame i−1|  →  a cut AT frame c shows as a spike at diff[c]
const diff = new Float64Array(frames);
for (let i = 1; i < frames; i++) {
  let s = 0;
  const a = i * N, b = (i - 1) * N;
  for (let k = 0; k < N; k++) s += Math.abs(buf[a + k] - buf[b + k]);
  diff[i] = s / N;
}
const median = (arr) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const localMedian = (i) => {
  const nb = [];
  for (let j = Math.max(1, i - 6); j <= Math.min(frames - 1, i + 6); j++) if (j !== i) nb.push(diff[j]);
  return median(nb);
};
const t = (i) => +(i / fps).toFixed(3);

// ---- 1. cut audit ----
const cutSecs = (args.cuts || '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);
const cutFrames = cutSecs.map((s) => Math.round(s * fps));
const cuts = cutSecs.map((sec, n) => {
  const c = cutFrames[n];
  let best = c, bestV = -1;
  for (let j = Math.max(1, c - 3); j <= Math.min(frames - 1, c + 3); j++) {
    if (diff[j] > bestV) { bestV = diff[j]; best = j; }
  }
  const isSpike = bestV >= FLOOR;   // a match cut can be low-contrast: landing on the frame is what counts
  const delta = best - c;
  const status = !isSpike ? 'NO-SPIKE' : delta === 0 ? 'EXACT' : `OFF-BY-${delta > 0 ? '+' : ''}${delta}`;
  return { sec, expectedFrame: c, landedFrame: best, delta, diff: +bestV.toFixed(2), status };
});

// ---- 2. off-list spikes (warnings: fast light changes / stylized transitions are intentional) ----
const nearCut = (i) => cutFrames.some((c) => Math.abs(i - c) <= 3);
const spikes = [];
for (let i = 1; i < frames; i++) {
  if (nearCut(i)) continue;
  const ratio = diff[i] / (localMedian(i) + 0.05);
  if (diff[i] >= FLOOR && ratio >= THRESH) spikes.push({ frame: i, t: t(i), diff: +diff[i].toFixed(2), ratio: +ratio.toFixed(1) });
}
spikes.sort((a, b) => b.ratio - a.ratio);

// ---- 3. frozen runs ----
const frozen = [];
for (let i = 1; i < frames;) {
  if (diff[i] >= STILL) { i++; continue; }
  let j = i;
  while (j + 1 < frames && diff[j + 1] < STILL) j++;
  const dur = (j - i + 2) / fps;
  if (dur >= MINLEN) frozen.push({ from: t(i - 1), to: t(j), seconds: +dur.toFixed(2) });
  i = j + 1;
}

const badCuts = cuts.filter((c) => c.status !== 'EXACT');
const fail = args['strict-spikes'] ? (badCuts.length > 0 || spikes.length > 0) : badCuts.length > 0;
const report = { input, fps, frames, cuts, spikes: spikes.slice(0, 25), frozen, gate: fail ? 'FAIL' : 'PASS' };

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`${input} — ${frames} frames @ ${fps.toFixed(2)} fps`);
  if (cuts.length) {
    console.log(`CUTS (${cuts.length} declared)`);
    for (const c of cuts) console.log(`  ${c.sec.toFixed(3).padStart(8)}s  f${String(c.expectedFrame).padEnd(6)} ${c.status.padEnd(10)} diff ${c.diff}`);
  } else {
    console.log('CUTS — none declared (pass --cuts: without the cut list, the gate only reports spikes)');
  }
  console.log(spikes.length ? `OFF-LIST SPIKES (${spikes.length})${args['strict-spikes'] ? '' : ' — warnings: fast light changes / stylized transitions'}:` : 'OFF-LIST SPIKES — none');
  for (const s of spikes.slice(0, 15)) console.log(`  f${s.frame}  t=${s.t}s  diff ${s.diff}  ×${s.ratio} local median`);
  console.log(frozen.length ? `FROZEN RUNS ≥ ${MINLEN}s — review: is motion expected here?` : `FROZEN RUNS ≥ ${MINLEN}s — none`);
  for (const f of frozen) console.log(`  ${f.from}s → ${f.to}s (${f.seconds}s)`);
  console.log(`GATE: ${report.gate}${fail ? ` (${badCuts.length} cut issue(s)${args['strict-spikes'] ? `, ${spikes.length} off-list spike(s)` : ''})` : ''}`);
}
process.exit(fail && !args['no-strict'] ? 1 : 0);
