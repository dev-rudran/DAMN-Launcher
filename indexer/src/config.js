import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

export function loadConfig() {
  const file = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  const proxy =
    process.env.DAMN_PROXY_URL || process.env.HTTPS_PROXY || process.env.https_proxy || file.proxy || '';
  const sources = {};
  for (const [name, cfg] of Object.entries(file.sources)) {
    sources[name] = { base: String(cfg.base).replace(/\/+$/, ''), ...cfg };
  }
  const args = process.argv.slice(2);
  const bySource = [];
  const wantLimit = { value: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source') bySource.push(args[++i]);
    else if (args[i] === '--limit') wantLimit.value = parseInt(args[++i], 10) || 0;
  }
  const selected = bySource.length ? bySource.filter((s) => sources[s]) : Object.keys(sources);
  return {
    file,
    proxy,
    sources,
    selected,
    limit: wantLimit.value,
    root,
    dataDir: path.join(root, file.dataDir || 'data'),
    posterDir: path.join(root, file.posterDir || path.join('data', 'posters')),
    posterOptimize: file.posterOptimize ?? true,
    posterMaxBytes: file.posterMaxBytes ?? 900e6,
    posterMaxCount: file.posterMaxCount ?? 6000,
  };
}
