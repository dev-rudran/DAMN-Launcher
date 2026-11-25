import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.js';
import { makeFetcher } from './net.js';
import { crawlFitGirl } from './fitgirl.js';
import { crawlDodi } from './dodi.js';
import { crawlAnkerGames } from './ankergames.js';
import { runPosters } from './poster.js';
import { sortGames, dedupeById } from './extract.js';

const cfg = loadConfig();
const http = makeFetcher({ proxy: cfg.proxy });
const opts = { limit: cfg.limit };

const SOURCES = { fitgirl: crawlFitGirl, dodi: crawlDodi, ankergames: crawlAnkerGames };

async function main() {
  const all = [];
  const stats = {};
  for (const name of cfg.selected) {
    const fn = SOURCES[name];
    if (!fn) { console.error(`[indexer] unknown source: ${name}`); continue; }
    const t0 = Date.now();
    try {
      const games = name === 'ankergames' ? await fn(cfg, opts) : await fn(cfg, http, opts);
      stats[name] = { count: games.length, ms: Date.now() - t0 };
      all.push(...games);
      console.log(`[indexer] ${name}: ${games.length} games (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      stats[name] = { error: e.message, ms: Date.now() - t0 };
      console.error(`[indexer] ${name} FAILED: ${e.message}`);
    }
  }
  // --limit bounds the crawl; merge with the existing index by id so a
  // partial run refreshes what it re-crawled and keeps everything else.
  const outPath = path.join(cfg.dataDir, 'index.json');
  const byId = new Map();
  try {
    const existing = JSON.parse(await fs.readFile(outPath, 'utf8'));
    if (Array.isArray(existing?.games)) for (const g of existing.games) if (g?.id) byId.set(g.id, g);
    if (byId.size) console.log(`[indexer] merging with ${byId.size} existing games`);
  } catch { /* no existing index */ }
  for (const g of all) if (g?.id) byId.set(g.id, g);

  const games = sortGames(dedupeById([...byId.values()]));

  await runPosters(cfg, http, games);
  await fs.mkdir(cfg.dataDir, { recursive: true });
  const index = {
    meta: {
      version: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
      game_count: games.length,
      sources: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v.count ?? 0])),
      source_stats: stats,
    },
    games,
  };
  await fs.writeFile(outPath, JSON.stringify(index));
  console.log(`[indexer] wrote ${games.length} games -> ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
