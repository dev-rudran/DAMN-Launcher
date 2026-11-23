# DAMN Launcher

Frontend game launcher: a console-style browser app (PWA) that browses indexed game libraries.

## Stack

- [Vite](https://vite.dev) + [Svelte](https://svelte.dev) — the UI, static SPA.
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) — service worker (precaches app + `data/index.json`; posters lazy-cached).
- Gamepad API — controller navigation (stick/d-pad, rumble where available).

## Commands

```sh
npm install
npm run sync-data    # copy indexer/data → public/data (index.json + posters)
npm run build
npm run preview
```

## Controller keys

| Input | Action |
|---|---|
| Left stick / D-Pad | Move focus |
| A | Open game details |
| B | Back |
| X | Toggle favorite |
| Y | Open search |
| LB / RB | Page up / down |

Keyboard equivalents: arrows, Enter, Esc, `/`, `T` (theme), `S` (sound), `F` (favorite).

## Data

The launcher reads `/data/index.json`, produced by the indexer (`indexer/`). Without it, the
library shows an empty state with instructions.
