#!/usr/bin/env node
/**
 * fetch_assets.mjs v3.0 — Universal Multi-Universe Zero-Key Asset Fetcher & Video Frame Extractor.
 *
 * Gives agents real studio photography, historical archives, museum paintings, NASA HD plates,
 * PolyHaven 3D HDRIs & PBR textures, vector icons/logos/illustrations, and deterministic
 * FFmpeg video-frame sequences — 100% offline-cached for `window.seek(t)`!
 *
 * Examples:
 *   # Documentary / History / Journalism (Wikimedia Commons HD + Art Institute CC0 IIIF)
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --wikimedia "Wright brothers,Concorde" --bundle
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --art "Great Wave Hokusai" --bundle
 *
 *   # Science / Cinema / Space (Official NASA Image Library HD, zero key)
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --nasa "Apollo 11 moonwalk,Carina Nebula" --bundle
 *
 *   # Photorealistic 3D Studio (PolyHaven CC0 HDRI lighting + 2K PBR textures, zero key)
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --polyhaven-hdri studio_small_09
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --polyhaven-tex aerial_rocks_02
 *
 *   # Hybrid Cinema HD (Extract real/AI video clip into frame-exact sequence for seek(t))
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --extract-video footage.mp4 --fps 30
 *
 *   # Vector & Maps (Iconify, SVGL/SimpleIcons, unDraw, DiceBear CC0, Natural Earth TopoJSON)
 *   node skills/motion-video/scripts/fetch_assets.mjs --out video/assets --icon ph:compass-duotone --world-map --bundle
 */
import { parseArgs } from 'node:util';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: 'video/assets' },
    icon: { type: 'string' },
    searchIcon: { type: 'string' },
    logo: { type: 'string' },
    undraw: { type: 'string' },
    avatar: { type: 'string' },
    wikimedia: { type: 'string' },
    nasa: { type: 'string' },
    art: { type: 'string' },
    'polyhaven-hdri': { type: 'string' },
    'polyhaven-tex': { type: 'string' },
    'extract-video': { type: 'string' },
    fps: { type: 'string', default: '30' },
    width: { type: 'string', default: '1600' },
    color: { type: 'string', default: '#F8FAFC' },
    accent: { type: 'string', default: '#38BDF8' },
    'world-map': { type: 'boolean', default: false },
    bundle: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (args.help) {
  console.log(`Usage: fetch_assets.mjs [--out video/assets] [--bundle]
  --- Realism, Cinema, History & Fine Art (Zero API Key) ---
  --wikimedia <q1,q2>        Download HD historical/documentary photos from Wikimedia Commons
  --nasa <q1,q2>             Download official HD space/earth/science plates from NASA Image Library
  --art <q1,q2>              Download Public Domain CC0 HD museum art via Art Institute of Chicago IIIF
  --extract-video <mp4>      Extract deterministic frame sequence (f_00001.jpg...) via FFmpeg (--fps 30)

  --- Photorealistic 3D PBR & Studio Lighting (Zero API Key) ---
  --polyhaven-hdri <id>      Download CC0 2K .hdr environment lighting map (e.g. studio_small_09, royal_esplanade)
  --polyhaven-tex <id>       Download CC0 1K PBR texture set (diff/rough/nor_gl) from PolyHaven

  --- Vector, Editorial, Brand & Cartography (Zero API Key) ---
  --searchIcon <query>       Search 200k Iconify icons (lucide, ph, solar, tabler)
  --icon <prefix:name,...>   Download colorized Iconify SVG(s)
  --logo <brand,...>         Download official SVG brand logos via SVGL / SimpleIcons
  --undraw <keyword>         Download unDraw vector illustration recolored to --accent
  --avatar <style:seed>      Download CC0 DiceBear character SVG (open-peeps:Felix, notionists:Maya)
  --world-map                Download Natural Earth 110m countries TopoJSON

  --bundle                   Also generate assets-bundle.js (window.__MVS_ASSETS__ data-URIs for zero-CORS file://)`);
  process.exit(0);
}

