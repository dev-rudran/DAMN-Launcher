import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

function sniffExt(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return '.gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[10] === 0x57) return '.webp';
  return null;
}

function sniffMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[10] === 0x57) return 'image/webp';
  return 'application/octet-stream';
}

export async function runPosters(cfg, http, games) {
  const sharp = cfg.posterOptimize ? await import('sharp').then((m) => m.default).catch(() => null) : null;
  if (cfg.posterOptimize && !sharp) console.warn('[posters] sharp not available — posters will be stored unoptimized');
  const dir = cfg.posterDir;
  await fs.mkdir(dir, { recursive: true });
  const results = [];
  for (const g of games) {
    const poster = g.poster;
    if (!poster) { results.push({ id: g.id, ok: false, path: null }); continue; }
    if (!poster.startsWith('http')) { results.push({ id: g.id, ok: true, path: poster }); continue; }
    try {
      const buf = await http.bytes(poster, { headers: { accept: 'image/*' } });
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
      let out;
      if (sharp && cfg.posterOptimize) {
        out = path.join(dir, `${g.source}-${hash}.webp`);
        await sharp(buf).resize(1400, null, { withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(out);
      } else {
        const ext = sniffExt(buf) || '.jpg';
        out = path.join(dir, `${g.source}-${hash}${ext}`);
        await fs.writeFile(out, buf);
      }
      const rel = path.relative(cfg.dataDir, out).split(path.sep).join('/');
      g.poster = rel;
      results.push({ id: g.id, ok: true, path: rel, bytes: buf.length, mime: sniffMime(buf) });
    } catch (e) {
      console.error(`[posters] ${g.id}: ${e.message}`);
      results.push({ id: g.id, ok: false, path: g.poster, error: e.message });
    }
  }
  await enforceCap(cfg);
  return results;
}

async function enforceCap(cfg) {
  try {
    const dir = cfg.posterDir;
    const files = await fs.readdir(dir);
    const valid = await Promise.all(files.map(async (f) => {
      const p = path.join(dir, f);
      try {
        const s = await fs.stat(p);
        return { f: p, bytes: s.size, mtime: s.mtimeMs };
      } catch { return null; }
    }));
    let stats = valid.filter(Boolean);
    let total = stats.reduce((a, s) => a + s.bytes, 0);
    if (total <= cfg.posterMaxBytes && stats.length <= cfg.posterMaxCount) return;
    stats.sort((a, b) => a.mtime - b.mtime);
    for (const s of stats) {
      if (total <= cfg.posterMaxBytes && stats.length <= cfg.posterMaxCount) break;
      try {
        await fs.unlink(s.f);
        total -= s.bytes;
        stats = stats.filter((x) => x !== s);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
