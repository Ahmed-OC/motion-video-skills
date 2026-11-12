/**
 * motion-kit.js (v2.0) — Universal Deterministic Motion Studio & Small-Model Scaffolding SDK
 * Part of motion-video-skills (https://github.com/Ahmed-OC/motion-video-skills)
 *
 * 100% pure function of `t` (seek-safe, zero rAF/Date.now/Math.random).
 * Exposes `window.MVS` globally (and CommonJS/ESM compatible).
 *
 * Includes:
 *  1. Studio Physics: 3-regime analytical spring (energy-clamped, zero NaN), Apple perceptual
 *     spring, C1 additive retargeting, Newton-Raphson cubicBezier, JP/KR/US studio easings,
 *     golden-ratio aperiodic idleNoise, logarithmic zoom, C1 velocity match-cuts, area-preserving
 *     squash & stretch.
 *  2. Perceptual Color Science: OKLCH -> sRGB (Björn Ottosson), mud-free mixOklch, Kurzgesagt
 *     cool-shadow / warm-highlight generator, 12 curated Studio Themes.
 *  3. Collision-Free Auto-Layout & Optical Typography: SafeZones (16:9 broadcast + 2026 9:16
 *     L-shaped social safe envelope), vstack / hstack / bentoGrid / splitStage, 7-step binary
 *     search drawTextAutoFit + DP balanced line wrapping (Latin + CJK + FR punctuation safe),
 *     Lead-Opacity Law entrances, optical ink-box centering, tabular-nums.
 *  4. Multi-Genre Visual Primitives: 6 WebGL2 procedural shaders (anti-banding + fwidth anti-moiré),
 *     smooth area/line & bar charts with live scrub readouts, 2.5D exploded isometric stacks (CN),
 *     luminous Bézier flow beams (流光), Japanese FUI HUD hairlines, code/terminal cards,
 *     procedural orthographic globe, articulated actors, smart word-pop captions (auto-dedup).
 *  5. Zero-Key CORS-Safe Asset Preloader (Iconify SVG/paths, SVGL, Simple Icons, unDraw recolor).
 *  6. Warm Studio WebAudio Synthesizer (Paul Kellet pink noise, Neo-Soul chords with -4.5dB vocal
 *     carve, felt kick, shaker, Foley whoosh/click/riser/impact).
 *  7. Universal Telemetry Hook (`window.__MVS_TELEMETRY__`): intercepts Canvas2D text/shapes
 *     (projected through ctx.getTransform()), traps NaN/Infinity calls, and scans DOM/SVG AABBs
 *     for `<2s` headless self-repair via `audit_telemetry.mjs`.
 */
