# DAMN Launcher — indexer

Builds the static game index consumed by the launcher:

- **fitgirl** — [fitgirl-repacks.site](https://fitgirl-repacks.site) (WordPress blog of FitGirl repacks)
- **dodi** — [dodi-repacks.site](https://dodi-repacks.site) (WordPress blog of Dodi repacks)
- **ankergames** — [ankergames.net](https://ankergames.net) (Laravel app with a card list)

Output: `data/index.json` (+ optimized poster art under `data/posters/`). The launcher (a static PWA, served from GitHub Pages) reads this index.

## Install

```sh
npm ci            # or: npm install
```

## Run

```sh
node src/index.js                       # full run: all sources, write data/index.json
node src/index.js --source dodi --limit 5   # smoke test
node src/index.js --source fitgirl --limit 20
```

## Proxy support

If the sources are blocked from your network, set a proxy. Supported: HTTP, HTTPS, SOCKS5 (via an HTTP CONNECT tunnel — see notes below).

```sh
DAMN_PROXY_URL=http://127.0.0.1:1080 npm run index
```

A VPN that creates a system-wide proxy works too.

Notes:
- SOCKS5 socks5:// URLs are passed to undici's ProxyAgent. Some SOCKS servers need an HTTP CONNECT wrapper; in that case run a local HTTP proxy in front of it.
- `DAMN_PROXY_URL`, `HTTPS_PROXY`, `https_proxy` env vars are read in that order of precedence (DAMN_PROXY_URL first), then `config.json` `proxy`.

## Config (`config.json`)

| field | meaning |
|---|---|
| `proxy` | default proxy URL |
| `sources.<name>.base` | base URL of the site (all other domains removed by design) |
| `sources.<name>.maxPages` | pagination cap (`0` = unlimited) |
| `sources.<name>.slowDownMs` | polite delay between requests |
| `dataDir` / `posterDir` | output dirs |
| `posterOptimize` | shrink posters with sharp (WebP, max width 1400) |
| `posterMaxBytes` / `posterMaxCount` | soft caps for the poster store |

## CI

`.github/workflows/index.yml` runs the indexer daily and uploads `indexer/data` as an artifact.