const outDir = path.resolve(args.out);
mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, 'assets-manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
const UA = 'MotionVideoSkillsStudio/3.0 (https://github.com/Ahmed-OC/motion-video-skills; open-source creative tool)';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const forceHttps = (u) => String(u).replace(/^http:\/\//i, 'https://');

async function fetchText(url) {
  const safeUrl = forceHttps(url);
  const res = await fetch(safeUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${safeUrl}`);
  return res.text();
}

async function fetchJson(url) {
  const safeUrl = forceHttps(url);
  const res = await fetch(safeUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${safeUrl}`);
  return res.json();
}

async function fetchBinary(url) {
  const safeUrl = forceHttps(url);
  const res = await fetch(safeUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${safeUrl}`);
  return Buffer.from(await res.arrayBuffer());
}

function recordAsset(entry) {
  const idx = manifest.findIndex((m) => m.key === entry.key);
  if (idx >= 0) manifest[idx] = entry;
  else manifest.push(entry);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// 1. Wikimedia Commons HD Documentary & Historical Photography
if (args.wikimedia) {
  const targetW = Number(args.width) || 1600;
  for (const query of args.wikimedia.split(',').map((s) => s.trim()).filter(Boolean)) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=${targetW}&format=json&origin=*`;
    const data = await fetchJson(api);
    const pages = Object.values(data?.query?.pages || {});
    const valid = pages
      .map((p) => ({ title: p.title, info: p.imageinfo?.[0] }))
      .filter((x) => x.info && /image\/(jpeg|png|webp)/.test(x.info.mime) && x.info.width >= 700)
      .sort((a, b) => (b.info.width || 0) - (a.info.width || 0));

    if (!valid.length) {
      console.warn(`⚠ No HD Wikimedia Commons bitmap found for "${query}"`);
      continue;
    }
    const best = valid[0];
    const dlUrl = best.info.thumburl || best.info.url;
    const ext = best.info.mime.includes('png') ? 'png' : 'jpg';
    const key = `wiki_${slugify(query)}`;
    const file = path.join(outDir, `${key}.${ext}`);
    const buf = await fetchBinary(dlUrl);
    writeFileSync(file, buf);
    const artist = (best.info.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim();
    const license = best.info.extmetadata?.LicenseShortName?.value || 'Wikimedia Commons';
    recordAsset({ type: 'photo-archive', key, query, title: best.title, license, artist, file, mime: best.info.mime });
    console.log(`✓ wikimedia "${query}" (${(buf.length / 1024).toFixed(0)} KB · ${license}) -> ${file}`);
  }
}

// 2. Official NASA Image Library HD Plates
if (args.nasa) {
  for (const query of args.nasa.split(',').map((s) => s.trim()).filter(Boolean)) {
    const api = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=5`;
    const data = await fetchJson(api);
    const items = data?.collection?.items || [];
    const hit = items.find((it) => it.links?.[0]?.href);
    if (!hit) {
      console.warn(`⚠ No NASA image found for "${query}"`);
      continue;
    }
    let imgUrl = hit.links[0].href;
    try {
      const assetList = await fetchJson(hit.href);
      const mediumOrLarge = assetList.find((u) => /~large\.jpg$/i.test(u)) || assetList.find((u) => /~medium\.jpg$/i.test(u)) || assetList.find((u) => /\.jpg$/i.test(u));
      if (mediumOrLarge) imgUrl = mediumOrLarge;
    } catch {}
    const key = `nasa_${slugify(query)}`;
    const file = path.join(outDir, `${key}.jpg`);
    const buf = await fetchBinary(imgUrl);
    writeFileSync(file, buf);
    const title = hit.data?.[0]?.title || query;
    recordAsset({ type: 'nasa-hd', key, query, title, license: 'Public Domain (NASA)', file, mime: 'image/jpeg' });
    console.log(`✓ nasa "${title}" (${(buf.length / 1024).toFixed(0)} KB) -> ${file}`);
  }
}

// 3. Metropolitan Museum of Art CC0 Open Access (+ Wikimedia Fine Art fallback)
if (args.art) {
  for (const query of args.art.split(',').map((s) => s.trim()).filter(Boolean)) {
    let downloaded = false;
    try {
      const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?isPublicDomain=true&hasImages=true&q=${encodeURIComponent(query)}`;
      const sData = await fetchJson(searchUrl);
      const ids = (sData?.objectIDs || []).slice(0, 5);
      for (const objId of ids) {
        const obj = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${objId}`);
        const imgUrl = obj?.primaryImageSmall || obj?.primaryImage;
        if (!imgUrl) continue;
        const key = `art_${slugify(query)}`;
        const file = path.join(outDir, `${key}.jpg`);
        const buf = await fetchBinary(imgUrl);
        writeFileSync(file, buf);
        recordAsset({
          type: 'fine-art-cc0',
          key,
          query,
          title: obj.title,
          artist: obj.artistDisplayName,
          date: obj.objectDate,
          license: 'CC0 Public Domain (The Met Open Access)',
          file,
          mime: 'image/jpeg',
        });
        console.log(`✓ art "${obj.title}" (${obj.objectDate || 'CC0'} · ${(buf.length / 1024).toFixed(0)} KB) -> ${file}`);
        downloaded = true;
        break;
      }
    } catch {}
    if (!downloaded) {
      // Fallback to Wikimedia Commons high-res museum scan
      const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query + ' painting filetype:bitmap')}&gsrlimit=3&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1400&format=json&origin=*`;
      const wData = await fetchJson(api);
      const hit = Object.values(wData?.query?.pages || {}).map((p) => ({ title: p.title, info: p.imageinfo?.[0] })).find((x) => x.info?.thumburl);
      if (hit) {
        const key = `art_${slugify(query)}`;
        const file = path.join(outDir, `${key}.jpg`);
        const buf = await fetchBinary(hit.info.thumburl);
        writeFileSync(file, buf);
        recordAsset({ type: 'fine-art-cc0', key, query, title: hit.title, license: 'Public Domain (Wikimedia)', file, mime: 'image/jpeg' });
        console.log(`✓ art "${hit.title}" (${(buf.length / 1024).toFixed(0)} KB) -> ${file}`);
      } else {
        console.warn(`⚠ No CC0 artwork found for "${query}"`);
      }
    }
  }
}

// 4. PolyHaven CC0 3D Studio HDRI (.hdr) & PBR Texture Sets
if (args['polyhaven-hdri']) {
  for (const id of args['polyhaven-hdri'].split(',').map((s) => s.trim()).filter(Boolean)) {
    const files = await fetchJson(`https://api.polyhaven.com/files/${encodeURIComponent(id)}`);
    const hdrUrl = files?.hdri?.['2k']?.hdr?.url || files?.hdri?.['1k']?.hdr?.url;
    if (!hdrUrl) {
      console.warn(`⚠ PolyHaven HDRI "${id}" not found`);
      continue;
    }
    const file = path.join(outDir, `hdri-${id}.hdr`);
    const buf = await fetchBinary(hdrUrl);
    writeFileSync(file, buf);
    recordAsset({ type: 'hdri-cc0', key: `hdri_${slugify(id)}`, id, license: 'CC0 (PolyHaven)', file, mime: 'image/vnd.radiance' });
    console.log(`✓ polyhaven HDRI "${id}" (${(buf.length / 1024).toFixed(0)} KB) -> ${file}`);
  }
}

if (args['polyhaven-tex']) {
  for (const id of args['polyhaven-tex'].split(',').map((s) => s.trim()).filter(Boolean)) {
    const files = await fetchJson(`https://api.polyhaven.com/files/${encodeURIComponent(id)}`);
    for (const ch of ['Diffuse', 'Rough', 'nor_gl']) {
      const node = files?.[ch]?.['1k']?.jpg || files?.[ch]?.['1k']?.png;
      if (!node?.url) continue;
      const ext = node.url.endsWith('.png') ? 'png' : 'jpg';
      const file = path.join(outDir, `pbr-${id}-${ch.toLowerCase()}.${ext}`);
      const buf = await fetchBinary(node.url);
      writeFileSync(file, buf);
      recordAsset({ type: 'pbr-map-cc0', key: `pbr_${slugify(id)}_${ch.toLowerCase()}`, id, channel: ch, license: 'CC0 (PolyHaven)', file });
      console.log(`✓ polyhaven PBR "${id}" [${ch}] -> ${file}`);
    }
  }
}

// 5. Hybrid Cinema Video-to-Deterministic-Frames Extractor (FFmpeg)
if (args['extract-video']) {
  const srcVid = path.resolve(args['extract-video']);
  const seqSlug = slugify(path.basename(srcVid, path.extname(srcVid)));
  const seqDir = path.join(outDir, `seq_${seqSlug}`);
  mkdirSync(seqDir, { recursive: true });
  const fpsVal = Number(args.fps) || 30;
  const r = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', srcVid,
    '-vf', `fps=${fpsVal},scale='min(1920,iw)':-2`,
    '-q:v', '3',
    path.join(seqDir, 'f_%05d.jpg'),
  ], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`FFmpeg frame extraction failed: ${r.stderr}`);
  }
  const count = readdirSync(seqDir).filter((f) => f.startsWith('f_')).length;
  recordAsset({ type: 'video-sequence', key: `seq_${seqSlug}`, fps: fpsVal, frames: count, dir: seqDir });
  console.log(`✓ video sequence "${seqSlug}" (${count} frames @ ${fpsVal}fps) -> ${seqDir}`);
}

