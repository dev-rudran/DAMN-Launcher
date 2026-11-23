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
  const games = sortGames(dedupeById(all));

  if (cfg.limit) {
    console.log(`[indexer] --limit set (${cfg.limit}): not writing index.`);
    console.log(JSON.stringify(games.slice(0, cfg.limit).map(({ title, source, date, repack_size }) => ({ title, source, date, repack_size })), null, 2));
    return;
  }

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
  const out = path.join(cfg.dataDir, 'index.json');
  await fs.writeFile(out, JSON.stringify(index));
  console.log(`[indexer] wrote ${games.length} games -> ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
