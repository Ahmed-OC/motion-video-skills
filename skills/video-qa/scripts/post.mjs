#!/usr/bin/env node
/**
 * post.mjs — finishing pass for a rendered video: audio to a target loudness WITHOUT
 * pumping, optional color-matrix tagging, faststart. The video stream is copied (seconds,
 * zero quality loss); only the audio is re-encoded.
 *
 * Usage:
 *   node post.mjs in.mp4 out.mp4                                   # −14 LUFS, linear
 *   node post.mjs in.mp4 out.mp4 --gain 9.6dB --limit 0.70         # quiet synth mix
 *   node post.mjs in.mp4 out.mp4 --matrix 601                      # tag BT.601 (canvas renders)
 *   Options: --loud -14 (integrated LUFS) · --tp -1.5 (true peak dBTP)
 *
 * Why each step:
 *  - Single-pass loudnorm is DYNAMIC: it breathes/pumps on sustained material. This runs
 *    2 passes and applies LINEAR normalization from measured values.
 *  - Linear mode can't add much gain under a true-peak ceiling: a quiet mix (WebAudio synth
 *    renders often sit near −23 LUFS) first gets a pre-gain, with a limiter that only
 *    touches transients (--gain + --limit), then the linear pass lands it exactly.
 *  - --matrix tags the stream WITHOUT re-encoding. Canvas→x264 pipelines convert RGB→YUV in
 *    BT.601 and rarely label it; HD players then assume BT.709 and every hue shifts.
 *    Tag what the encoder actually did (601 = smpte170m, 709 = bt709). Check it once: decode
 *    a known frame both ways and compare against the source RGB.
 * Requires ffmpeg + ffprobe on PATH.
 */
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

// Normalize negative numeric flag values (`--loud -14` -> `--loud=-14`) so Node parseArgs never throws
const normArgv = [];
const rawArgv = process.argv.slice(2);
for (let i = 0; i < rawArgv.length; i++) {
  if ((rawArgv[i] === '--loud' || rawArgv[i] === '--tp' || rawArgv[i] === '--gain') && rawArgv[i + 1] && /^-\d/.test(rawArgv[i + 1])) {
    normArgv.push(`${rawArgv[i]}=${rawArgv[i + 1]}`);
    i++;
  } else {
    normArgv.push(rawArgv[i]);
  }
}

const { values: args, positionals } = parseArgs({
  args: normArgv,
  allowPositionals: true,
  options: {
    gain: { type: 'string' },
    limit: { type: 'string' },
    matrix: { type: 'string' },
    loud: { type: 'string', default: '-14' },
    tp: { type: 'string', default: '-1.5' },
  },
});
const [input, output] = positionals;
if (!input || !output) {
  console.error('usage: node post.mjs in.mp4 out.mp4 [--gain 9.6dB] [--limit 0.70] [--matrix 601|709] [--loud -14]');
  process.exit(1);
}
if (input === output) {
  console.error('✗ write to a new file (ffmpeg cannot read and overwrite the same file)');
  process.exit(1);
}
const MATRIX = { 601: [6, 6, 6], 709: [1, 1, 1] };
if (args.matrix && !MATRIX[args.matrix]) { console.error('✗ --matrix must be 601 or 709'); process.exit(1); }

const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error || r.status !== 0) { console.error(`✗ ${cmd} failed\n${(r.stderr || String(r.error)).slice(-2000)}`); process.exit(1); }
  return r;
};
const hasAudio = run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', input]).stdout.trim() !== '';

const videoArgs = ['-c:v', 'copy'];
if (args.matrix) {
  const [p, tr, m] = MATRIX[args.matrix];
  videoArgs.push('-bsf:v', `h264_metadata=colour_primaries=${p}:transfer_characteristics=${tr}:matrix_coefficients=${m}:video_full_range_flag=0`);
}

let audioArgs = ['-an'];
if (hasAudio) {
  const pre = [args.gain && `volume=${args.gain}`,
    args.limit && `alimiter=limit=${args.limit}:attack=4:release=60:level=disabled`].filter(Boolean);
  const base = `loudnorm=I=${args.loud}:TP=${args.tp}:LRA=11`;
  const measure = run('ffmpeg', ['-hide_banner', '-i', input, '-af', [...pre, `${base}:print_format=json`].join(','), '-f', 'null', '-']);
  const m = JSON.parse(measure.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const linear = `${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`;
  audioArgs = ['-af', [...pre, linear].join(','), '-ar', '48000', '-c:a', 'aac', '-b:a', '192k'];
}

const r = run('ffmpeg', ['-hide_banner', '-y', '-i', input, '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
  ...videoArgs, ...audioArgs, '-movflags', '+faststart', output]);
for (const line of r.stderr.split('\n')) {
  if (/Normalization Type|Output Integrated|Output True Peak/.test(line)) console.log(line.trim());
}
if (hasAudio && /Normalization Type:\s*Dynamic/.test(r.stderr)) {
  console.log('⚠ fell back to DYNAMIC normalization (target unreachable linearly) — raise --gain and add --limit');
}
console.log(`✓ ${output}${args.matrix ? ` (tagged BT.${args.matrix})` : ''}${hasAudio ? '' : ' (no audio stream)'}`);