// 6. Vector Icons, Brand Logos, Illustrations, Characters & World Map
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
    const key = `icon_${slugify(`${prefix}_${name}`)}`;
    const file = path.join(outDir, `icon-${prefix}-${name}.svg`);
    writeFileSync(file, svg);
    recordAsset({ type: 'icon', key, id: `${prefix}:${name}`, file, mime: 'image/svg+xml' });
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
    const key = `logo_${slugify(slug)}`;
    const file = path.join(outDir, `logo-${slug}.svg`);
    writeFileSync(file, svg);
    recordAsset({ type: 'logo', key, id: slug, file, mime: 'image/svg+xml' });
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
    const slug = slugify(args.undraw);
    const key = `undraw_${slug}`;
    const file = path.join(outDir, `undraw-${slug}.svg`);
    writeFileSync(file, svg);
    recordAsset({ type: 'illustration', key, id: hit.title || slug, file, mime: 'image/svg+xml' });
    console.log(`✓ unDraw "${hit.title}" -> ${file}`);
  }
}

if (args.avatar) {
  const [style, seed] = args.avatar.includes(':') ? args.avatar.split(':') : ['open-peeps', args.avatar];
  const svg = await fetchText(`https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`);
  const key = `avatar_${slugify(`${style}_${seed}`)}`;
  const file = path.join(outDir, `avatar-${style}-${seed}.svg`);
  writeFileSync(file, svg);
  recordAsset({ type: 'avatar', key, id: `${style}:${seed}`, file, mime: 'image/svg+xml' });
  console.log(`✓ avatar -> ${file}`);
}