(function (root) {
  'use strict';

  const PHI = 1.618033988749895;
  const SQRT2 = 1.4142135623730951;
  const GOLDEN_ANGLE = 2.399963229728653;

  // ============================================================================
  // 1. DETERMINISTIC PRNG & MATH HELPERS
  // ============================================================================
  function clamp(v, lo = 0, hi = 1) {
    if (!Number.isFinite(v)) return lo;
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  function remap(v, in0, in1, out0 = 0, out1 = 1) {
    if (Math.abs(in1 - in0) < 1e-9) return out1;
    return out0 + (out1 - out0) * clamp((v - in0) / (in1 - in0), 0, 1);
  }

  function mulberry32(seed = 0x2026cafe) {
    let s = seed >>> 0;
    return function rand() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashFloat(seed, index = 0) {
    const r = mulberry32(((seed | 0) * 2654435761 + (index | 0) * 1597334677) >>> 0);
    r();
    return r();
  }

  // ============================================================================
  // 2. STUDIO PHYSICS: CUBIC-BEZIER SOLVER, 3-REGIME SPRINGS & CAMERA LAWS
  // ============================================================================
  function cubicBezier(x1, y1, x2, y2) {
    if (x1 === y1 && x2 === y2) return (t) => clamp(t, 0, 1);
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sampleX = (u) => ((ax * u + bx) * u + cx) * u;
    const sampleY = (u) => ((ay * u + by) * u + cy) * u;
    const sampleDX = (u) => (3 * ax * u + 2 * bx) * u + cx;

    return function ease(t) {
      if (!Number.isFinite(t) || t <= 0) return 0;
      if (t >= 1) return 1;
      let u = t;
      for (let i = 0; i < 5; i++) {
        const err = sampleX(u) - t;
        if (Math.abs(err) < 1e-6) return sampleY(u);
        const dx = sampleDX(u);
        if (Math.abs(dx) < 1e-6) break;
        u -= err / dx;
      }
      let lo = 0;
      let hi = 1;
      u = clamp(u, 0, 1);
      for (let i = 0; i < 12; i++) {
        const x = sampleX(u);
        if (Math.abs(x - t) < 1e-6) break;
        if (t > x) lo = u;
        else hi = u;
        u = 0.5 * (lo + hi);
      }
      return sampleY(u);
    };
  }

  const EASE = {
    kireOut: cubicBezier(0.06, 0.88, 0.12, 1.0),       // JP Moji-PV sharp snap + glide
    circOutYoin: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.sqrt(1 - (t - 1) * (t - 1))),
    expoOut: cubicBezier(0.16, 1.0, 0.3, 1.0),         // Noble hero arrival
    tameTsume: cubicBezier(0.86, 0.0, 0.08, 1.0),      // Sakuga hold -> whip -> fine settle
    studioInOut: cubicBezier(0.76, 0.0, 0.16, 1.0),    // Buck / Ordinary Folk (v_peak = 5x v_avg)
    appleCam: cubicBezier(0.45, 0.0, 0.2, 1.0),        // Apple Keynote camera median
    uiSnapOut: cubicBezier(0.22, 1.0, 0.36, 1.0),      // Linear / Stripe crisp micro-UI
    backOutSubtle: cubicBezier(0.34, 1.32, 0.64, 1.0), // Controlled badge pop (never rubbery)
    quadInExact: cubicBezier(1 / 3, 0.0, 2 / 3, 1 / 3), // True y = t^2 (fixes broken v1 curve)
  };

  /**
   * Exact 3-regime analytical spring (underdamped, critical, overdamped without cosh overflow).
   * Clamps ONLY when total normalized energy |1 - pos| + |vel|/w0 < 0.0004 (never freezes mid-flight at 1.0!).
   */
  function spring(t, f0 = 2.8, zeta = 0.78, v0 = 0) {
    if (!Number.isFinite(t) || t <= 0) return 0;
    const safeF0 = Math.max(0.05, Number.isFinite(f0) ? f0 : 2.8);
    const z = Math.max(0.02, Number.isFinite(zeta) ? zeta : 0.78);
    const w0 = 2 * Math.PI * safeF0;
    let pos;
    let vel;

    if (z < 1 - 1e-4) {
      const wd = w0 * Math.sqrt(1 - z * z);
      const env = Math.exp(-z * w0 * t);
      const c = Math.cos(wd * t);
      const s = Math.sin(wd * t);
      const B = (z * w0 - v0) / wd;
      pos = 1 - env * (c + B * s);
      vel = env * (w0 * z * (c + B * s) + wd * (s - B * c));
    } else if (z <= 1 + 1e-4) {
      const env = Math.exp(-w0 * t);
      const k = w0 - v0;
      pos = 1 - env * (1 + k * t);
      vel = env * (v0 + w0 * k * t);
    } else {
      const wh = w0 * Math.sqrt(z * z - 1);
      const r1 = -w0 * (z - Math.sqrt(z * z - 1));
      const r2 = -w0 * (z + Math.sqrt(z * z - 1));
      const c1 = (v0 + r2) / (2 * wh);
      const c2 = -(v0 + r1) / (2 * wh);
      const e1 = Math.exp(r1 * t);
      const e2 = Math.exp(r2 * t);
      pos = 1 + c1 * e1 + c2 * e2;
      vel = c1 * r1 * e1 + c2 * r2 * e2;
    }

    const energy = Math.abs(1 - pos) + Math.abs(vel) / w0;
    return energy < 0.0004 ? 1 : pos;
  }

  function springApple(t, duration = 0.52, bounce = 0.14, v0 = 0) {
    const f0 = 1 / Math.max(0.05, duration);
    const b = clamp(bounce, -0.95, 0.92);
    const zeta = b >= 0 ? 1 - b : 1 / (1 + b);
    return spring(t, f0, zeta, v0);
  }

  function springTimeline(events, f0 = 3.0, zeta = 0.78) {
    return function evalTrack(t) {
      if (!events || !events.length) return 0;
      let val = events[0][1];
      for (let i = 1; i < events.length; i++) {
        const [ti, target] = events[i];
        if (t > ti) {
          val += (target - events[i - 1][1]) * spring(t - ti, f0, zeta);
        }
      }
      return val;
    };
  }

  /** Golden-ratio 3-harmonic aperiodic organic micro-motion in [-1, 1] (kills robotic sin(t)). */
  function idleNoise(t, index = 0, freqHz = 0.42) {
    const w = 2 * Math.PI * freqHz * t;
    const ph = index * GOLDEN_ANGLE;
    return (
      0.55 * Math.sin(w + ph) +
      0.30 * Math.sin(PHI * w + 2.1 * ph) +
      0.15 * Math.sin(SQRT2 * w - 1.3 * ph)
    );
  }

  function expZoom(s0, s1, p) {
    const safe0 = Math.max(0.001, s0);
    const safe1 = Math.max(0.001, s1);
    return safe0 * Math.pow(safe1 / safe0, clamp(p, 0, 1));
  }

  function squashStretch(velocityPxPerSec, gain = 0.0002, maxStretch = 1.38) {
    const stretch = clamp(1 + Math.abs(velocityPxPerSec) * gain, 1, maxStretch);
    return { scaleParallel: stretch, scalePerp: 1 / stretch };
  }

  /** Lead-Opacity Law entrance state: opacity finishes in 45% of transform duration so overshoot is crisp. */
  function entrance(localT, opts = {}) {
    const delay = opts.delay || 0;
    const dur = opts.dur || 0.48;
    const bounce = opts.bounce !== undefined ? opts.bounce : 0.12;
    const risePx = opts.risePx !== undefined ? opts.risePx : 28;
    const scaleFrom = opts.scaleFrom !== undefined ? opts.scaleFrom : 0.95;
    const dt = localT - delay;
    if (dt <= 0) {
      return { opacity: 0, y: risePx, scale: scaleFrom, progress: 0 };
    }
    const op = EASE.uiSnapOut(clamp(dt / (dur * 0.45), 0, 1));
    const mv = springApple(dt, dur, bounce);
    return {
      opacity: op,
      y: risePx * (1 - mv),
      scale: scaleFrom + (1 - scaleFrom) * mv,
      progress: clamp(mv, 0, 1.25),
    };
  }

  // ============================================================================
  // 3. PERCEPTUAL COLOR SCIENCE (OKLCH / OKLAB) & 12 STUDIO THEMES
  // ============================================================================
  function oklch(L, C, H, alpha = 1) {
    const hr = (H * Math.PI) / 180;
    const a = C * Math.cos(hr);
    const b = C * Math.sin(hr);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const linR = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const linG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const linB = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const gamma = (x) => {
      const c = clamp(x, 0, 1);
      return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
    };
    const r8 = gamma(linR);
    const g8 = gamma(linG);
    const b8 = gamma(linB);
    if (alpha >= 0.999) {
      return '#' + [r8, g8, b8].map((v) => v.toString(16).padStart(2, '0')).join('');
    }
    return `rgba(${r8}, ${g8}, ${b8}, ${clamp(alpha, 0, 1).toFixed(3)})`;
  }

  function mixOklch(c1, c2, t) {
    const p = clamp(t, 0, 1);
    const dh = ((c2.h - c1.h + 540) % 360) - 180;
    return oklch(
      c1.l + (c2.l - c1.l) * p,
      c1.c + (c2.c - c1.c) * p,
      (c1.h + dh * p + 360) % 360,
      (c1.a ?? 1) + ((c2.a ?? 1) - (c1.a ?? 1)) * p
    );
  }

  function studioShadePair({ l, c, h }) {
    const toCool = ((275 - h + 540) % 360) - 180;
    const toWarm = ((85 - h + 540) % 360) - 180;
    return {
      base: oklch(l, c, h),
      shadow: oklch(Math.max(0.12, l - 0.15), Math.min(0.24, c * 1.08), h + Math.sign(toCool) * Math.min(24, Math.abs(toCool) * 0.25)),
      highlight: oklch(Math.min(0.98, l + 0.14), c * 0.72, h + Math.sign(toWarm) * Math.min(14, Math.abs(toWarm) * 0.20)),
    };
  }

  const THEMES = {
    'linear-dark': {
      bg: '#0B0E14', bgAlt: '#131824', surface: '#171D2B', surfaceHi: '#1F2738',
      border: 'rgba(255,255,255,0.10)', fg: '#F8FAFC', muted: '#94A3B8',
      accent: '#38BDF8', accent2: '#818CF8', warn: '#F59E0B', ok: '#34D399',
      fontDisplay: '"Inter", "SF Pro Display", system-ui, sans-serif',
      fontBody: '"Inter", system-ui, sans-serif',
      fontMono: '"JetBrains Mono", "Fira Code", monospace',
    },
    'swiss-brutalist': {
      bg: '#F4F1EA', bgAlt: '#EAE5D9', surface: '#FFFFFF', surfaceHi: '#121212',
      border: 'rgba(18,18,18,0.16)', fg: '#0E0E0E', muted: '#4A4A46',
      accent: '#FF4D00', accent2: '#0057FF', warn: '#D97706', ok: '#059669',
      fontDisplay: '"Archivo Black", "Arial Black", system-ui, sans-serif',
      fontBody: '"Inter", "Helvetica Neue", sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'paperclip-cn': {
      bg: '#E9EEF2', bgAlt: '#DCE4EC', surface: '#FFFFFF', surfaceHi: '#F8FAFC',
      border: 'rgba(15,23,42,0.12)', fg: '#0F172A', muted: '#475569',
      accent: '#FF5A36', accent2: '#0284C7', warn: '#EA580C', ok: '#0D9488',
      fontDisplay: '"Noto Sans SC", "Inter", system-ui, sans-serif',
      fontBody: '"Noto Sans SC", "Inter", system-ui, sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'cyber-fui-jp': {
      bg: '#060A10', bgAlt: '#0B121E', surface: '#0E1726', surfaceHi: '#16243B',
      border: 'rgba(56,189,248,0.22)', fg: '#E2E8F0', muted: '#7DD3FC',
      accent: '#00F0FF', accent2: '#FF9E00', warn: '#FF3B30', ok: '#10B981',
      fontDisplay: '"Space Grotesk", "Noto Sans JP", sans-serif',
      fontBody: '"Inter", "Noto Sans JP", sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'kurzgesagt-pop': {
      bg: '#13112B', bgAlt: '#1E1B4B', surface: '#26225E', surfaceHi: '#342E7A',
      border: 'rgba(255,255,255,0.14)', fg: '#FFFBEB', muted: '#C7D2FE',
      accent: '#FF6B4A', accent2: '#2DD4BF', warn: '#FBBF24', ok: '#4ADE80',
      fontDisplay: '"Plus Jakarta Sans", "Inter", sans-serif',
      fontBody: '"Plus Jakarta Sans", "Inter", sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'riso-editorial': {
      bg: '#F7EFE2', bgAlt: '#EFE3CF', surface: '#FFFBF4', surfaceHi: '#F2E5D0',
      border: 'rgba(26,26,26,0.14)', fg: '#1A1A1A', muted: '#57534E',
      accent: '#FF5F38', accent2: '#00A3A1', warn: '#D97706', ok: '#0D9488',
      fontDisplay: '"Fraunces", "Georgia", serif',
      fontBody: '"Inter", system-ui, sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'deep-ocean-atlas': {
      bg: '#071324', bgAlt: '#0C1E38', surface: '#11294B', surfaceHi: '#183763',
      border: 'rgba(125,211,252,0.18)', fg: '#F0F9FF', muted: '#93C5FD',
      accent: '#38BDF8', accent2: '#FB7185', warn: '#FBBF24', ok: '#34D399',
      fontDisplay: '"Inter", "SF Pro Display", sans-serif',
      fontBody: '"Inter", sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'apple-keynote': {
      bg: '#000000', bgAlt: '#0D0D10', surface: '#161618', surfaceHi: '#222226',
      border: 'rgba(255,255,255,0.11)', fg: '#F5F5F7', muted: '#A1A1A6',
      accent: '#2997FF', accent2: '#BF5AF2', warn: '#FF9F0A', ok: '#30D158',
      fontDisplay: '"Inter", "SF Pro Display", sans-serif',
      fontBody: '"Inter", sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
    'cinema-a24': {
      bg: '#090807', bgAlt: '#12100E', surface: '#181512', surfaceHi: '#241F1A',
      border: 'rgba(243,237,226,0.14)', fg: '#F3EDE2', muted: '#B5AA99',
      accent: '#D4A359', accent2: '#A33B20', warn: '#D97706', ok: '#65A30D',
      fontDisplay: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
      fontBody: '"Plus Jakarta Sans", "Helvetica Neue", sans-serif',
      fontMono: '"Space Mono", "JetBrains Mono", monospace',
    },
    'documentary-vox': {
      bg: '#F3EFE6', bgAlt: '#E7E0D2', surface: '#FAF7F0', surfaceHi: '#EFE8D8',
      border: 'rgba(23,22,20,0.15)', fg: '#171614', muted: '#57534E',
      accent: '#EAB308', accent2: '#C2410C', warn: '#B45309', ok: '#15803D',
      fontDisplay: '"Newsreader", "Fraunces", Georgia, serif',
      fontBody: '"Work Sans", system-ui, sans-serif',
      fontMono: '"IBM Plex Mono", monospace',
    },
    'luxury-editorial': {
      bg: '#FAF7F2', bgAlt: '#F0EAE0', surface: '#FFFFFF', surfaceHi: '#F5EFE6',
      border: 'rgba(20,19,18,0.10)', fg: '#141312', muted: '#6B655E',
      accent: '#8C6D46', accent2: '#2C3E35', warn: '#A16207', ok: '#166534',
      fontDisplay: '"Instrument Serif", "Cormorant Garamond", Georgia, serif',
      fontBody: '"Plus Jakarta Sans", "Helvetica Neue", sans-serif',
      fontMono: '"Space Mono", monospace',
    },
    'warm-story': {
      bg: '#191310', bgAlt: '#241B16', surface: '#2E221C', surfaceHi: '#3B2C24',
      border: 'rgba(253,246,236,0.13)', fg: '#FDF6EC', muted: '#C9B8A6',
      accent: '#E07A5F', accent2: '#F2CC8F', warn: '#F4A261', ok: '#81B29A',
      fontDisplay: '"Fraunces", Georgia, serif',
      fontBody: '"Outfit", system-ui, sans-serif',
      fontMono: '"Space Mono", monospace',
    },
    'noir-chiaroscuro': {
      bg: '#050505', bgAlt: '#0E0E0E', surface: '#161616', surfaceHi: '#222222',
      border: 'rgba(234,230,223,0.14)', fg: '#EAE6DF', muted: '#8C8881',
      accent: '#DC2626', accent2: '#F59E0B', warn: '#EA580C', ok: '#10B981',
      fontDisplay: '"Syne", "Bodoni Moda", Georgia, serif',
      fontBody: '"Inter", sans-serif',
      fontMono: '"IBM Plex Mono", monospace',
    },
    'sakura-anime': {
      bg: '#FFF9FB', bgAlt: '#FCEEF4', surface: '#FFFFFF', surfaceHi: '#FDF2F8',
      border: 'rgba(30,27,46,0.12)', fg: '#1E1B2E', muted: '#645E78',
      accent: '#EC4899', accent2: '#0284C7', warn: '#F59E0B', ok: '#10B981',
      fontDisplay: '"Shippori Mincho", "Noto Serif JP", Georgia, serif',
      fontBody: '"Noto Sans JP", system-ui, sans-serif',
      fontMono: '"JetBrains Mono", monospace',
    },
  };

  const FONT_PAIRINGS = {
    'cinema-a24': ['Cormorant+Garamond:ital,wght@0,600;0,700;1,600', 'Plus+Jakarta+Sans:wght@400;600', 'Space+Mono:wght@400;700'],
    'documentary-vox': ['Newsreader:ital,opsz,wght@0,6..72,600;0,6..72,700;1,6..72,600', 'Work+Sans:wght@400;600;700', 'IBM+Plex+Mono:wght@500'],
    'luxury-editorial': ['Instrument+Serif:ital@0;1', 'Plus+Jakarta+Sans:wght@400;500;600'],
    'warm-story': ['Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600', 'Outfit:wght@400;600'],
    'swiss-poster': ['Archivo+Black', 'Inter:wght@400;600;700', 'IBM+Plex+Mono:wght@500'],
    'brutalist-syne': ['Syne:wght@700;800', 'Space+Mono:wght@400;700'],
    'classic-literary': ['Playfair+Display:ital,wght@0,600;0,700;1,600', 'Source+Sans+3:wght@400;600'],
    'tech-precision': ['Space+Grotesk:wght@600;700', 'Inter:wght@400;500;600', 'JetBrains+Mono:wght@500;600'],
    'jp-mincho': ['Shippori+Mincho:wght@600;700;800', 'Noto+Sans+JP:wght@400;600'],
    'kr-editorial': ['Nanum+Myeongjo:wght@700;800', 'IBM+Plex+Sans+KR:wght@400;600'],
    'cn-humanist': ['Noto+Serif+SC:wght@600;700', 'Noto+Sans+SC:wght@400;600'],
    'handdrawn-sketch': ['Caveat:wght@600;700', 'Plus+Jakarta+Sans:wght@400;600'],
  };

  async function loadGoogleFonts(pairingOrSpecs, timeoutMs = 2500) {
    if (typeof document === 'undefined') return;
    const families = Array.isArray(pairingOrSpecs)
      ? pairingOrSpecs
      : (FONT_PAIRINGS[pairingOrSpecs] || FONT_PAIRINGS['cinema-a24']);
    const query = families.map((f) => `family=${f}`).join('&');
    const href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    if (!document.querySelector(`link[href="${href}"]`)) {
      await new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        const timer = setTimeout(resolve, timeoutMs);
        link.onload = () => { clearTimeout(timer); resolve(); };
        link.onerror = () => { clearTimeout(timer); resolve(); };
        document.head.appendChild(link);
      });
    }
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, timeoutMs)),
      ]);
    }
  }

  function getTheme(nameOrObj) {
    if (nameOrObj && typeof nameOrObj === 'object') {
      const base = nameOrObj.base ? (THEMES[nameOrObj.base] || THEMES['linear-dark']) : THEMES['linear-dark'];
      return { ...base, ...nameOrObj };
    }
    return THEMES[nameOrObj] || THEMES['linear-dark'];
  }

  function resolveSceneTheme(baseTheme, scene) {
    if (!scene || !scene.palette || typeof scene.palette !== 'object') return baseTheme;
    return { ...baseTheme, ...scene.palette };
  }

  // ============================================================================
  // 4. UNIVERSAL TELEMETRY HOOK (`window.__MVS_TELEMETRY__`)
  // ============================================================================
  const frameRegistry = {
    t: 0,
    sceneId: null,
    shotPreset: null,
    cameraZoom: 1,
    cliches: [],
    nanErrors: [],
    nodes: [],
  };

  function projectRect(mat, x, y, w, h) {
    const pts = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ].map(([px, py]) => ({
      x: mat.a * px + mat.c * py + mat.e,
      y: mat.b * px + mat.d * py + mat.f,
    }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      w: Math.max(0, Math.max(...xs) - minX),
      h: Math.max(0, Math.max(...ys) - minY),
    };
  }

  function installCanvasTelemetry() {
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    const proto = CanvasRenderingContext2D.prototype;
    if (proto.__mvsPatched) return;
    proto.__mvsPatched = true;

    const origFillText = proto.fillText;
    proto.fillText = function (text, x, y, maxWidth) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        frameRegistry.nanErrors.push({ op: 'fillText', args: [String(text), x, y], t: frameRegistry.t });
        return;
      }
      if (!this.__mvsInternalText && this.globalAlpha >= 0.08 && String(text || '').trim().length > 0) {
        const m = this.measureText(String(text));
        const rawW = maxWidth !== undefined && Number.isFinite(maxWidth) ? Math.min(m.width, maxWidth) : m.width;
        const pxMatch = /(\d+(?:\.\d+)?)px/.exec(this.font || '');
        const fontPx = pxMatch ? Number(pxMatch[1]) : 24;
        const ascent = m.actualBoundingBoxAscent || fontPx * 0.76;
        const descent = m.actualBoundingBoxDescent || fontPx * 0.22;
        let lx = x;
        if (this.textAlign === 'center') lx -= rawW * 0.5;
        else if (this.textAlign === 'right' || this.textAlign === 'end') lx -= rawW;
        let ly = y - ascent;
        if (this.textBaseline === 'top' || this.textBaseline === 'hanging') ly = y;
        else if (this.textBaseline === 'middle') ly = y - (ascent + descent) * 0.5;

        const rect = projectRect(this.getTransform(), lx, ly, rawW, ascent + descent);
        if (rect.w >= 1 && rect.h >= 1) {
          frameRegistry.nodes.push({
            id: `canvas_txt_${frameRegistry.nodes.length}`,
            sceneId: frameRegistry.sceneId || 'canvas',
            layer: 'canvas-raw',
            role: fontPx >= 64 ? 'title' : fontPx <= 24 ? 'label' : 'body',
            text: String(text).trim(),
            fontPx,
            fg: typeof this.fillStyle === 'string' ? this.fillStyle : null,
            bg: null,
            ...rect,
            opacity: this.globalAlpha,
            allowOverlapIds: [],
          });
        }
      }
      return origFillText.apply(this, arguments);
    };

    for (const fnName of ['fillRect', 'strokeRect', 'roundRect', 'moveTo', 'lineTo', 'arc', 'bezierCurveTo']) {
      const orig = proto[fnName];
      if (typeof orig !== 'function') continue;
      proto[fnName] = function (...args) {
        for (let i = 0; i < args.length; i++) {
          if (typeof args[i] === 'number' && !Number.isFinite(args[i])) {
            frameRegistry.nanErrors.push({ op: fnName, args: args.slice(0, 6), t: frameRegistry.t });
            return;
          }
        }
        return orig.apply(this, args);
      };
    }
  }

  function collectDomTelemetry() {
    if (typeof document === 'undefined') return;
    const els = document.querySelectorAll('[data-mvs-id], [data-mvs-role], h1, h2, h3, p, span, .card, .caption, svg text');
    for (const el of els) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.08) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const directText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join(' ')
        .trim();
      if (!directText && !el.dataset.mvsRole && !el.dataset.mvsId) continue;
      frameRegistry.nodes.push({
        id: el.dataset.mvsId || el.id || `dom_${frameRegistry.nodes.length}`,
        sceneId: el.dataset.mvsScene || frameRegistry.sceneId || 'dom',
        layer: 'dom',
        role: el.dataset.mvsRole || (parseFloat(st.fontSize) >= 64 ? 'title' : 'body'),
        text: directText || el.dataset.mvsText || '',
        fontPx: parseFloat(st.fontSize) || null,
        fg: st.color,
        bg: st.backgroundColor && st.backgroundColor !== 'rgba(0, 0, 0, 0)' ? st.backgroundColor : null,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        opacity: parseFloat(st.opacity),
        clippedX: el.scrollWidth > el.clientWidth + 3,
        clippedY: el.scrollHeight > el.clientHeight + 3,
        allowOverlapIds: (el.dataset.mvsAllowOverlap || '').split(',').filter(Boolean),
      });
    }
  }

  installCanvasTelemetry();

  const TELEMETRY = {
    beginFrame(t, sceneId = null) {
      frameRegistry.t = t;
      frameRegistry.sceneId = sceneId;
      frameRegistry.shotPreset = null;
      frameRegistry.cameraZoom = 1;
      frameRegistry.cliches = [];
      frameRegistry.nanErrors = [];
      frameRegistry.nodes = [];
    },
    markCliche(tag) {
      if (tag && !frameRegistry.cliches.includes(tag)) frameRegistry.cliches.push(tag);
    },
    setScene(sceneId) {
      frameRegistry.sceneId = sceneId;
    },
    setShot(preset) {
      frameRegistry.shotPreset = preset;
    },
    setCameraZoom(z) {
      frameRegistry.cameraZoom = z;
    },
    registerNode(node) {
      if (!node || node.w < 1 || node.h < 1 || (node.opacity !== undefined && node.opacity < 0.08)) return;
      frameRegistry.nodes.push({
        sceneId: frameRegistry.sceneId || 'mvs',
        layer: 'mvs-sdk',
        opacity: 1,
        allowOverlapIds: [],
        ...node,
      });
    },
    record(entry) {
      if (!entry) return;
      const r = entry.rect || entry;
      this.registerNode({
        id: entry.id || `mvs_node_${frameRegistry.nodes.length}`,
        role: entry.role || entry.kind || 'diagram',
        text: entry.text || '',
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        fg: entry.fg || null,
        bg: entry.bg || null,
        allowOverlapIds: entry.allowOverlapIds || [],
      });
    },
    snapshot() {
      collectDomTelemetry();
      return JSON.parse(JSON.stringify(frameRegistry));
    },
  };

  if (root && typeof root === 'object') {
    root.__MVS_TELEMETRY__ = TELEMETRY;
  }

  // ============================================================================
  // 5. SAFE ZONES & COLLISION-FREE AUTO-LAYOUT ENGINE
  // ============================================================================
  function computeSafeZone(width, height, mode = 'auto') {
    const isPortrait = height > width * 1.15;
    if (mode === '9:16' || (mode === 'auto' && isPortrait)) {
      // 2026 Universal Social Safe Envelope (TikTok / Reels / Shorts)
      const sx = width / 1080;
      const sy = height / 1920;
      return {
        x: Math.round(96 * sx),
        y: Math.round(256 * sy),
        w: Math.round(width - 192 * sx),
        h: Math.round(height - (256 + 420) * sy),
        rightRailX: Math.round(888 * sx),
        rightRailTopY: Math.round(840 * sy),
        aspect: '9:16',
      };
    }
    const padX = Math.round(width * 0.055);
    const padY = Math.round(height * 0.065);
    return {
      x: padX,
      y: padY,
      w: width - padX * 2,
      h: height - padY * 2,
      aspect: width === height ? '1:1' : '16:9',
    };
  }

  /**
   * Divides `rect` vertically into non-overlapping child rects.
   * `weights`: array of numbers (relative weights) or `{ px: number }` / `{ weight: number }`.
   */
  function vstack(rect, countOrWeights, gap = 24) {
    const specs = Array.isArray(countOrWeights)
      ? countOrWeights
      : Array.from({ length: Math.max(1, countOrWeights) }, () => 1);
    const n = specs.length;
    const effectiveGap = Math.min(gap, Math.max(4, Math.floor((rect.h * 0.28) / Math.max(1, n - 1))));
    const availH = Math.max(10, rect.h - effectiveGap * (n - 1));

    let fixedSum = 0;
    let weightSum = 0;
    for (const s of specs) {
      if (s && typeof s === 'object' && s.px) fixedSum += s.px;
      else weightSum += typeof s === 'number' ? s : (s?.weight || 1);
    }
    const scaleFixed = fixedSum > availH * 0.85 ? (availH * 0.85) / fixedSum : 1;
    const remH = Math.max(0, availH - fixedSum * scaleFixed);

    const out = [];
    let curY = rect.y;
    for (let i = 0; i < n; i++) {
      const s = specs[i];
      const h = s && typeof s === 'object' && s.px
        ? s.px * scaleFixed
        : weightSum > 0
          ? (remH * (typeof s === 'number' ? s : (s?.weight || 1))) / weightSum
          : availH / n;
      out.push({ x: rect.x, y: Math.round(curY), w: rect.w, h: Math.round(h) });
      curY += h + effectiveGap;
    }
    return out;
  }

  function hstack(rect, countOrWeights, gap = 24) {
    const specs = Array.isArray(countOrWeights)
      ? countOrWeights
      : Array.from({ length: Math.max(1, countOrWeights) }, () => 1);
    const n = specs.length;
    const effectiveGap = Math.min(gap, Math.max(4, Math.floor((rect.w * 0.25) / Math.max(1, n - 1))));
    const availW = Math.max(10, rect.w - effectiveGap * (n - 1));

    let fixedSum = 0;
    let weightSum = 0;
    for (const s of specs) {
      if (s && typeof s === 'object' && s.px) fixedSum += s.px;
      else weightSum += typeof s === 'number' ? s : (s?.weight || 1);
    }
    const scaleFixed = fixedSum > availW * 0.85 ? (availW * 0.85) / fixedSum : 1;
    const remW = Math.max(0, availW - fixedSum * scaleFixed);

    const out = [];
    let curX = rect.x;
    for (let i = 0; i < n; i++) {
      const s = specs[i];
      const w = s && typeof s === 'object' && s.px
        ? s.px * scaleFixed
        : weightSum > 0
          ? (remW * (typeof s === 'number' ? s : (s?.weight || 1))) / weightSum
          : availW / n;
      out.push({ x: Math.round(curX), y: rect.y, w: Math.round(w), h: rect.h });
      curX += w + effectiveGap;
    }
    return out;
  }

  function bentoGrid(rect, cols = 2, rows = 2, gap = 24) {
    const rowRects = vstack(rect, rows, gap);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const colRects = hstack(rowRects[r], cols, gap);
      for (let c = 0; c < cols; c++) {
        cells.push({ ...colRects[c], row: r, col: c, index: r * cols + c });
      }
    }
    return cells;
  }

  function insetRect(rect, padX = 24, padY = padX) {
    return {
      x: rect.x + padX,
      y: rect.y + padY,
      w: Math.max(4, rect.w - padX * 2),
      h: Math.max(4, rect.h - padY * 2),
    };
  }

  /**
   * 6 Master Cinematographic Shot Topologies (automatically adapts to 16:9 and 9:16).
   * Prevents "4 identical 50/50 slides" monotony and alternates viewer Eye-Trace polarity.
   */
  function shotLayout(safe, preset = 'split-lr') {
    const isPortrait = safe.aspect === '9:16';
    TELEMETRY.setShot(preset);

    if (preset === 'establishing-wide') {
      if (isPortrait) {
        const [header, heroVisual, lowerThird] = vstack(safe, [0.24, 0.56, 0.20], 20);
        return { preset, header, heroVisual, lowerThird, primary: header, visual: heroVisual };
      }
      const [leftCol, rightStage] = hstack(safe, [0.36, 0.64], 36);
      const [kicker, hero, lowerThird] = vstack(leftCol, [{ px: 34 }, 0.52, 0.36], 18);
      return { preset, kicker, header: hero, heroVisual: rightStage, lowerThird, primary: leftCol, visual: rightStage };
    }

    if (preset === 'split-rl') {
      const [visual, primary] = isPortrait
        ? vstack(safe, [0.56, 0.44], 24)
        : hstack(safe, [0.58, 0.42], 38);
      return { preset, visual, primary };
    }

    if (preset === 'macro-focus') {
      const [header, stage, footerStrip] = vstack(safe, [{ px: 86 }, 1, { px: 122 }], 22);
      const footerCols = hstack(footerStrip, 3, 20);
      return { preset, header, stage, footerStrip, footerCols, primary: header, visual: stage };
    }

    if (preset === 'bento-command') {
      const [header, body] = vstack(safe, [{ px: 84 }, 1], 22);
      const [kpiCol, heroChart] = isPortrait
        ? vstack(body, [0.42, 0.58], 20)
        : hstack(body, [0.36, 0.64], 28);
      const [kpiTop, kpiBottom] = isPortrait ? hstack(kpiCol, 2, 16) : vstack(kpiCol, 2, 20);
      return { preset, header, kpiTop, kpiBottom, heroChart, primary: kpiCol, visual: heroChart };
    }

    if (preset === 'monumental-payoff') {
      const padX = Math.round(safe.w * (isPortrait ? 0.04 : 0.12));
      const padY = Math.round(safe.h * 0.10);
      const core = insetRect(safe, padX, padY);
      const [kicker, heroCenter, subCenter, badgeRow] = vstack(core, [{ px: 36 }, 0.48, 0.28, { px: 88 }], 20);
      return { preset, kicker, heroCenter, subCenter, badgeRow, primary: heroCenter, visual: badgeRow };
    }

    // Default: 'split-lr'
    const [primary, visual] = isPortrait
      ? vstack(safe, [0.44, 0.56], 24)
      : hstack(safe, [0.42, 0.58], 38);
    return { preset: 'split-lr', primary, visual };
  }

  // ============================================================================
  // 6. AUTO-FIT & DP-BALANCED OPTICAL TYPOGRAPHY ENGINE
  // ============================================================================
  function isCjk(ch) {
    const cp = ch.codePointAt(0) || 0;
    return (cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af);
  }

  function tokenizeSmart(str) {
    const s = String(str || '').trim();
    if (!s) return [];
    const tokens = [];
    let buf = '';
    for (const ch of Array.from(s)) {
      if (isCjk(ch)) {
        if (buf) {
          tokens.push(buf);
          buf = '';
        }
        tokens.push(ch);
      } else if (ch === ' ') {
        if (buf) {
          tokens.push(buf + ' ');
          buf = '';
        }
      } else {
        buf += ch;
      }
    }
    if (buf) tokens.push(buf);
    return tokens;
  }

  function wrapBalanced(ctx, text, maxWidth, maxLines = 4) {
    const rawParagraphs = String(text || '').split('\n');
    const allLines = [];
    for (const para of rawParagraphs) {
      const toks = tokenizeSmart(para);
      if (!toks.length) continue;
      const lines = [];
      let cur = '';
      for (const tok of toks) {
        const cand = (cur + tok).trimEnd();
        if (!cur || ctx.measureText(cand).width <= maxWidth) {
          cur += tok;
        } else {
          lines.push(cur.trim());
          cur = tok;
        }
      }
      if (cur.trim()) lines.push(cur.trim());

      // 2-line optical balance pass: avoids leaving a 1-word orphan on the last line
      if (lines.length === 2 && toks.length >= 4) {
        let bestSplit = -1;
        let bestDiff = Infinity;
        for (let k = 1; k < toks.length; k++) {
          const l1 = toks.slice(0, k).join('').trim();
          const l2 = toks.slice(k).join('').trim();
          const w1 = ctx.measureText(l1).width;
          const w2 = ctx.measureText(l2).width;
          if (w1 <= maxWidth && w2 <= maxWidth) {
            const diff = Math.abs(w1 - w2);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestSplit = k;
            }
          }
        }
        if (bestSplit > 0) {
          lines[0] = toks.slice(0, bestSplit).join('').trim();
          lines[1] = toks.slice(bestSplit).join('').trim();
        }
      }
      allLines.push(...lines);
    }
    return allLines.slice(0, Math.max(1, maxLines));
  }

  /**
   * Draws multi-line text guaranteed to fit inside `box` using 7-step binary search on font size.
   * Automatically registers exact ink AABB into `window.__MVS_TELEMETRY__`.
   */
  function drawTextAutoFit(ctx, text, box, opts = {}) {
    const content = String(text ?? '').trim();
    if (!content || box.w < 4 || box.h < 4) return null;

    const role = opts.role || 'body';
    const roleDefaults = {
      hero: { maxPx: 118, minPx: 42, weight: 800, lineHeight: 1.08, maxLines: 3 },
      title: { maxPx: 68, minPx: 30, weight: 700, lineHeight: 1.14, maxLines: 3 },
      subtitle: { maxPx: 36, minPx: 20, weight: 500, lineHeight: 1.32, maxLines: 3 },
      metric: { maxPx: 96, minPx: 36, weight: 800, lineHeight: 1.04, maxLines: 1 },
      body: { maxPx: 30, minPx: 18, weight: 500, lineHeight: 1.38, maxLines: 5 },
      label: { maxPx: 20, minPx: 13, weight: 700, lineHeight: 1.2, maxLines: 2 },
      caption: { maxPx: 52, minPx: 28, weight: 800, lineHeight: 1.15, maxLines: 2 },
    }[role] || { maxPx: 34, minPx: 18, weight: 500, lineHeight: 1.3, maxLines: 4 };

    const fontFamily = opts.fontFamily || '"Inter", system-ui, sans-serif';
    const weight = opts.weight || roleDefaults.weight;
    const lineHeight = opts.lineHeight || roleDefaults.lineHeight;
    const maxLines = opts.maxLines || roleDefaults.maxLines;
    const align = opts.align || 'left';
    const valign = opts.valign || 'middle';
    const color = opts.color || '#F8FAFC';
    const opacity = opts.opacity !== undefined ? clamp(opts.opacity, 0, 1) : 1;
    if (opacity < 0.02) return null;

    let lo = opts.minPx || roleDefaults.minPx;
    let hi = Math.min(opts.maxPx || roleDefaults.maxPx, box.h);
    if (hi < lo) hi = lo;
    let bestPx = lo;
    let bestLines = [content];

    for (let step = 0; step < 8; step++) {
      const mid = (lo + hi) * 0.5;
      ctx.font = `${weight} ${mid.toFixed(1)}px ${fontFamily}`;
      const lines = wrapBalanced(ctx, content, box.w, maxLines + 2);
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const totalH = lines.length * mid * lineHeight;
      if (lines.length <= maxLines && maxLineW <= box.w + 1 && totalH <= box.h + 2) {
        bestPx = mid;
        bestLines = lines;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    ctx.save();
    ctx.font = `${weight} ${bestPx.toFixed(1)}px ${fontFamily}`;
    if (opts.tabularNums !== false && /\d/.test(content)) {
      ctx.fontVariantCaps = 'normal';
    }
    bestLines = wrapBalanced(ctx, content, box.w, maxLines);

    const stepY = bestPx * lineHeight;
    const blockH = (bestLines.length - 1) * stepY + bestPx;
    let startY = box.y + bestPx * 0.82;
    if (valign === 'middle') {
      startY = box.y + (box.h - blockH) * 0.5 + bestPx * 0.80;
    } else if (valign === 'bottom') {
      startY = box.y + box.h - blockH + bestPx * 0.80;
    }

    const anim = opts.entrance ? entrance(opts.localT ?? 10, opts.entrance) : { opacity: 1, y: 0, scale: 1 };
    const finalAlpha = opacity * anim.opacity;
    if (finalAlpha < 0.02) {
      ctx.restore();
      return null;
    }

    const cx = box.x + box.w * 0.5;
    const cy = box.y + box.h * 0.5;
    ctx.translate(cx, cy + anim.y);
    ctx.scale(anim.scale, anim.scale);
    ctx.translate(-cx, -cy);

    ctx.globalAlpha *= finalAlpha;
    ctx.fillStyle = color;
    ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.__mvsInternalText = true;

    let maxW = 0;
    for (let i = 0; i < bestLines.length; i++) {
      const line = bestLines[i];
      const lw = Math.min(box.w, ctx.measureText(line).width);
      if (lw > maxW) maxW = lw;
      const drawX = align === 'center' ? box.x + box.w * 0.5 : align === 'right' ? box.x + box.w : box.x;
      const drawY = startY + i * stepY;
      if (opts.strokeColor && opts.strokeWidth) {
        ctx.strokeStyle = opts.strokeColor;
        ctx.lineWidth = opts.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, drawX, drawY, box.w);
      }
      ctx.fillText(line, drawX, drawY, box.w);
    }
    ctx.__mvsInternalText = false;

    const inkX = align === 'center' ? box.x + (box.w - maxW) * 0.5 : align === 'right' ? box.x + box.w - maxW : box.x;
    const inkY = startY - bestPx * 0.80;
    const worldRect = projectRect(ctx.getTransform(), inkX, inkY, Math.max(4, maxW), Math.max(4, blockH));
    ctx.restore();

    const node = {
      id: opts.id || `${role}_${ frameRegistry.nodes.length }`,
      role,
      text: bestLines.join(' '),
      fontPx: Math.round(bestPx * 10) / 10,
      fg: color,
      bg: opts.bgHint || null,
      ...worldRect,
      opacity: finalAlpha,
      allowOverlapIds: opts.allowOverlapIds || [],
    };
    TELEMETRY.registerNode(node);
    return node;
  }

  // ============================================================================
  // 7. MULTI-GENRE STUDIO VISUAL PRIMITIVES (CARDS, CHARTS, ISOMETRIC, FLOW, CODE)
  // ============================================================================
  function drawBackdrop(ctx, width, height, t, opts = {}) {
    const theme = getTheme(opts.theme);
    const variant = opts.variant || 'mesh-grid';
    ctx.save();
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle animated atmospheric orbs (OKLCH / smooth radial gradients)
    if (variant !== 'flat') {
      const driftX = Math.sin(t * 0.35) * width * 0.06;
      const driftY = Math.cos(t * 0.28) * height * 0.05;
      const g1 = ctx.createRadialGradient(
        width * 0.22 + driftX, height * 0.24 + driftY, 10,
        width * 0.22 + driftX, height * 0.24 + driftY, Math.max(width, height) * 0.58
      );
      g1.addColorStop(0, hexAlpha(theme.accent, 0.14));
      g1.addColorStop(1, hexAlpha(theme.accent, 0));
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(
        width * 0.80 - driftX * 0.8, height * 0.78 - driftY, 10,
        width * 0.80 - driftX * 0.8, height * 0.78 - driftY, Math.max(width, height) * 0.52
      );
      g2.addColorStop(0, hexAlpha(theme.accent2, 0.12));
      g2.addColorStop(1, hexAlpha(theme.accent2, 0));
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);
    }

    if (variant === 'mesh-grid' || variant === 'blueprint') {
      const step = Math.round(Math.min(width, height) * 0.055);
      const pan = (t * 14) % step;
      ctx.strokeStyle = variant === 'blueprint' ? hexAlpha(theme.accent, 0.12) : hexAlpha(theme.fg, 0.045);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -step + pan; x < width + step; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = -step + pan * 0.5; y < height + step; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // Optical vignette (Finishing Layer 5)
    const vig = ctx.createRadialGradient(
      width * 0.5, height * 0.5, Math.min(width, height) * 0.32,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.75
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function hexAlpha(color, alpha) {
    if (!color || typeof color !== 'string') return `rgba(255,255,255,${alpha})`;
    const hex = color.trim();
    if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
      const full = hex.length === 4
        ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
        : hex;
      const r = parseInt(full.slice(1, 3), 16);
      const g = parseInt(full.slice(3, 5), 16);
      const b = parseInt(full.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
    }
    return color;
  }

  function roundRectPath(ctx, x, y, w, h, r = 18) {
    const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rad);
    } else {
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }
  }

  function drawCard(ctx, rect, opts = {}) {
    const theme = getTheme(opts.theme);
    const anim = opts.entrance ? entrance(opts.localT ?? 10, opts.entrance) : { opacity: 1, y: 0, scale: 1 };
    if (anim.opacity < 0.02) return null;
    const idleY = opts.idle !== false && opts.localT !== undefined
      ? idleNoise(opts.localT, opts.index || 0, 0.38) * 2.5
      : 0;

    const cardId = opts.id || `card_${frameRegistry.nodes.length}`;
    const radius = opts.radius !== undefined ? opts.radius : 20;
    const fill = opts.fill || theme.surface;

    ctx.save();
    const cx = rect.x + rect.w * 0.5;
    const cy = rect.y + rect.h * 0.5;
    ctx.translate(cx, cy + anim.y + idleY);
    ctx.scale(anim.scale, anim.scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha *= anim.opacity;

    // Soft elevated drop shadow without GPU shadowBlur cost
    roundRectPath(ctx, rect.x, rect.y + 8, rect.w, rect.h, radius);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fill();

    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.fillStyle = fill;
    ctx.fill();

    // Specular 1px border (Linear / Apple zenith highlight)
    ctx.lineWidth = opts.borderWidth || 1.5;
    ctx.strokeStyle = opts.borderColor || theme.border;
    ctx.stroke();

    if (opts.accentBar) {
      ctx.save();
      roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
      ctx.clip();
      ctx.fillStyle = opts.accentColor || theme.accent;
      ctx.fillRect(rect.x, rect.y, opts.accentBar === 'top' ? rect.w : 6, opts.accentBar === 'top' ? 5 : rect.h);
      ctx.restore();
    }

    const worldRect = projectRect(ctx.getTransform(), rect.x, rect.y, rect.w, rect.h);
    ctx.restore();

    TELEMETRY.registerNode({
      id: cardId,
      role: 'card',
      text: '',
      fg: opts.borderColor || theme.border,
      bg: fill,
      ...worldRect,
      opacity: anim.opacity,
    });

    const padY = opts.padding !== undefined ? opts.padding : Math.max(12, Math.round(Math.min(rect.w, rect.h) * 0.10));
    const padX = opts.padding !== undefined ? opts.padding : Math.max(22, padY);
    const barLeft = opts.accentBar && opts.accentBar !== 'top' ? 8 : 0;
    const localInner = {
      x: rect.x + padX + barLeft,
      y: rect.y + padY,
      w: Math.max(8, rect.w - padX * 2 - barLeft),
      h: Math.max(8, rect.h - padY * 2),
    };
    return { id: cardId, inner: localInner, bg: fill, opacity: anim.opacity };
  }

  function formatMetricNumber(val, decimals = 0, prefix = '', suffix = '') {
    const fixed = Number(val).toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${prefix}${parts.join('.')}${suffix}`;
  }

  function drawMetricCard(ctx, rect, opts = {}) {
    TELEMETRY.markCliche('ui-metric-card');
    const theme = getTheme(opts.theme);
    const localT = opts.localT ?? 2;
    const delay = opts.delay || 0;
    const card = drawCard(ctx, rect, {
      ...opts,
      theme,
      entrance: { delay, dur: 0.48, bounce: 0.12, risePx: 26 },
      accentBar: opts.accentBar || 'left',
      accentColor: opts.accentColor || theme.accent,
    });
    if (!card) return;

    const countDur = opts.countDur || 1.15;
    const pCount = EASE.expoOut(clamp((localT - delay) / countDur, 0, 1));
    const currentVal = lerp(opts.from ?? 0, opts.value ?? 100, pCount);
    const valStr = opts.valueText || formatMetricNumber(currentVal, opts.decimals || 0, opts.prefix || '', opts.suffix || '');

    const rows = vstack(card.inner, opts.sublabel ? [0.26, 0.48, 0.26] : [0.32, 0.68], 8);
    drawTextAutoFit(ctx, (opts.label || 'METRIC').toUpperCase(), rows[0], {
      id: `${card.id}_lbl`,
      role: 'label',
      fontFamily: theme.fontBody,
      color: theme.muted,
      bgHint: card.bg,
      valign: 'top',
      allowOverlapIds: [card.id],
    });
    drawTextAutoFit(ctx, valStr, rows[1], {
      id: `${card.id}_val`,
      role: 'metric',
      fontFamily: theme.fontDisplay,
      color: opts.accentColor || theme.fg,
      bgHint: card.bg,
      valign: 'middle',
      allowOverlapIds: [card.id],
    });
    if (opts.sublabel) {
      drawTextAutoFit(ctx, opts.sublabel, rows[2], {
        id: `${card.id}_sub`,
        role: 'body',
        maxPx: 22,
        minPx: 14,
        fontFamily: theme.fontBody,
        color: opts.deltaPositive === false ? theme.warn : theme.ok,
        bgHint: card.bg,
        valign: 'bottom',
        allowOverlapIds: [card.id],
      });
    }
  }

  /**
   * Smooth Area / Line Chart with Single-Driver Scrub Readout Badge (HyperFrames / Stripe pattern).
   */
  function drawAreaChart(ctx, rect, opts = {}) {
    const theme = getTheme(opts.theme);
    const data = Array.isArray(opts.data) && opts.data.length >= 2 ? opts.data : [12, 28, 24, 49, 68, 94];
    const labels = opts.labels || [];
    const localT = opts.localT ?? 2;
    const delay = opts.delay || 0;
    const drawDur = opts.drawDur || 1.35;

    const card = drawCard(ctx, rect, {
      ...opts,
      theme,
      padding: 26,
      entrance: { delay, dur: 0.5, bounce: 0.08 },
    });
    if (!card) return;

    let plotRect = card.inner;
    if (opts.title) {
      const [headR, bodyR] = vstack(card.inner, [{ px: 38 }, 1], 14);
      drawTextAutoFit(ctx, opts.title, headR, {
        id: `${card.id}_title`,
        role: 'subtitle',
        maxPx: 26,
        fontFamily: theme.fontDisplay,
        color: theme.fg,
        bgHint: card.bg,
        allowOverlapIds: [card.id],
      });
      plotRect = bodyR;
    }

    const padBottom = labels.length ? 30 : 10;
    const padTop = 28;
    const px0 = plotRect.x + 12;
    const pw = Math.max(20, plotRect.w - 24);
    const py0 = plotRect.y + padTop;
    const ph = Math.max(20, plotRect.h - padTop - padBottom);

    const minV = opts.min !== undefined ? opts.min : Math.min(0, ...data);
    const maxV = opts.max !== undefined ? opts.max : Math.max(...data) * 1.12 || 1;
    const prog = EASE.studioInOut(clamp((localT - delay - 0.12) / drawDur, 0, 1));

    const pts = data.map((v, i) => ({
      x: px0 + (i / (data.length - 1)) * pw,
      y: py0 + ph - ((v - minV) / Math.max(1e-6, maxV - minV)) * ph,
      v,
    }));

    ctx.save();
    // Grid lines
    ctx.strokeStyle = hexAlpha(theme.fg, 0.08);
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const gy = py0 + (g / 3) * ph;
      ctx.beginPath();
      ctx.moveTo(px0, gy);
      ctx.lineTo(px0 + pw, gy);
      ctx.stroke();
    }

    // Clipped progressive reveal
    const revealW = pw * prog;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px0 - 4, py0 - 20, revealW + 8, ph + 32);
    ctx.clip();

    // Smooth Catmull-Rom / midpoint curve
    const traceCurve = () => {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) * 0.5;
        const yc = (pts[i].y + pts[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    };

    const grad = ctx.createLinearGradient(0, py0, 0, py0 + ph);
    const color = opts.color || theme.accent;
    grad.addColorStop(0, hexAlpha(color, 0.36));
    grad.addColorStop(1, hexAlpha(color, 0.01));

    ctx.beginPath();
    traceCurve();
    ctx.lineTo(pts[pts.length - 1].x, py0 + ph);
    ctx.lineTo(pts[0].x, py0 + ph);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    traceCurve();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Live scrub dot + readout badge
    if (prog > 0.03) {
      const fIdx = prog * (pts.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(pts.length - 1, i0 + 1);
      const frac = fIdx - i0;
      const headX = lerp(pts[i0].x, pts[i1].x, frac);
      const headY = lerp(pts[i0].y, pts[i1].y, frac);
      const headVal = lerp(pts[i0].v, pts[i1].v, frac);

      ctx.beginPath();
      ctx.arc(headX, headY, 12 + Math.sin(localT * 6) * 2, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(color, 0.25);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX, headY, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      const badgeTxt = formatMetricNumber(headVal, opts.decimals || 0, opts.prefix || '', opts.suffix || '');
      const badgeW = Math.max(76, badgeTxt.length * 13 + 24);
      const badgeX = clamp(headX - badgeW * 0.5, px0, px0 + pw - badgeW);
      const badgeY = Math.max(plotRect.y, headY - 40);
      roundRectPath(ctx, badgeX, badgeY, badgeW, 28, 8);
      ctx.fillStyle = theme.surfaceHi;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawTextAutoFit(ctx, badgeTxt, { x: badgeX + 8, y: badgeY + 3, w: badgeW - 16, h: 22 }, {
        id: `${card.id}_readout`,
        role: 'label',
        align: 'center',
        color: theme.fg,
        bgHint: theme.surfaceHi,
        fontFamily: theme.fontMono,
        allowOverlapIds: [card.id],
      });
    }

    if (labels.length >= 2) {
      drawTextAutoFit(ctx, String(labels[0]), { x: px0, y: py0 + ph + 6, w: 120, h: 20 }, {
        id: `${card.id}_xl0`, role: 'label', color: theme.muted, bgHint: card.bg, allowOverlapIds: [card.id],
      });
      drawTextAutoFit(ctx, String(labels[labels.length - 1]), { x: px0 + pw - 120, y: py0 + ph + 6, w: 120, h: 20 }, {
        id: `${card.id}_xl1`, role: 'label', align: 'right', color: theme.muted, bgHint: card.bg, allowOverlapIds: [card.id],
      });
    }
    ctx.restore();
  }

  function drawBarChart(ctx, rect, opts = {}) {
    const theme = getTheme(opts.theme);
    const items = opts.items || [
      { label: 'Subsea Fiber', value: 99, color: theme.accent },
      { label: 'Satellites', value: 1, color: theme.muted },
    ];
    const localT = opts.localT ?? 2;
    const delay = opts.delay || 0;
    const card = drawCard(ctx, rect, { ...opts, theme, padding: 26, entrance: { delay, dur: 0.48 } });
    if (!card) return;

    let body = card.inner;
    if (opts.title) {
      const [hR, bR] = vstack(card.inner, [{ px: 36 }, 1], 14);
      drawTextAutoFit(ctx, opts.title, hR, {
        id: `${card.id}_title`, role: 'subtitle', maxPx: 26, fontFamily: theme.fontDisplay,
        color: theme.fg, bgHint: card.bg, allowOverlapIds: [card.id],
      });
      body = bR;
    }

    const maxVal = opts.max || Math.max(1, ...items.map((d) => d.value));
    const rows = vstack(body, items.length, 14);
    items.forEach((item, i) => {
      const row = rows[i];
      const p = springApple(localT - delay - 0.14 - i * 0.08, 0.65, 0.06);
      const [lblCol, barCol, valCol] = hstack(row, [{ px: Math.round(row.w * 0.30) }, 1, { px: Math.round(row.w * 0.18) }], 14);
      drawTextAutoFit(ctx, item.label, lblCol, {
        id: `${card.id}_bl_${i}`, role: 'body', maxPx: 22, color: theme.fg, bgHint: card.bg, allowOverlapIds: [card.id],
      });
      const barH = Math.min(28, Math.max(12, Math.round(barCol.h * 0.58)));
      const barY = barCol.y + Math.round((barCol.h - barH) * 0.5);
      roundRectPath(ctx, barCol.x, barY, barCol.w, barH, barH * 0.5);
      ctx.fillStyle = hexAlpha(theme.fg, 0.08);
      ctx.fill();
      const fillW = Math.max(barH, barCol.w * clamp((item.value / maxVal) * p, 0, 1));
      roundRectPath(ctx, barCol.x, barY, fillW, barH, barH * 0.5);
      ctx.fillStyle = item.color || theme.accent;
      ctx.fill();

      const vText = formatMetricNumber(item.value * clamp(p, 0, 1), opts.decimals || 0, '', opts.suffix || '');
      drawTextAutoFit(ctx, vText, valCol, {
        id: `${card.id}_bv_${i}`, role: 'label', maxPx: 22, align: 'right',
        fontFamily: theme.fontMono, color: item.color || theme.fg, bgHint: card.bg, allowOverlapIds: [card.id],
      });
    });
  }

  /**
   * Chinese MG-Signature: 2.5D Exploded Isometric Stack (`等轴测沙盘`) with 3-face shading (+12% / -12% / -28%).
   */
  function drawIsometricStack(ctx, rect, opts = {}) {
    const theme = getTheme(opts.theme);
    const localT = opts.localT ?? 2;
    const layers = opts.layers || [
      { label: 'Physical Layer', color: '#0284C7' },
      { label: 'Protocol Core', color: '#6366F1' },
      { label: 'Application UI', color: '#38BDF8' },
    ];
    const cx = rect.x + rect.w * 0.34;
    const baseCy = rect.y + rect.h * 0.74;
    const rx = Math.min(rect.w * 0.23, rect.h * 0.28);
    const ry = rx * 0.52;
    const slabH = Math.max(14, Math.round(ry * 0.30));
    const gapZ = Math.min(rect.h * 0.18, Math.max(46, rect.h / (layers.length + 1.6)));
    const stackId = opts.id || `iso_stack_${frameRegistry.nodes.length}`;

    TELEMETRY.registerNode({
      id: stackId,
      role: 'diagram',
      text: '',
      x: cx - rx, y: baseCy - (layers.length - 1) * gapZ - ry, w: rx * 2, h: (layers.length - 1) * gapZ + ry * 2 + slabH,
      opacity: 1,
    });

    layers.forEach((layer, idx) => {
      const p = springApple(localT - (opts.delay || 0) - idx * 0.11, 0.62, 0.14);
      if (p <= 0.01) return;
      const breathe = idleNoise(localT, idx + 3, 0.45) * 4;
      const zY = baseCy - idx * gapZ * p + (1 - p) * 40 + breathe;
      const col = layer.color || theme.accent;

      ctx.save();
      ctx.globalAlpha *= clamp(p * 1.4, 0, 1);

      // Left face (-12%)
      ctx.beginPath();
      ctx.moveTo(cx - rx, zY);
      ctx.lineTo(cx, zY + ry);
      ctx.lineTo(cx, zY + ry + slabH);
      ctx.lineTo(cx - rx, zY + slabH);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fill();

      // Right face (-28%)
      ctx.beginPath();
      ctx.moveTo(cx + rx, zY);
      ctx.lineTo(cx, zY + ry);
      ctx.lineTo(cx, zY + ry + slabH);
      ctx.lineTo(cx + rx, zY + slabH);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fill();

      // Top diamond (+12% highlight)
      ctx.beginPath();
      ctx.moveTo(cx, zY - ry);
      ctx.lineTo(cx + rx, zY);
      ctx.lineTo(cx, zY + ry);
      ctx.lineTo(cx - rx, zY);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Leader line + Callout label on the right (guaranteed non-overlapping vertical slot)
      const labelX = cx + rx + 26;
      const labelW = Math.max(80, rect.x + rect.w - labelX - 8);
      if (labelW >= 90) {
        ctx.beginPath();
        ctx.moveTo(cx + rx * 0.72, zY);
        ctx.lineTo(labelX - 8, zY);
        ctx.strokeStyle = hexAlpha(col, 0.75);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        drawTextAutoFit(ctx, layer.label, { x: labelX, y: zY - 16, w: labelW, h: 32 }, {
          id: `iso_lbl_${idx}`,
          role: 'label',
          maxPx: 20,
          color: theme.fg,
          bgHint: theme.bg,
          allowOverlapIds: [stackId],
        });
      }
      ctx.restore();
    });
  }

  /**
   * Chinese Luminous Flow Beam (`流光`) — quadratic Bézier arc with moving photon pulse (zero GPU blur cost).
   */
  function drawFlowBeam(ctx, from, to, t, opts = {}) {
    const color = opts.color || '#38BDF8';
    const arcLift = opts.arcLift !== undefined ? opts.arcLift : -80;
    const mx = (from[0] + to[0]) * 0.5;
    const my = (from[1] + to[1]) * 0.5 + arcLift;

    TELEMETRY.registerNode({
      id: opts.id || `beam_${frameRegistry.nodes.length}`,
      role: 'beam',
      text: '',
      p0: [from[0], from[1]],
      ctrl: [mx, my],
      p1: [to[0], to[1]],
      x: Math.min(from[0], to[0], mx),
      y: Math.min(from[1], to[1], my),
      w: Math.max(4, Math.max(from[0], to[0], mx) - Math.min(from[0], to[0], mx)),
      h: Math.max(4, Math.max(from[1], to[1], my) - Math.min(from[1], to[1], my)),
      opacity: 1,
      allowOverlapIds: opts.allowOverlapIds || [],
    });

    ctx.save();
    // Base guide path
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.quadraticCurveTo(mx, my, to[0], to[1]);
    ctx.strokeStyle = hexAlpha(color, 0.22);
    ctx.lineWidth = opts.width || 2.5;
    ctx.stroke();

    // Animated pulse packet along the curve
    const speed = opts.speed || 0.75;
    const headU = ((t * speed + (opts.phase || 0)) % 1 + 1) % 1;
    const ptAt = (u) => {
      const iu = 1 - u;
      return [
        iu * iu * from[0] + 2 * iu * u * mx + u * u * to[0],
        iu * iu * from[1] + 2 * iu * u * my + u * u * to[1],
      ];
    };

    const segs = 14;
    const tailLen = 0.22;
    for (let s = 0; s < segs; s++) {
      const u0 = headU - (s / segs) * tailLen;
      const u1 = headU - ((s + 1) / segs) * tailLen;
      if (u1 < 0) continue;
      const [x0, y0] = ptAt(u0);
      const [x1, y1] = ptAt(u1);
      const fade = 1 - s / segs;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = hexAlpha(color, fade * 0.95);
      ctx.lineWidth = (opts.width || 2.5) * (0.8 + fade * 1.1);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    const [hx, hy] = ptAt(headU);
    ctx.beginPath();
    ctx.arc(hx, hy, (opts.width || 2.5) * 1.9, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Procedural Orthographic Globe + Animated Geodesic Arcs (Zero external dependency fallback).
   */
  function drawGlobeWire(ctx, rect, t, opts = {}) {
    const theme = getTheme(opts.theme);
    const cx = rect.x + rect.w * 0.5;
    const cy = rect.y + rect.h * 0.5;
    const r = Math.min(rect.w, rect.h) * 0.43;
    const rot = t * (opts.rotSpeed ?? 0.32) + (opts.rotOffset ?? -0.4);

    ctx.save();
    // Atmospheric outer halo
    const halo = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.18);
    halo.addColorStop(0, hexAlpha(theme.accent, 0.22));
    halo.addColorStop(1, hexAlpha(theme.accent, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
    ctx.fill();

    // Ocean sphere
    const ocean = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, theme.surfaceHi);
    ocean.addColorStop(1, theme.bg);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = ocean;
    ctx.fill();
    ctx.strokeStyle = hexAlpha(theme.accent, 0.45);
    ctx.lineWidth = 2;
    ctx.stroke();

    const tilt = ((opts.tiltDeg ?? -14) * Math.PI) / 180;
    const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
    const projectLatLon = (latDeg, lonDeg, elev = 1.0) => {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180 + rot;
      const vx = Math.cos(lat) * Math.sin(lon);
      const vy0 = Math.sin(lat);
      const vz0 = Math.cos(lat) * Math.cos(lon);
      const vy = vy0 * cosTilt - vz0 * sinTilt;
      const vz = vy0 * sinTilt + vz0 * cosTilt;
      return { x: cx + r * elev * vx, y: cy - r * elev * vy, visible: vz > -0.02, z: vz };
    };

    // Clip inner ocean features to sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Stylized low-poly continental landmass silhouettes (zero external dependency)
    const LANDMASSES = [
      // North America
      [[70,-162],[71,-128],[62,-95],[52,-56],[44,-66],[31,-81],[25,-80],[19,-96],[15,-92],[8,-79],[19,-105],[32,-117],[48,-125],[60,-148]],
      // South America
      [[11,-74],[7,-52],[-5,-35],[-16,-39],[-24,-46],[-35,-58],[-54,-68],[-50,-75],[-33,-72],[-18,-71],[-5,-81]],
      // Europe + Africa
      [[70,26],[62,5],[51,-5],[43,-9],[36,-6],[37,10],[44,28],[36,36],[31,32],[12,51],[-2,41],[-18,36],[-34,25],[-34,18],[-18,12],[4,8],[5,-8],[15,-17],[28,-13],[35,-6],[48,-4],[58,8]],
      // Eurasia
      [[71,28],[73,82],[70,145],[62,170],[52,142],[38,140],[31,122],[22,114],[9,105],[2,103],[16,96],[22,88],[8,77],[24,67],[25,55],[13,44],[36,36],[45,38],[56,38]],
      // Australia
      [[-12,131],[-12,142],[-20,149],[-34,151],[-38,144],[-34,135],[-34,115],[-22,114]],
      // Greenland / UK / Japan accents
      [[82,-45],[76,-19],[60,-44],[68,-53]],
      [[44,145],[39,141],[33,131],[36,137]],
    ];
    for (const poly of LANDMASSES) {
      const proj = poly.map(([la, lo]) => projectLatLon(la, lo, 1.0));
      const visCount = proj.filter((p) => p.z > -0.15).length;
      if (visCount < 3) continue;
      ctx.beginPath();
      proj.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = hexAlpha(theme.accent, 0.16);
      ctx.fill();
      ctx.strokeStyle = hexAlpha(theme.accent, 0.36);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Graticule meridians & parallels
    ctx.strokeStyle = hexAlpha(theme.fg, 0.08);
    ctx.lineWidth = 1;
    for (let lon = -150; lon <= 180; lon += 30) {
      ctx.beginPath();
      let pen = false;
      for (let lat = -80; lat <= 80; lat += 6) {
        const p = projectLatLon(lat, lon);
        if (p.visible) {
          if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
          else ctx.lineTo(p.x, p.y);
        } else pen = false;
      }
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let pen = false;
      for (let lon = -180; lon <= 180; lon += 6) {
        const p = projectLatLon(lat, lon);
        if (p.visible) {
          if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
          else ctx.lineTo(p.x, p.y);
        } else pen = false;
      }
      ctx.stroke();
    }
    ctx.restore(); // end sphere clip

    // True 3D Great-Circle Slerp Subsea / Orbital Routes with Lofted Arcs
    const toVec3 = (latDeg, lonDeg) => {
      const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
      return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
    };
    const routes = opts.routes || [
      { from: [48.8, 2.3], to: [40.7, -74.0], color: theme.accent },
      { from: [35.6, 139.7], to: [37.7, -122.4], color: theme.accent2 },
      { from: [51.5, -0.1], to: [1.3, 103.8], color: theme.ok },
      { from: [40.7, -74.0], to: [-23.5, -46.6], color: theme.warn },
      { from: [38.7, -9.1], to: [-33.9, 18.4], color: theme.accent },
    ];
    routes.forEach((rt, idx) => {
      const a = toVec3(rt.from[0], rt.from[1]);
      const b = toVec3(rt.to[0], rt.to[1]);
      const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -0.9999, 0.9999);
      const omega = Math.acos(dot);
      const sinO = Math.sin(omega) || 1e-6;
      const pts = [];
      for (let s = 0; s <= 36; s++) {
        const u = s / 36;
        const ka = Math.sin((1 - u) * omega) / sinO;
        const kb = Math.sin(u * omega) / sinO;
        const vx = ka * a[0] + kb * b[0];
        const vy = ka * a[1] + kb * b[1];
        const vz = ka * a[2] + kb * b[2];
        const latD = (Math.asin(clamp(vy, -1, 1)) * 180) / Math.PI;
        const lonD = (Math.atan2(vz, vx) * 180) / Math.PI;
        const loft = 1 + 0.045 * Math.sin(Math.PI * u);
        const p = projectLatLon(latD, lonD, loft);
        if (p.visible) pts.push(p);
      }
      if (pts.length >= 2) {
        const col = rt.color || theme.accent;
        // Soft outer glow stroke
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = hexAlpha(col, 0.28);
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Crisp core arc
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // Endpoint landing station rings
        for (const ep of [projectLatLon(rt.from[0], rt.from[1], 1.0), projectLatLon(rt.to[0], rt.to[1], 1.0)]) {
          if (!ep.visible) continue;
          const pulseR = 3.5 + ((t * 1.6 + idx * 0.3) % 1) * 8;
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = hexAlpha(col, 0.45);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        }

        const pulseIdx = Math.floor((((t * 0.85 + idx * 0.23) % 1) * (pts.length - 1)));
        const hp = pts[pulseIdx];
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    });
    ctx.restore();

    TELEMETRY.registerNode({
      id: opts.id || `globe_${frameRegistry.nodes.length}`,
      role: 'diagram',
      text: '',
      x: cx - r, y: cy - r, w: r * 2, h: r * 2,
      opacity: 1,
    });
  }

  /**
   * Code / Terminal Card with deterministic typing & focus highlight.
   */
  function drawCodeCard(ctx, rect, opts = {}) {
    const theme = getTheme(opts.theme);
    const localT = opts.localT ?? 2;
    const delay = opts.delay || 0;
    const lines = opts.lines || ['const frame = seek(t);', 'renderToMp4({ fps: 30 });'];
    const card = drawCard(ctx, rect, {
      ...opts,
      theme,
      fill: '#090D16',
      borderColor: 'rgba(255,255,255,0.14)',
      padding: 22,
      entrance: { delay, dur: 0.46 },
    });
    if (!card) return;

    // Window traffic-light dots + title
    ctx.save();
    ['#EF4444', '#F59E0B', '#10B981'].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(card.inner.x + 8 + i * 20, card.inner.y + 8, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });
    if (opts.filename) {
      drawTextAutoFit(ctx, opts.filename, { x: card.inner.x + 76, y: card.inner.y - 2, w: card.inner.w - 80, h: 20 }, {
        id: `${card.id}_fn`, role: 'label', maxPx: 15, fontFamily: theme.fontMono, color: '#94A3B8', bgHint: '#090D16', allowOverlapIds: [card.id],
      });
    }

    const footerH = card.inner.h > 260 ? 34 : 0;
    const availH = Math.max(36, card.inner.h - 38 - footerH);
    const maxSlotH = 42;
    const stepH = Math.min(maxSlotH, Math.floor(availH / Math.max(1, lines.length)));
    const codeStartY = card.inner.y + 38;
    const lineSlots = lines.map((_, idx) => ({
      x: card.inner.x + 38,
      y: codeStartY + idx * stepH,
      w: Math.max(40, card.inner.w - 42),
      h: Math.max(20, stepH - 6),
    }));
    const typeDur = opts.typeDur || 1.2;
    const totalChars = lines.reduce((acc, l) => acc + l.length, 0) || 1;
    let budget = Math.floor(clamp((localT - delay - 0.15) / typeDur, 0, 1) * totalChars);

    lines.forEach((ln, i) => {
      const visible = opts.instant ? ln : ln.slice(0, Math.max(0, budget));
      budget -= ln.length;
      if (!visible) return;
      const isHighlight = Array.isArray(opts.highlightLines) && opts.highlightLines.includes(i);
      if (isHighlight) {
        roundRectPath(ctx, card.inner.x - 4, lineSlots[i].y - 3, card.inner.w + 8, lineSlots[i].h + 6, 6);
        ctx.fillStyle = hexAlpha(theme.accent, 0.14);
        ctx.fill();
      }
      // Subtle IDE gutter line number
      ctx.font = `500 14px ${theme.fontMono}`;
      ctx.fillStyle = isHighlight ? hexAlpha(theme.accent, 0.85) : 'rgba(148,163,184,0.42)';
      ctx.textAlign = 'right';
      ctx.__mvsInternalText = true;
      ctx.fillText(String(i + 1).padStart(2, '0'), card.inner.x + 24, lineSlots[i].y + lineSlots[i].h * 0.72);
      ctx.__mvsInternalText = false;

      drawTextAutoFit(ctx, visible, lineSlots[i], {
        id: `${card.id}_ln_${i}`,
        role: 'body',
        maxPx: 21,
        minPx: 13,
        maxLines: 1,
        fontFamily: theme.fontMono,
        color: isHighlight ? theme.accent : '#E2E8F0',
        bgHint: '#090D16',
        allowOverlapIds: [card.id],
      });
    });

    if (footerH > 0) {
      const fy = card.inner.y + card.inner.h - 22;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(card.inner.x, fy - 12);
      ctx.lineTo(card.inner.x + card.inner.w, fy - 12);
      ctx.stroke();
      ctx.fillStyle = theme.ok || '#34D399';
      ctx.beginPath();
      ctx.arc(card.inner.x + 8, fy + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 12px ${theme.fontMono}`;
      ctx.fillStyle = 'rgba(148,163,184,0.68)';
      ctx.textAlign = 'left';
      ctx.__mvsInternalText = true;
      ctx.fillText(`TELEMETRY SYNC · ${lines.length} OPS · UTF-8`, card.inner.x + 20, fy + 6);
      ctx.__mvsInternalText = false;
    }
    ctx.restore();
  }

  /**
   * Japanese FUI Monitor Graphics Hairline Overlay (0.12 / 0.38 / 1.0 strict opacity hierarchy).
   */
  function drawHudOverlay(ctx, width, height, t, opts = {}) {
    TELEMETRY.markCliche('hud-chrome');
    const theme = getTheme(opts.theme);
    const m = Math.round(Math.min(width, height) * 0.032);
    const len = 18;
    ctx.save();
    ctx.strokeStyle = hexAlpha(opts.color || theme.fg, 0.24);
    ctx.lineWidth = 1;
    const corners = [
      [m, m, 1, 1],
      [width - m, m, -1, 1],
      [m, height - m, 1, -1],
      [width - m, height - m, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * len, cy);
      ctx.stroke();
    }
    if (opts.tag) {
      ctx.font = `600 13px ${theme.fontMono}`;
      ctx.fillStyle = hexAlpha(opts.color || theme.fg, 0.38);
      ctx.textAlign = 'right';
      ctx.__mvsInternalText = true;
      ctx.fillText(`${opts.tag} · T+${t.toFixed(2)}s`, width - m - 8, m + 16);
      ctx.__mvsInternalText = false;
    }
    ctx.restore();
  }

  // ============================================================================
  // 8. SMART WORD-POP CAPTIONS (AUTO SAFE-ZONE + HERO DEDUPLICATION)
  // ============================================================================
  function tokenSimilarity(a, b) {
    const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const ta = new Set(norm(a));
    const tb = new Set(norm(b));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    for (const w of ta) if (tb.has(w)) inter++;
    return inter / Math.min(ta.size, tb.size);
  }

  function drawCaptions(ctx, timeline, t, opts = {}) {
    if (!timeline || !Array.isArray(timeline.captions) || opts.suppressCaptions) return;
    const ms = t * 1000;
    const page = timeline.captions.find((c) => ms >= c.startMs && ms < c.startMs + c.durationMs);
    if (!page || !page.text) return;

    // Auto-dedup: if a hero/title node currently on screen already shows the same words, skip!
    const existingHero = frameRegistry.nodes.find(
      (n) => (n.role === 'hero' || n.role === 'title') && tokenSimilarity(n.text, page.text) >= 0.65
    );
    if (existingHero) return;

    const W = timeline.width || ctx.canvas.width;
    const H = timeline.height || ctx.canvas.height;
    const safe = computeSafeZone(W, H);
    const theme = getTheme(opts.theme);
    const capH = safe.aspect === '9:16' ? 96 : 68;
    const capBox = {
      x: safe.x + Math.round(safe.w * 0.08),
      y: safe.y + safe.h - capH,
      w: Math.round(safe.w * 0.84),
      h: capH,
    };

    ctx.save();
    roundRectPath(ctx, capBox.x - 16, capBox.y - 6, capBox.w + 32, capBox.h + 12, 16);
    ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
    ctx.fill();

    let displayStr = page.text;
    let activeWord = null;
    if (Array.isArray(page.tokens) && page.tokens.length) {
      const tok = page.tokens.find((tk) => ms >= tk.fromMs && ms <= tk.toMs);
      if (tok) activeWord = tok.text;
    }

    drawTextAutoFit(ctx, displayStr, capBox, {
      id: 'mvs_active_caption',
      role: 'caption',
      align: 'center',
      valign: 'middle',
      maxPx: safe.aspect === '9:16' ? 50 : 38,
      minPx: 22,
      fontFamily: theme.fontDisplay,
      color: activeWord && displayStr.trim() === activeWord.trim() ? theme.accent : '#FFFFFF',
      bgHint: '#080A10',
    });
    ctx.restore();
  }

  // ============================================================================
  // 9. WEBGL2 PROCEDURAL SHADER BACKDROPS (6 ZERO-DEP PRESETS)
  // ============================================================================
  const SHADER_PRESETS = {
    'stripe-mesh': `
      float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      void main(){
        vec2 uv=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);
        float t=u_time*0.35; vec2 p=uv*1.6;
        for(float i=1.0;i<4.0;i++){
          p.x+=0.42/i*sin(i*2.3*p.y+t+0.3*i);
          p.y+=0.42/i*cos(i*1.9*p.x-t*0.8+0.7*i);
        }
        float m=0.5+0.5*sin(p.x+p.y); float n=0.5+0.5*cos(p.x*1.4-p.y);
        vec3 col=mix(mix(vec3(0.04,0.06,0.12),vec3(0.14,0.22,0.54),m),
                     mix(vec3(0.06,0.58,0.58),vec3(0.92,0.32,0.20),n),
                     smoothstep(-0.6,0.8,uv.y+0.25*sin(p.x)));
        col+=(hash21(gl_FragCoord.xy+fract(t))-0.5)/255.0;
        fragColor=vec4(col,1.0);
      }`,
    'aurora-gyroid': `
      mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
      float gyroid(vec3 p){return dot(sin(p),cos(p.yzx));}
      void main(){
        vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
        vec3 col=mix(vec3(0.02,0.03,0.07),vec3(0.05,0.09,0.16),uv.y+0.5);
        float t=u_time*0.25;
        for(float i=0.0;i<4.0;i++){
          vec2 q=uv*rot(0.18*i); q.x*=0.65;
          float wave=gyroid(vec3(q*(3.2+i),t+i*1.7));
          float curtain=exp(-abs(q.y-0.18*wave+0.05*i)*(7.0+i*2.0));
          vec3 tint=mix(vec3(0.10,0.85,0.68),vec3(0.45,0.32,0.95),i/3.0);
          col+=curtain*tint*(0.34-0.05*i);
        }
        col=1.0-exp(-col*1.25);
        fragColor=vec4(col,1.0);
      }`,
    'architectural-grid': `
      void main(){
        vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
        vec3 sky=mix(vec3(0.04,0.05,0.09),vec3(0.09,0.13,0.22),clamp(uv.y*2.0+0.3,0.0,1.0));
        if(uv.y<-0.02){
          float z=0.45/abs(uv.y);
          vec2 g=vec2(uv.x*z*2.0,z+u_time*1.2);
          vec2 fw=fwidth(g);
          vec2 grid2=abs(fract(g-0.5)-0.5)/fw;
          float line=1.0-min(min(grid2.x,grid2.y),1.0);
          float fog=exp(-z*0.14);
          vec3 fl=vec3(0.03,0.04,0.07)+line*vec3(0.18,0.58,0.95)*0.45*fog;
          fragColor=vec4(mix(sky,fl,smoothstep(-0.02,-0.08,uv.y)),1.0);
        } else {
          fragColor=vec4(sky+exp(-abs(uv.y+0.02)*18.0)*vec3(0.18,0.45,0.85)*0.32,1.0);
        }
      }`,
  };

  function createShaderBackdrop(glCanvas, preset = 'stripe-mesh') {
    const gl = glCanvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) return () => {};
    const vsSrc = `#version 300 es
      void main(){
        vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2);
        gl_Position=vec4(p*2.0-1.0, 0.0, 1.0);
      }`;
    const body = SHADER_PRESETS[preset] || preset;
    const fsSrc = `#version 300 es
      precision highp float;
      uniform vec2 u_res;
      uniform float u_time;
      out vec4 fragColor;
      ${body}`;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    return function drawShader(t) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  // ============================================================================
  // 10. CINEMATOGRAPHY RIG, 3-ACT TEMPORAL EVOLUTION & 8-TRANSITION MONTAGE
  // ============================================================================

  /**
   * Computes a 3-Act Intra-Scene Temporal Envelope:
   * - act1Enter (0..1): Primary staggered reveal (0%..22%)
   * - act2Focus (0..1): Secondary focus / camera push / callout reveal (ramps 36%..66%)
   * - act3Exit  (0..1): Pre-roll anticipation into outgoing cut (last 0.28s)
   */
  function sceneActs(localT, duration) {
    const dur = Math.max(0.4, duration || 3.5);
    const progress = clamp(localT / dur, 0, 1);
    const act1Enter = EASE.kireOut(clamp(localT / Math.min(0.65, dur * 0.24), 0, 1));
    const act2Focus = EASE.studioInOut(clamp((progress - 0.34) / 0.30, 0, 1));
    const preRollSpan = Math.min(0.30, dur * 0.14);
    const act3Exit = EASE.quadInExact(clamp((localT - (dur - preRollSpan)) / Math.max(0.05, preRollSpan), 0, 1));
    const focusPulse = Math.sin(clamp((progress - 0.34) / 0.52, 0, 1) * Math.PI);
    return { progress, act1Enter, act2Focus, act3Exit, focusPulse };
  }

  /**
   * Smoothly pushes & pans the virtual camera toward `targetRect` by `amount` (0..1).
   */
  function withCameraFocus(ctx, width, height, targetRect, amount, maxZoom = 1.18, drawFn) {
    const a = clamp(amount, 0, 1);
    const z = expZoom(1.0, maxZoom, a);
    TELEMETRY.setCameraZoom(z);
    ctx.save();
    if (targetRect && (targetRect.w < width * 0.90 || targetRect.h < height * 0.90)) {
      // Sub-slot lens zoom: clip cleanly to the panel frame and focus toward upper-right data peak
      roundRectPath(ctx, targetRect.x, targetRect.y, targetRect.w, targetRect.h, 22);
      ctx.clip();
      const fx = targetRect.x + targetRect.w * 0.62;
      const fy = targetRect.y + targetRect.h * 0.44;
      ctx.translate(fx, fy);
      ctx.scale(z, z);
      ctx.translate(-fx, -fy);
    } else {
      const cx = targetRect ? targetRect.x + targetRect.w * 0.5 : width * 0.5;
      const cy = targetRect ? targetRect.y + targetRect.h * 0.5 : height * 0.5;
      const panX = lerp(width * 0.5, cx, a * 0.42);
      const panY = lerp(height * 0.5, cy, a * 0.42);
      ctx.translate(width * 0.5, height * 0.5);
      ctx.scale(z, z);
      ctx.translate(-panX, -panY);
    }
    try {
      drawFn();
    } finally {
      ctx.restore();
    }
  }

  /**
   * Multi-plane depth parallax (-1 = background 0.25x, 0 = midground 1x, +1 = foreground HUD 1.35x).
   */
  function withParallax(ctx, localT, depthZ = 0, drawFn) {
    const dx = Math.sin(localT * 0.55) * 14 * depthZ;
    const dy = Math.cos(localT * 0.42) * 8 * depthZ;
    ctx.save();
    ctx.translate(dx, dy);
    try {
      drawFn();
    } finally {
      ctx.restore();
    }
  }

  /**
   * Architectural 45-degree leader-line callout spotlight (Act-II detail reveal).
   */
  function drawCallout(ctx, anchorPt, badgeRect, opts = {}) {
    const theme = getTheme(opts.theme);
    const localT = opts.localT ?? 1;
    const delay = opts.delay ?? 0.9;
    const reveal = EASE.kireOut(clamp((localT - delay) / (opts.dur ?? 0.42), 0, 1));
    if (reveal <= 0.01) return;

    const [ax, ay] = anchorPt;
    const bx = badgeRect.x + (ax < badgeRect.x ? 0 : ax > badgeRect.x + badgeRect.w ? badgeRect.w : badgeRect.w * 0.5);
    const by = badgeRect.y + badgeRect.h * 0.5;
    const elbowX = lerp(ax, bx, 0.45);
    const accent = opts.color || theme.accent;

    ctx.save();
    ctx.globalAlpha *= reveal;

    // Pulsing target reticle on focal detail
    const pulse = 1 + Math.sin(localT * 5.2) * 0.16;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 8 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Progressive leader line
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    const seg1 = clamp(reveal * 2, 0, 1);
    ctx.lineTo(lerp(ax, elbowX, seg1), lerp(ay, by, seg1));
    if (reveal > 0.5) {
      const seg2 = clamp((reveal - 0.5) * 2, 0, 1);
      ctx.lineTo(lerp(elbowX, bx, seg2), by);
    }
    ctx.stroke();

    // Callout pill surface + auto-fit label
    drawCard(ctx, badgeRect, {
      id: opts.id ? `${opts.id}_card` : 'callout_card',
      theme,
      fill: theme.surfaceHi || theme.surface,
      borderColor: accent,
      radius: 12,
      shadow: true,
    });
    const inner = insetRect(badgeRect, 14, 8);
    drawTextAutoFit(ctx, opts.text || opts.label || '', inner, {
      id: opts.id || 'callout_txt',
      role: 'label',
      color: theme.fg,
      bg: theme.surfaceHi || theme.surface,
      fontFamily: theme.fontMono,
      weight: 600,
      maxPx: 22,
      minPx: 13,
    });
    ctx.restore();
  }

  // ============================================================================
  // 10B. CINEMA, DOCUMENTARY, MULTIPLANE 2.5D & ANALOG OPTICS STUDIO
  // ============================================================================
  let _grainTileCanvas = null;
  function getFilmGrainTile() {
    if (_grainTileCanvas || typeof document === 'undefined') return _grainTileCanvas;
    const size = 192;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const gctx = c.getContext('2d');
    const img = gctx.createImageData(size, size);
    const d = img.data;
    const rand = mulberry32(0x3500f117);
    for (let i = 0; i < d.length; i += 4) {
      // Gaussian-like 2-sample sum centered at 128 for organic Kodak Vision3 luminance grain
      const v = Math.round(clamp(((rand() + rand()) * 0.5) * 255, 0, 255));
      d[i] = v;
      d[i + 1] = Math.max(0, v - 3);
      d[i + 2] = Math.max(0, v - 7);
      d[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    _grainTileCanvas = c;
    return c;
  }

  function computeLetterboxBar(W, H, ratioSpec) {
    if (!ratioSpec || ratioSpec === 'none' || H > W) return 0;
    let targetAspect = 0;
    if (ratioSpec === '2.39:1' || ratioSpec === 'anamorphic' || ratioSpec === 2.39) targetAspect = 2.39;
    else if (ratioSpec === '2.00:1' || ratioSpec === 'univisium') targetAspect = 2.0;
    else if (ratioSpec === '1.85:1') targetAspect = 1.85;
    if (!targetAspect) return 0;
    const activeH = Math.round(W / targetAspect);
    return Math.max(0, Math.round((H - activeH) * 0.5));
  }

  /**
   * Applies organic cinema & editorial optics: 35mm film grain, paper linen fibers,
   * warm chiaroscuro vignette, subtle halation glow, and 2.39:1 / 1.85:1 cinema mattes.
   */
  function applyCinemaOptics(ctx, width, height, t, opts = {}) {
    if (!opts) return;
    const grain = opts.grain !== undefined ? opts.grain : 0.042;
    const vignette = opts.vignette !== undefined ? opts.vignette : 0.34;
    const halation = opts.halation || 0;
    const paper = Boolean(opts.paperTexture);
    const barH = computeLetterboxBar(width, height, opts.letterbox);

    ctx.save();
    if (vignette > 0.005) {
      const r0 = Math.min(width, height) * 0.34;
      const r1 = Math.hypot(width, height) * 0.58;
      const vg = ctx.createRadialGradient(width * 0.5, height * 0.5, r0, width * 0.5, height * 0.5, r1);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(5,4,3,${clamp(vignette, 0, 0.85).toFixed(3)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
    }

    if (halation > 0.005) {
      const hg = ctx.createRadialGradient(width * 0.5, height * 0.36, 10, width * 0.5, height * 0.42, width * 0.55);
      hg.addColorStop(0, `rgba(235, 165, 92, ${clamp(halation, 0, 0.25).toFixed(3)})`);
      hg.addColorStop(1, 'rgba(235, 165, 92, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (paper) {
      ctx.strokeStyle = 'rgba(40, 32, 22, 0.028)';
      ctx.lineWidth = 1;
      const step = 6;
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + ((y * 13) % 3));
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    if (grain > 0.004) {
      const tile = getFilmGrainTile();
      if (tile) {
        const frameStep = Math.floor(Math.max(0, t) * 24);
        const ox = (frameStep * 73) % 192;
        const oy = (frameStep * 137) % 192;
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = clamp(grain, 0, 0.16);
        const pat = ctx.createPattern(tile, 'repeat');
        if (pat) {
          ctx.translate(-ox, -oy);
          ctx.fillStyle = pat;
          ctx.fillRect(ox, oy, width + 192, height + 192);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (barH > 2) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, barH);
      ctx.fillRect(0, height - barH, width, barH);
    }
    ctx.restore();
  }

  /**
   * Renders real HD photography, museum art, or extracted video sequences with
   * 2.5D Ken Burns camera motion, archival museum matting, chiaroscuro scrims, or knockout typography!
   */
  function drawImagePlate(ctx, keyOrImg, rect, opts = {}) {
    const img = typeof keyOrImg === 'string' ? getAsset(keyOrImg) : keyOrImg;
    const theme = getTheme(opts.theme);
    const style = opts.style || 'full-bleed'; // 'full-bleed' | 'archival-plate' | 'editorial-frame' | 'knockout-type'
    const progress = clamp(opts.progress ?? 0.5, 0, 1);
    const localT = opts.localT ?? 1;
    const anim = opts.entrance === false
      ? { opacity: 1, y: 0, scale: 1 }
      : entrance(localT, opts.entrance || { delay: opts.delay || 0, dur: 0.65, bounce: 0.04, risePx: style === 'full-bleed' ? 0 : 22 });
    if (anim.opacity < 0.02) return;

    const zoom = expZoom(opts.zoomFrom ?? 1.02, opts.zoomTo ?? 1.11, progress);
    const panX = lerp(opts.panFromX ?? -0.02, opts.panToX ?? 0.02, progress);
    const panY = lerp(opts.panFromY ?? -0.015, opts.panToY ?? 0.015, progress);

    const drawCoverInside = (box) => {
      if (!img || !img.width || !img.height) {
        const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
        g.addColorStop(0, theme.surface);
        g.addColorStop(1, theme.bgAlt || theme.bg);
        ctx.fillStyle = g;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        return;
      }
      const scale = Math.max(box.w / img.width, box.h / img.height) * zoom;
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = box.x + (box.w - dw) * 0.5 + panX * box.w;
      const dy = box.y + (box.h - dh) * 0.5 + panY * box.h;
      if (opts.filter) ctx.filter = opts.filter;
      ctx.drawImage(img, dx, dy, dw, dh);
      if (opts.filter) ctx.filter = 'none';
    };

    ctx.save();
    ctx.globalAlpha *= anim.opacity;

    if (style === 'knockout-type' && opts.text) {
      const off = document.createElement('canvas');
      off.width = Math.max(16, Math.round(rect.w));
      off.height = Math.max(16, Math.round(rect.h));
      const octx = off.getContext('2d');
      octx.fillStyle = '#FFFFFF';
      octx.font = `${opts.weight || 800} ${opts.fontPx || Math.round(rect.h * 0.68)}px ${opts.fontFamily || theme.fontDisplay}`;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(String(opts.text), off.width * 0.5, off.height * 0.5, off.width * 0.96);
      octx.globalCompositeOperation = 'source-in';
      if (img && img.width) {
        const sc = Math.max(off.width / img.width, off.height / img.height) * zoom;
        octx.drawImage(img, (off.width - img.width * sc) * 0.5, (off.height - img.height * sc) * 0.5, img.width * sc, img.height * sc);
      }
      ctx.drawImage(off, rect.x, rect.y + anim.y);
      ctx.restore();
      TELEMETRY.registerNode({
        id: opts.id || 'knockout_title',
        role: 'hero',
        text: String(opts.text),
        x: rect.x,
        y: rect.y + anim.y,
        w: rect.w,
        h: rect.h,
        fg: theme.fg,
        bg: theme.bg,
        skipContrast: true,
      });
      return;
    }

    if (style === 'archival-plate') {
      const tiltRad = ((opts.tiltDeg || 0) * Math.PI) / 180;
      const cx = rect.x + rect.w * 0.5;
      const cy = rect.y + rect.h * 0.5 + anim.y;
      ctx.translate(cx, cy);
      ctx.rotate(tiltRad);
      ctx.scale(anim.scale, anim.scale);
      ctx.translate(-cx, -cy);

      const matPad = opts.matPadding ?? 16;
      const captionSpace = opts.caption ? 38 : 0;
      // Soft museum paper drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      roundRectPath(ctx, rect.x + 6, rect.y + 14, rect.w, rect.h, 4);
      ctx.fill();
      // Warm cotton archival paper mat
      ctx.fillStyle = opts.matColor || '#F6F1E7';
      roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 18, 15, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const inner = {
        x: rect.x + matPad,
        y: rect.y + matPad,
        w: Math.max(16, rect.w - matPad * 2),
        h: Math.max(16, rect.h - matPad * 2 - captionSpace),
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(inner.x, inner.y, inner.w, inner.h);
      ctx.clip();
      drawCoverInside(inner);
      if (opts.tint) {
        ctx.fillStyle = opts.tint;
        ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
      }
      ctx.restore();

      if (opts.caption) {
        ctx.__mvsInternalText = true;
        ctx.font = `500 13px ${theme.fontMono}`;
        ctx.fillStyle = '#3F3A34';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(opts.caption), inner.x, inner.y + inner.h + captionSpace * 0.54, inner.w);
        ctx.__mvsInternalText = false;
      }
      const worldRect = projectRect(ctx.getTransform(), rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
      TELEMETRY.registerNode({ id: opts.id || 'archival_plate', role: 'diagram', text: '', ...worldRect, opacity: anim.opacity });
      return;
    }

    // 'full-bleed' or 'editorial-frame'
    const radius = style === 'editorial-frame' ? (opts.radius ?? 10) : 0;
    ctx.save();
    if (radius > 0) {
      roundRectPath(ctx, rect.x, rect.y + anim.y, rect.w, rect.h, radius);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
    }
    drawCoverInside({ x: rect.x, y: rect.y + anim.y, w: rect.w, h: rect.h });

    // Directional Chiaroscuro Scrim so frameless editorial typography reads cleanly without boxes!
    if (opts.scrim) {
      const strength = opts.scrimStrength ?? 0.78;
      let sg;
      if (opts.scrim === 'left') {
        sg = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w * 0.72, 0);
        sg.addColorStop(0, hexAlpha(theme.bg, strength));
        sg.addColorStop(0.55, hexAlpha(theme.bg, strength * 0.58));
        sg.addColorStop(1, hexAlpha(theme.bg, 0.08));
      } else if (opts.scrim === 'right') {
        sg = ctx.createLinearGradient(rect.x + rect.w, 0, rect.x + rect.w * 0.28, 0);
        sg.addColorStop(0, hexAlpha(theme.bg, strength));
        sg.addColorStop(0.55, hexAlpha(theme.bg, strength * 0.58));
        sg.addColorStop(1, hexAlpha(theme.bg, 0.08));
      } else {
        // 'bottom' / 'cinema'
        sg = ctx.createLinearGradient(0, rect.y + rect.h, 0, rect.y + rect.h * 0.18);
        sg.addColorStop(0, hexAlpha(theme.bg, strength));
        sg.addColorStop(0.5, hexAlpha(theme.bg, strength * 0.45));
        sg.addColorStop(1, hexAlpha(theme.bg, opts.scrim === 'cinema' ? 0.22 : 0.06));
      }
      ctx.fillStyle = sg;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    ctx.restore();

    if (style === 'editorial-frame') {
      TELEMETRY.registerNode({ id: opts.id || 'editorial_frame', role: 'diagram', text: '', x: rect.x, y: rect.y + anim.y, w: rect.w, h: rect.h, opacity: anim.opacity });
    }
  }

  /**
   * Vox / Documentary organic ink highlighter stroke swept progressively behind or under key text.
   */
  function drawHighlighter(ctx, rect, progress = 1, color = '#EAB308', opts = {}) {
    const p = EASE.studioInOut(clamp(progress, 0, 1));
    if (p <= 0.01) return;
    const w = rect.w * p;
    ctx.save();
    ctx.globalAlpha *= opts.alpha ?? 0.34;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(rect.x - 4, rect.y + 3);
    ctx.lineTo(rect.x + w + 4, rect.y + 1);
    ctx.lineTo(rect.x + w, rect.y + rect.h - 1);
    ctx.lineTo(rect.x - 6, rect.y + rect.h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderTimeline(ctx, timeline, sceneRenderers, t, opts = {}) {
    const W = timeline.width || ctx.canvas.width;
    const H = timeline.height || ctx.canvas.height;
    const opticsCfg = opts.optics !== undefined ? opts.optics : (timeline.optics || timeline.creativeDirection?.optics || null);
    const barH = computeLetterboxBar(W, H, opticsCfg?.letterbox);
    const rawSafe = computeSafeZone(W, H, timeline.meta?.aspect || 'auto');
    const safe = barH > 0 ? {
      ...rawSafe,
      y: Math.max(rawSafe.y, barH + 28),
      h: Math.max(120, Math.min(rawSafe.y + rawSafe.h, H - barH - 28) - Math.max(rawSafe.y, barH + 28)),
    } : rawSafe;
    const baseTheme = getTheme(opts.theme || timeline.meta?.style);
    const scenes = timeline.scenes || [];
    const baseTransDur = opts.transitionDur !== undefined ? opts.transitionDur : 0.38;

    let activeIdx = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration);
    if (activeIdx === -1) activeIdx = t < (scenes[0]?.start || 0) ? 0 : Math.max(0, scenes.length - 1);
    const cur = scenes[activeIdx];
    if (!cur) return;
    const theme = resolveSceneTheme(baseTheme, cur);

    const localT = Math.max(0, t - cur.start);
    const mode = cur.transition || opts.transition || 'whip';
    const transDur = mode === 'cut' ? 0 : baseTransDur;
    TELEMETRY.beginFrame(t, cur.id);

    const invokeScene = (sc, scLocalT, alpha = 1, offsetX = 0, scaleMul = 1, offsetY = 0) => {
      const fn = sceneRenderers[sc.id] || sceneRenderers.default;
      if (typeof fn !== 'function') return;
      const scTheme = resolveSceneTheme(baseTheme, sc);
      ctx.save();
      ctx.globalAlpha *= clamp(alpha, 0, 1);

      // Continuous Japanese Yoin subtle camera drift + Act-III exit anticipation
      const acts = sceneActs(scLocalT, sc.duration);
      const driftZoom = opts.cameraDrift === false ? scaleMul : expZoom(1.0, 1.028, acts.progress) * scaleMul;
      const driftX = (opts.cameraDrift === false ? 0 : (acts.progress - 0.5) * 14) + offsetX;
      ctx.translate(W * 0.5 + driftX, H * 0.5 + offsetY);
      ctx.scale(driftZoom, driftZoom);
      ctx.translate(-W * 0.5, -H * 0.5);

      TELEMETRY.setScene(sc.id);
      fn({
        ctx,
        t,
        localT: scLocalT,
        duration: sc.duration,
        progress: acts.progress,
        acts,
        scene: sc,
        safe,
        width: W,
        height: H,
        theme: scTheme,
      });
      ctx.restore();
    };

    // 8-Mode Motivated Cinematographic Transition Engine
    if (activeIdx > 0 && transDur > 0.02 && localT < transDur) {
      const prev = scenes[activeIdx - 1];
      const prevLocalT = t - prev.start;
      const u = EASE.studioInOut(clamp(localT / transDur, 0, 1));

      if (mode === 'portal' || mode === 'zoom-in') {
        invokeScene(prev, prevLocalT, 1 - u, 0, expZoom(1.0, 1.46, u));
        invokeScene(cur, localT, u, 0, expZoom(0.76, 1.0, u));
      } else if (mode === 'zoom-out') {
        invokeScene(prev, prevLocalT, 1 - u, 0, expZoom(1.0, 0.68, u));
        invokeScene(cur, localT, u, 0, expZoom(1.32, 1.0, u));
      } else if (mode === 'push-up') {
        invokeScene(prev, prevLocalT, 1 - u * 0.55, 0, lerp(1.0, 0.91, u), -u * H * 0.32);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, H * (1 - u), W, H * u);
        ctx.clip();
        invokeScene(cur, localT, 1, 0, 1, (1 - u) * H * 0.24);
        ctx.restore();
      } else if (mode === 'iris') {
        invokeScene(prev, prevLocalT, 1 - u * 0.35, 0, 1);
        const maxR = Math.hypot(W, H) * 0.62;
        const r = Math.max(2, u * maxR);
        ctx.save();
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.5, r, 0, Math.PI * 2);
        ctx.clip();
        invokeScene(cur, localT, 1, 0, expZoom(0.92, 1.0, u));
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.5, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (mode === 'dissolve') {
        invokeScene(prev, prevLocalT, 1 - u, 0, 1);
        invokeScene(cur, localT, u, 0, 1);
      } else if (mode === 'whip-right') {
        invokeScene(prev, prevLocalT, 1 - u * 0.85, u * W * 0.22, 1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W * u, H);
        ctx.clip();
        invokeScene(cur, localT, 1, -(1 - u) * W * 0.14, 1);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W * u, 0);
        ctx.lineTo(W * u, H);
        ctx.stroke();
        ctx.restore();
      } else {
        // 'whip' / 'whip-left'
        invokeScene(prev, prevLocalT, 1 - u * 0.85, -u * W * 0.22, 1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(W * (1 - u), 0, W * u, H);
        ctx.clip();
        invokeScene(cur, localT, 1, (1 - u) * W * 0.14, 1);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(W * (1 - u), 0);
        ctx.lineTo(W * (1 - u), H);
        ctx.stroke();
        ctx.restore();
      }

      if (localT < transDur * 0.85) {
        frameRegistry.nodes = [];
      }
    } else {
      invokeScene(cur, localT, 1, 0, 1);
    }

    drawCaptions(ctx, timeline, t, { theme, suppressCaptions: cur.suppressCaptions || opts.suppressCaptions });
    if (opticsCfg) {
      applyCinemaOptics(ctx, W, H, t, opticsCfg);
    }
  }

  // ============================================================================
  // 11. CORS-SAFE ZERO-KEY VISUAL ASSET PRELOADER
  // ============================================================================
  const assetCache = {};

  async function preloadImage(key, url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    assetCache[key] = img;
    return img;
  }

  async function preloadBundle(bundleMap) {
    const map = bundleMap || (typeof window !== 'undefined' ? window.__MVS_ASSETS__ : null) || {};
    const entries = Object.entries(map);
    await Promise.all(entries.map(([k, dataUri]) => preloadImage(k, dataUri).catch(() => null)));
    return Object.keys(assetCache);
  }

  async function preloadSvgText(key, svgText) {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      return await preloadImage(key, url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function preloadIconify(key, iconSpec, colorHex = '#F8FAFC', size = 256) {
    const [prefix, name] = iconSpec.includes(':') ? iconSpec.split(':') : ['lucide', iconSpec];
    const encoded = encodeURIComponent(colorHex);
    const url = `https://api.iconify.design/${prefix}/${name}.svg?color=${encoded}&width=${size}`;
    const svg = await (await fetch(url)).text();
    return preloadSvgText(key, svg);
  }

  function getAsset(key) {
    return assetCache[key] || null;
  }

  // ============================================================================
  // 12. WARM STUDIO WEBAUDIO SYNTHESIZER (PAUL KELLET PINK NOISE + VOCAL CARVE)
  // ============================================================================
  function audioBufferToWavBase64(buf) {
    const ch = buf.numberOfChannels;
    const len = buf.length * ch * 2;
    const ab = new ArrayBuffer(44 + len);
    const v = new DataView(ab);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, 'RIFF'); v.setUint32(4, 36 + len, true); wr(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true);
    v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); wr(36, 'data'); v.setUint32(40, len, true);
    const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
    let off = 44;
    for (let i = 0; i < buf.length; i++) {
      for (let c = 0; c < ch; c++) {
        const s = clamp(chans[c][i], -1, 1);
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    const bytes = new Uint8Array(ab);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  async function synthStudioAudio(opts = {}) {
    if (typeof OfflineAudioContext === 'undefined') return null;
    const bpm = opts.bpm || 120;
    const duration = opts.duration || 15;
    const sr = opts.sampleRate || 44100;
    const beat = 60 / bpm;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
    const rand = mulberry32(opts.seed || 0x2026cafe);

    const master = ctx.createGain();
    master.gain.setValueAtTime(opts.gain ?? 0.55, 0);
    master.gain.setValueAtTime(opts.gain ?? 0.55, Math.max(0, duration - 0.45));
    master.gain.linearRampToValueAtTime(0.0001, duration);
    master.connect(ctx.destination);

    // -4.5 dB @ 1250 Hz vocal-formant carve so speech always sits cleanly on top
    const vocalCarve = ctx.createBiquadFilter();
    vocalCarve.type = 'peaking';
    vocalCarve.frequency.value = 1250;
    vocalCarve.Q.value = 0.9;
    vocalCarve.gain.value = -4.5;
    vocalCarve.connect(master);

    // Paul Kellet pink noise buffer
    const pLen = Math.ceil(Math.min(4, duration) * sr);
    const pinkBuf = ctx.createBuffer(1, pLen, sr);
    const pd = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < pLen; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.76160 * b5 - w * 0.0168980;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }

    const CHORDS = [
      { bass: 87.31, notes: [174.61, 220.0, 261.63, 329.63, 392.0] },
      { bass: 82.41, notes: [164.81, 196.0, 246.94, 293.66, 392.0] },
      { bass: 73.42, notes: [146.83, 174.61, 220.0, 261.63, 329.63] },
      { bass: 65.41, notes: [130.81, 196.0, 246.94, 293.66, 329.63] },
    ];

    const barDur = beat * 4;
    const numBars = Math.ceil(duration / barDur);
    for (let bar = 0; bar < numBars; bar++) {
      const t0 = bar * barDur;
      if (t0 >= duration) break;
      const chd = CHORDS[bar % CHORDS.length];
      const dur = Math.min(barDur, duration - t0);

      // Warm detuned pad
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(540, t0);
      lp.frequency.exponentialRampToValueAtTime(960, t0 + dur * 0.38);
      lp.frequency.exponentialRampToValueAtTime(560, t0 + dur);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.linearRampToValueAtTime(0.14 / Math.sqrt(chd.notes.length), t0 + 0.16);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.06);
      lp.connect(cg).connect(vocalCarve);
      chd.notes.forEach((f, idx) => {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          const pan = ctx.createStereoPanner();
          o.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
          o.frequency.value = f;
          o.detune.value = det;
          pan.pan.value = det < 0 ? -0.32 : 0.32;
          o.connect(pan).connect(lp);
          o.start(t0);
          o.stop(t0 + dur + 0.08);
        }
      });

      // Soft bass
      const bs = ctx.createOscillator();
      const bg = ctx.createGain();
      bs.type = 'sine';
      bs.frequency.value = chd.bass;
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.linearRampToValueAtTime(0.28, t0 + 0.03);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.85);
      bs.connect(bg).connect(vocalCarve);
      bs.start(t0);
      bs.stop(t0 + dur * 0.88);

      // Felt kick + brushed pink-noise shaker
      for (let step = 0; step < 8; step++) {
        const st = t0 + step * (beat * 0.5);
        if (st >= duration) break;
        if (step === 0 || step === 5) {
          const ko = ctx.createOscillator();
          const kg = ctx.createGain();
          ko.frequency.setValueAtTime(112, st);
          ko.frequency.exponentialRampToValueAtTime(45, st + 0.09);
          kg.gain.setValueAtTime(0.001, st);
          kg.gain.linearRampToValueAtTime(0.42, st + 0.006);
          kg.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
          ko.connect(kg).connect(vocalCarve);
          ko.start(st);
          ko.stop(st + 0.24);
        }
        const sh = ctx.createBufferSource();
        sh.buffer = pinkBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 5600;
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.0001, st);
        sg.gain.linearRampToValueAtTime(step % 2 === 0 ? 0.065 : 0.035, st + 0.008);
        sg.gain.exponentialRampToValueAtTime(0.0001, st + 0.055);
        sh.connect(bp).connect(sg).connect(vocalCarve);
        sh.start(st, (rand() * 1.2) % Math.max(0.1, pinkBuf.duration - 0.1), 0.065);
      }
    }

    // Scene transition pink-noise whoosh cues
    if (Array.isArray(opts.cues)) {
      for (const cueTime of opts.cues) {
        if (cueTime <= 0.05 || cueTime >= duration - 0.2) continue;
        const wSrc = ctx.createBufferSource();
        wSrc.buffer = pinkBuf;
        const wBp = ctx.createBiquadFilter();
        wBp.type = 'bandpass';
        wBp.Q.value = 1.8;
        wBp.frequency.setValueAtTime(220, Math.max(0, cueTime - 0.14));
        wBp.frequency.exponentialRampToValueAtTime(2400, cueTime + 0.02);
        wBp.frequency.exponentialRampToValueAtTime(280, cueTime + 0.22);
        const wG = ctx.createGain();
        wG.gain.setValueAtTime(0.0001, Math.max(0, cueTime - 0.14));
        wG.gain.linearRampToValueAtTime(0.22, cueTime);
        wG.gain.exponentialRampToValueAtTime(0.0001, cueTime + 0.24);
        wSrc.connect(wBp).connect(wG).connect(master);
        wSrc.start(Math.max(0, cueTime - 0.14), 0, 0.40);
      }
    }

    const rendered = await ctx.startRendering();
    return { mime: 'wav', base64: audioBufferToWavBase64(rendered) };
  }

  /**
   * Articulated geometric editorial character (Buck / Kurzgesagt flat-vector style).
   * Eliminates crude "stick figure" programmer art when offline.
   */
  function drawActor(ctx, opts = {}) {
    const x = opts.x ?? 960;
    const y = opts.y ?? 700; // ground / anchor point
    const scale = opts.scale ?? 1.0;
    const pose = opts.pose || 'present'; // 'stand' | 'walk' | 'present' | 'meditate'
    const t = opts.t ?? 0;
    const facing = opts.facing === -1 ? -1 : 1;
    const coat = opts.accentColor || '#38BDF8';
    const skin = opts.skinColor || '#F4C29F';
    const pants = opts.pantsColor || '#1E293B';
    const hair = opts.hairColor || '#0F172A';
    const id = opts.id || 'actor';

    const breath = idleNoise(t, 7, 0.55) * 3;
    const walkPhase = t * 5.2;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * scale, scale);

    // Ground contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.ellipse(0, 0, pose === 'meditate' ? 54 : 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawCapsule = (x1, y1, x2, y2, w, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    if (pose === 'meditate') {
      const floatY = -18 + breath * 1.4;
      // Crossed legs
      drawCapsule(-34, floatY - 10, 12, floatY - 4, 20, pants);
      drawCapsule(34, floatY - 10, -12, floatY - 4, 20, pants);
      // Torso pill
      drawCapsule(0, floatY - 24, 0, floatY - 82, 42, coat);
      // Relaxed arms to knees
      drawCapsule(-16, floatY - 74, -36, floatY - 22, 15, coat);
      drawCapsule(16, floatY - 74, 36, floatY - 22, 15, coat);
      // Head + hair cap
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, floatY - 114, 21, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(0, floatY - 119, 21.5, Math.PI, Math.PI * 2); ctx.fill();
    } else {
      const stride = pose === 'walk' ? Math.sin(walkPhase) * 22 : 0;
      const liftL = pose === 'walk' ? Math.max(0, -Math.cos(walkPhase) * 10) : 0;
      const liftR = pose === 'walk' ? Math.max(0, Math.cos(walkPhase) * 10) : 0;
      // Back & front legs
      drawCapsule(-8, -74, -10 - stride, -10 - liftL, 18, '#0F172A');
      drawCapsule(8, -74, 10 + stride, -10 - liftR, 18, pants);
      // Torso coat
      drawCapsule(0, -78 + breath * 0.5, 0, -142 + breath, 40, coat);
      // Back arm
      drawCapsule(-14, -134 + breath, -24 - stride * 0.6, -86 + breath, 15, coat);
      // Front arm (pointing/presenting or swinging)
      if (pose === 'present') {
        const wave = Math.sin(t * 3.2) * 5;
        drawCapsule(14, -134 + breath, 48, -146 + wave + breath, 15, coat);
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.arc(52, -147 + wave + breath, 8, 0, Math.PI * 2); ctx.fill();
      } else {
        drawCapsule(14, -134 + breath, 22 + stride * 0.6, -86 + breath, 15, coat);
      }
      // Neck + Head + Hair
      drawCapsule(0, -148 + breath, 0, -158 + breath, 12, skin);
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(2, -176 + breath, 21, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(0, -181 + breath, 22, Math.PI * 0.92, Math.PI * 2.05); ctx.fill();
    }

    ctx.restore();
    TELEMETRY.record({
      id,
      kind: 'graphic',
      rect: { x: x - 60 * scale, y: y - 205 * scale, w: 120 * scale, h: 210 * scale },
    });
  }

  /**
   * Multi-Universe Cinema & Documentary Score Synthesizer (with J-Cut pre-transition swells).
   * Moods: 'cinema-strings' | 'documentary-felt' | 'minimal-luxury' | 'tech-pulse'
   */
  async function synthCinemaScore(opts = {}) {
    const mood = opts.mood || 'cinema-strings';
    if (mood === 'tech-pulse') return synthStudioAudio(opts);
    if (typeof OfflineAudioContext === 'undefined') return null;

    const bpm = opts.bpm || (mood === 'cinema-strings' ? 76 : mood === 'documentary-felt' ? 88 : 72);
    const duration = opts.duration || 15;
    const sr = opts.sampleRate || 44100;
    const beat = 60 / bpm;
    const jCutSec = opts.jCutSec ?? 0.38;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
    const rand = mulberry32(opts.seed || 0x35c14e7a);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, 0);
    master.gain.linearRampToValueAtTime(opts.gain ?? 0.58, Math.min(0.6, duration * 0.1));
    master.gain.setValueAtTime(opts.gain ?? 0.58, Math.max(0.7, duration - 0.85));
    master.gain.linearRampToValueAtTime(0.0001, duration);
    master.connect(ctx.destination);

    // Vocal formant pocket (-4.5 dB @ 1.3 kHz)
    const carve = ctx.createBiquadFilter();
    carve.type = 'peaking';
    carve.frequency.value = 1300;
    carve.Q.value = 0.85;
    carve.gain.value = -4.5;
    carve.connect(master);

    // Subtle analog room/tape warmth bed (Paul Kellet pink noise filtered at 650 Hz)
    const pLen = Math.ceil(Math.min(4, duration) * sr);
    const pinkBuf = ctx.createBuffer(1, pLen, sr);
    const pd = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < pLen; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.76160 * b5 - w * 0.0168980;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.10;
      b6 = w * 0.115926;
    }
    const roomSrc = ctx.createBufferSource();
    roomSrc.buffer = pinkBuf;
    roomSrc.loop = true;
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.value = 520;
    const roomG = ctx.createGain();
    roomG.gain.value = mood === 'minimal-luxury' ? 0.012 : 0.024;
    roomSrc.connect(roomLp).connect(roomG).connect(carve);
    roomSrc.start(0);
    roomSrc.stop(duration);

    const PROGRESSIONS = {
      'cinema-strings': [
        { bass: 73.42, chord: [146.83, 220.0, 293.66, 349.23], motif: [440.0, 523.25] },   // Dm9
        { bass: 58.27, chord: [116.54, 174.61, 261.63, 329.63], motif: [392.0, 440.0] },   // Bbmaj9
        { bass: 87.31, chord: [174.61, 261.63, 329.63, 440.0], motif: [523.25, 587.33] },  // Fmaj7
        { bass: 65.41, chord: [130.81, 196.0, 293.66, 392.0], motif: [493.88, 440.0] },    // Csus2/G
      ],
      'documentary-felt': [
        { bass: 110.0, chord: [220.0, 261.63, 329.63, 392.0], motif: [523.25, 493.88, 392.0] },
        { bass: 87.31, chord: [174.61, 261.63, 329.63, 392.0], motif: [440.0, 523.25, 392.0] },
        { bass: 130.81, chord: [196.0, 261.63, 329.63, 392.0], motif: [587.33, 523.25, 440.0] },
        { bass: 98.0, chord: [196.0, 246.94, 293.66, 392.0], motif: [493.88, 440.0, 392.0] },
      ],
      'minimal-luxury': [
        { bass: 82.41, chord: [164.81, 246.94, 311.13, 392.0], motif: [622.25] },
        { bass: 65.41, chord: [130.81, 196.0, 246.94, 369.99], motif: [587.33] },
      ],
    };
    const prog = PROGRESSIONS[mood] || PROGRESSIONS['cinema-strings'];
    const barDur = beat * 4;
    const bars = Math.ceil(duration / barDur);

    for (let bar = 0; bar < bars; bar++) {
      const t0 = bar * barDur;
      if (t0 >= duration) break;
      const dur = Math.min(barDur, duration - t0);
      const p = prog[bar % prog.length];

      // Bowed warm cello / ensemble pad
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(mood === 'cinema-strings' ? 420 : 620, t0);
      lp.frequency.exponentialRampToValueAtTime(mood === 'cinema-strings' ? 1150 : 880, t0 + dur * 0.55);
      lp.frequency.exponentialRampToValueAtTime(460, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.18 / Math.sqrt(p.chord.length), t0 + Math.min(0.65, dur * 0.28));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.12);
      lp.connect(g).connect(carve);

      p.chord.forEach((freq, idx) => {
        for (const det of [-7, 0, 7]) {
          const osc = ctx.createOscillator();
          const pan = ctx.createStereoPanner();
          osc.type = mood === 'cinema-strings' ? (det === 0 ? 'triangle' : 'sawtooth') : 'sine';
          osc.frequency.value = freq;
          osc.detune.value = det + idx * 1.5;
          pan.pan.value = det * 0.045;
          osc.connect(pan).connect(lp);
          osc.start(t0);
          osc.stop(t0 + dur + 0.15);
        }
      });

      // Deep cinema contrabass / sub foundation
      const sub = ctx.createOscillator();
      const subG = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.value = p.bass;
      subG.gain.setValueAtTime(0.0001, t0);
      subG.gain.linearRampToValueAtTime(0.30, t0 + 0.18);
      subG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.95);
      sub.connect(subG).connect(carve);
      sub.start(t0);
      sub.stop(t0 + dur);

      // Intimate felt-piano / glass harmonic motif notes
      p.motif.forEach((mFreq, mIdx) => {
        const nt = t0 + (mIdx + 0.5) * (dur / (p.motif.length + 0.6));
        if (nt >= duration - 0.15) return;
        const mo = ctx.createOscillator();
        const mo2 = ctx.createOscillator();
        const flt = ctx.createBiquadFilter();
        const mg = ctx.createGain();
        mo.type = 'triangle';
        mo.frequency.value = mFreq;
        mo2.type = 'sine';
        mo2.frequency.value = mFreq * 2;
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(1800, nt);
        flt.frequency.exponentialRampToValueAtTime(520, nt + 1.1);
        mg.gain.setValueAtTime(0.0001, nt);
        mg.gain.linearRampToValueAtTime(0.11, nt + 0.022); // soft felt hammer attack
        mg.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, nt + 1.45));
        const g2 = ctx.createGain();
        g2.gain.value = 0.18;
        mo.connect(flt);
        mo2.connect(g2).connect(flt);
        flt.connect(mg).connect(carve);
        mo.start(nt); mo2.start(nt);
        mo.stop(Math.min(duration, nt + 1.5)); mo2.stop(Math.min(duration, nt + 1.5));
      });
    }

    // J-Cut Pre-Transition Swells (sound leads the visual cut by `jCutSec` ~0.38s!)
    if (Array.isArray(opts.cues)) {
      for (const cueTime of opts.cues) {
        if (cueTime <= 0.2 || cueTime >= duration - 0.2) continue;
        const startSw = Math.max(0, cueTime - jCutSec);
        // Warm reverse harmonic + breath swell peaking right onto the cut, then deep cinema thud
        const sw = ctx.createBufferSource();
        sw.buffer = pinkBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(180, startSw);
        bp.frequency.exponentialRampToValueAtTime(980, cueTime);
        bp.frequency.exponentialRampToValueAtTime(210, Math.min(duration, cueTime + 0.35));
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.0001, startSw);
        sg.gain.exponentialRampToValueAtTime(0.19, cueTime);
        sg.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, cueTime + 0.38));
        sw.connect(bp).connect(sg).connect(master);
        sw.start(startSw, 0, jCutSec + 0.42);

        // Soft timpani / cinema impact on cut frame
        const imp = ctx.createOscillator();
        const ig = ctx.createGain();
        imp.type = 'sine';
        imp.frequency.setValueAtTime(78, cueTime);
        imp.frequency.exponentialRampToValueAtTime(34, Math.min(duration, cueTime + 0.34));
        ig.gain.setValueAtTime(0.0001, cueTime);
        ig.gain.linearRampToValueAtTime(0.32, cueTime + 0.012);
        ig.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, cueTime + 0.42));
        imp.connect(ig).connect(master);
        imp.start(cueTime);
        imp.stop(Math.min(duration, cueTime + 0.45));
      }
    }

    const rendered = await ctx.startRendering();
    return { mime: 'wav', base64: audioBufferToWavBase64(rendered) };
  }

  const MVS = {
    version: '3.0.0',
    clamp,
    lerp,
    remap,
    mulberry32,
    hashFloat,
    cubicBezier,
    EASE,
    spring,
    springApple,
    springTimeline,
    idleNoise,
    expZoom,
    squashStretch,
    entrance,
    sceneActs,
    withCameraFocus,
    withParallax,
    oklch,
    mixOklch,
    studioShadePair,
    THEMES,
    FONT_PAIRINGS,
    loadGoogleFonts,
    getTheme,
    resolveSceneTheme,
    computeSafeZone,
    computeLetterboxBar,
    vstack,
    hstack,
    bentoGrid,
    insetRect,
    shotLayout,
    drawTextAutoFit,
    drawBackdrop,
    drawCard,
    drawMetricCard,
    drawAreaChart,
    drawBarChart,
    drawIsometricStack,
    drawFlowBeam,
    drawGlobeWire,
    drawCodeCard,
    drawActor,
    drawCallout,
    drawHudOverlay,
    drawImagePlate,
    drawHighlighter,
    applyCinemaOptics,
    drawCaptions,
    createShaderBackdrop,
    renderTimeline,
    preloadImage,
    preloadBundle,
    preloadSvgText,
    preloadIconify,
    getAsset,
    synthStudioAudio,
    synthCinemaScore,
    TELEMETRY,
  };

  if (root && typeof root === 'object') {
    root.MVS = MVS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MVS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
