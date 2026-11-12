#!/usr/bin/env node
/**
 * fetch_assets.mjs — Zero-Key Deterministic Visual Asset Fetcher for Motion Video Agents.
 *
 * Downloads & normalizes real vector icons, tech brand logos, recolored illustrations,
 * CC0 character SVGs, and Natural Earth world maps into local project `assets/` so
 * `seek(t)` pages render 100% offline, CORS-free, and deterministically!
 *
 * Examples:
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --icon ph:globe-hemisphere-west-duotone --color "#38BDF8"
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --logo docker,kubernetes,typescript
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --undraw submarine --accent "#FF4D00"
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --avatar open-peeps:Aiman
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --world-map
 */
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: 'video/assets' },
    icon: { type: 'string' },
    searchIcon: { type: 'string' },
    logo: { type: 'string' },
    undraw: { type: 'string' },
    avatar: { type: 'string' },
    color: { type: 'string', default: '#F8FAFC' },
    accent: { type: 'string', default: '#38BDF8' },
    'world-map': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (args.help) {
  console.log(`Usage: fetch_assets.mjs [--out video/assets]
  --searchIcon <query>     Search 200k Iconify icons (lucide, ph, solar, tabler)
  --icon <prefix:name,...> Download colorized Iconify SVG(s), e.g. ph:rocket-duotone,lucide:cpu
  --logo <brand,...>       Download official SVG brand logos via SVGL / SimpleIcons
  --undraw <keyword>       Search & download top unDraw vector scene recolored to --accent
  --avatar <style:seed>    Download CC0 DiceBear v10 character SVG (open-peeps:Felix, notionists:Maya)
  --world-map              Download Natural Earth 110m countries TopoJSON (107 KB)`);
  process.exit(0);
}

const outDir = path.resolve(args.out);
mkdirSync(outDir, { recursive: true });
const manifest = [];

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'motion-video-skills/2.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'motion-video-skills/2.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

if (args.searchIcon) {
  const q = encodeURIComponent(args.searchIcon);
  const data = await fetchJson(`https://api.iconify.design/search?query=${q}&limit=32&prefixes=ph,lucide,solar,tabler,fluent-emoji-flat`);
  console.log(`Iconify matches for "${args.searchIcon}":\n  ` + (data.icons || []).slice(0, 20).join(', '));
}

if (args.icon) {
  for (const raw of args.icon.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [prefix, name] = raw.includes(':') ? raw.split(':') : ['lucide', raw];
    const col = encodeURIComponent(args.color);
    const svg = await fetchText(`https://api.iconify.design/${prefix}/${name}.svg?color=${col}&width=256`);
    const file = path.join(outDir, `icon-${prefix}-${name}.svg`);
    writeFileSync(file, svg);
    manifest.push({ type: 'icon', id: `${prefix}:${name}`, file });
    console.log(`✓ icon -> ${file}`);
  }
}

if (args.logo) {
  for (const slug of args.logo.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    let svg = null;
    try {
      const hits = await fetchJson(`https://api.svgl.app?search=${encodeURIComponent(slug)}`);
      if (Array.isArray(hits) && hits.length > 0) {
        const route = hits[0].route;
        const svgUrl = typeof route === 'string' ? route : (route?.dark || route?.light);
        if (svgUrl) svg = await fetchText(svgUrl);
      }
    } catch {}
    if (!svg) {
      svg = await fetchText(`https://cdn.simpleicons.org/${slug}/${args.color.replace('#', '')}`);
    }
    const file = path.join(outDir, `logo-${slug}.svg`);
    writeFileSync(file, svg);
    manifest.push({ type: 'logo', id: slug, file });
    console.log(`✓ logo -> ${file}`);
  }
}

if (args.undraw) {
  const data = await fetchJson(`https://undraw.co/api/search?q=${encodeURIComponent(args.undraw)}`);
  const hit = data?.results?.[0];
  if (!hit?.media) {
    console.warn(`⚠ No unDraw illustration found for "${args.undraw}"`);
  } else {
    let svg = await fetchText(hit.media);
    svg = svg.replace(/#6c63ff/gi, args.accent);
    const slug = args.undraw.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const file = path.join(outDir, `undraw-${slug}.svg`);
    writeFileSync(file, svg);
    manifest.push({ type: 'illustration', id: hit.title || slug, file });
    console.log(`✓ unDraw "${hit.title}" -> ${file}`);
  }
}

if (args.avatar) {
  const [style, seed] = args.avatar.includes(':') ? args.avatar.split(':') : ['open-peeps', args.avatar];
  const svg = await fetchText(`https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`);
  const file = path.join(outDir, `avatar-${style}-${seed}.svg`);
  writeFileSync(file, svg);
  manifest.push({ type: 'avatar', id: `${style}:${seed}`, file });
  console.log(`✓ avatar -> ${file}`);
}

if (args['world-map']) {
  const topo = await fetchText('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json');
  const file = path.join(outDir, 'countries-110m.json');
  writeFileSync(file, topo);
  manifest.push({ type: 'map', id: 'countries-110m', file });
  console.log(`✓ world-map -> ${file}`);
}

if (manifest.length) {
  const mfPath = path.join(outDir, 'assets-manifest.json');
  writeFileSync(mfPath, JSON.stringify(manifest, null, 2));
}