if (args['world-map']) {
  const topo = await fetchText('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json');
  const file = path.join(outDir, 'countries-110m.json');
  writeFileSync(file, topo);
  recordAsset({ type: 'map', key: 'world_map_110m', id: 'countries-110m', file, mime: 'application/json' });
  console.log(`✓ world-map -> ${file}`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Optional Data-URI Bundle (`assets-bundle.js`) so file:// Chromium pages load HD photos/SVGs with ZERO CORS!
if (args.bundle) {
  const bundleObj = {};
  for (const item of manifest) {
    if (!item.file || !existsSync(item.file)) continue;
    const ext = path.extname(item.file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext)) continue;
    const mime = item.mime || (ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg');
    const b64 = readFileSync(item.file).toString('base64');
    bundleObj[item.key] = `data:${mime};base64,${b64}`;
  }
  const bundleJs = `// Auto-generated by fetch_assets.mjs --bundle (zero-CORS offline asset pack)\nwindow.__MVS_ASSETS__ = Object.assign(window.__MVS_ASSETS__ || {}, ${JSON.stringify(bundleObj, null, 2)});\n`;
  const bundlePath = path.join(outDir, 'assets-bundle.js');
  writeFileSync(bundlePath, bundleJs);
  console.log(`✓ zero-CORS bundle (${Object.keys(bundleObj).length} assets) -> ${bundlePath}`);
}
