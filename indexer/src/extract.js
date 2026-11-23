import { load } from 'cheerio';

export function cleanText(s) {
  return (s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\/g, '') // Strip WP-escaped dots etc.
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function parseSize(s) {
  if (s == null) return null;
  const text = String(s).replace(/\\/g, '').trim();
  if (!text) return null;
  // Handles: "25 GB", "from 1.7/1.9 GB", "136.7 GB", "145 GB available space", "10,498,834,432 bytes"
  const m = text.match(/([0-9][0-9,\s]*(?:\.[0-9]+)?)\s*(b|byte|bytes|kb|kib|mb|mib|gb|gib|tb|tib)\b/i);
  if (!m) {
    const b = text.match(/(\d[\d,]*)\s*bytes?\b/i);
    if (b) return { label: text, bytes: +b[1].replace(/,/g, ''), unit: 'bytes' };
    return { label: text, bytes: null, unit: null };
  }
  const value = parseFloat(m[1].replace(/[\s,]/g, ''));
  const unit = m[2].toLowerCase().replace(/s$/, '');
  const mult = { b: 1, byte: 1, kb: 1024, kib: 1024, mb: 1024 ** 2, mib: 1024 ** 2, gb: 1024 ** 3, gib: 1024 ** 3, tb: 1024 ** 4, tib: 1024 ** 4 };
  const bytes = Math.round(value * (mult[unit] ?? mult[unit + 'b'] ?? 1024 ** 3));
  return { label: `${value} ${unit.toUpperCase()}`, bytes, unit };
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDate(s) {
  if (!s) return null;
  const text = String(s).trim();
  if (!text) return null;
  let m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    const [d, mo] = a > 12 ? [a, b] : [b, a]; // DD/MM is the FitGirl convention
    return iso(y, mo, d);
  }
  m = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    const [d, mo] = a > 12 ? [a, b] : [b, a];
    return iso(y, mo, d);
  }
  m = text.match(/(\w{3,9})\s+(\d{1,2}),?\s*(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  return null;
}

/** Parse "OS: Windows 10/11", "Processor: Intel ...", "Storage: 145 GB" style lines into an object. */
export function parseRequirements(text) {
  const out = {};
  if (!text) return out;
  const lines = String(text).split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z .\-]{0,30}):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
    if (Object.prototype.hasOwnProperty.call(out, key)) continue;
    out[key] = cleanText(m[2]).slice(0, 300);
  }
  return out;
}

/**
 * Parse an "Key: Value" block where values may run together on one line.
 * Returns { key.toLowerCase(): value } sliced up to the next known key.
 */
export function parseKVBlock(text, keys) {
  const out = {};
  if (!text) return out;
  const keySet = new Set(keys.map((k) => k.toLowerCase()));
  const norm = (k) => {
    const l = k.toLowerCase();
    if (keySet.has(l)) return l;
    const s = l.replace(/s$/, '');
    if (keySet.has(s)) return s;
    return null;
  };
  const re = new RegExp(`(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:\\-–]\\s*`, 'gi');
  const matches = [...text.matchAll(re)].map((m) => ({ ...m, key: norm(m[1]) })).filter((m) => m.key);
  for (let i = 0; i < matches.length; i++) {
    const key = matches[i].key;
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const v = cleanText(text.slice(start, end)).slice(0, 400);
    if (v && !out[key]) out[key] = v;
  }
  return out;
}

/** Grab the first match of a regex from a text block and clean it. */
export function grab(text, re, flags = '') {
  if (!text) return null;
  const m = String(text).match(re);
  if (!m || m[1] == null || m[1] === '') return null;
  const v = cleanText(m[1]);
  return v || null;
}

export function dedupeById(games) {
  const seen = new Set();
  return games.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

export function sortGames(games) {
  return [...games].sort((a, b) => {
    const da = a.date || '0000-00-00';
    const db = b.date || '0000-00-00';
    return db.localeCompare(da) || a.source.localeCompare(b.source) || a.slug.localeCompare(b.slug);
  });
}

/** Extract first N unique image srcs from a cheerio doc. */
export function imgSrcs($, selector, opts = {}) {
  const out = [];
  const seen = new Set();
  $('img').each((i, el) => {
    const src = ($(el).attr('src') || '').trim();
    if (!src || src.startsWith('data:')) return;
    if (seen.has(src)) return;
    seen.add(src);
    if (opts.hostname && !src.includes(opts.hostname)) return;
    if (opts.max && out.length >= opts.max) return;
    out.push(src);
  });
  return out;
}
