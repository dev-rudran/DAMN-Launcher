import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { cleanText, parseDate, parseRequirements, grab, parseSize } from './extract.js';

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PY_SCRIPT = path.join(HERE, 'anker_fetch.py');

/** Fetch HTML from ankergames.net via python/curl_cffi (Cloudflare blocks plain fetch). */
async function ankerText(url) {
  const { stdout } = await execFileAsync(process.env.DAMN_PYTHON || 'python3', [PY_SCRIPT, url], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

function cardsFromList($) {
  const cards = [];
  const seen = new Set();
  $('[data-game-url]').each((_, el) => {
    const url = ($(el).attr('data-game-url') || '').replace(/\\/g, '').trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    let slug = '';
    try {
      slug = new URL(url, 'https://ankergames.net').pathname.split('/').filter(Boolean)[1] || '';
    } catch { slug = ''; }
    if (!slug) return;
    const title = $(el).attr('data-game-title') || $(el).find('h3[title]').first().attr('title') || '';
    const poster = $(el).attr('data-game-image') || $(el).find('img[src]').first().attr('src') || null;
    const text = cleanText($(el).text());
    const version = text.match(/(?:^|\s)(?:Version|Build|B)\s+([0-9][0-9.]*)/)?.[1] || null;
    const size = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB|TB)\b/)?.[0] || null;
    cards.push({ url, slug, title, poster, version, size });
  });
  return cards;
}

function crawlGamePage(cfg, card) {
  return (async () => {
    const html = await ankerText(card.url);
    const $ = load(html);
    const bodyText = cleanText($('body').text());
    const slug = card.slug;
    const id = `ankergames:${slug}`;

    const title = $('h1').first().text().trim() || card.title || slug;
    const poster = $('img[src*="/uploads/poster/"]').first().attr('src') || card.poster || null;

    const version =
      (() => {
        const spans = $('span').map((_, el) => cleanText($(el).text())).get()
        const i = spans.findIndex((s) => /^current version\s*$/i.test(s))
        if (i >= 0 && spans[i + 1]) return spans[i + 1]
        const m = bodyText.match(/Current Version[^\n]{0,30}/i)
        return m ? m[0].replace(/^Current Version\s*/i, '').trim() : null
      })() ||
      grab(html, /"softwareVersion"\s*:\s*"([^"]+)"/i) ||
      card.version ||
      null;
    const size =
      grab(html, /"fileSize"\s*:\s*"([^"]+)"/i) ||
      grab(bodyText, /\bPC\s+([\d.]+)\s*(GB|MB|KB|TB)/i) ||
      card.size ||
      null;
    const repackSize = parseSize(size);

    const credits = (grab(bodyText, /Release Group\s*:?\s*([^\n<]+)/i) || '')
      .split('/')
      .map(cleanText)
      .filter(Boolean);

    const genres = [
      ...new Set(
        $('a[href*="/genre/"]')
          .slice(0, 12)
          .map((_, el) => cleanText($(el).text()))
          .get(),
      ),
    ].filter(Boolean);

    // Requirements: prefer the embedded JSON blob, fall back to visible text.
    let requirements = {};
    const blob = (html.match(/"softwareRequirements"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1];
    if (blob) {
      const text = blob.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\"/g, '"');
      requirements = parseRequirements(text);
    }
    if (Object.keys(requirements).length === 0) requirements = parseRequirements(bodyText);

    const fm = bodyText.toLowerCase().indexOf('game features');
    const fi = bodyText.toLowerCase().indexOf('installation guide');
    const features = fm >= 0
      ? bodyText
          .slice(fm, fi > fm ? fi : undefined)
          .split('\n')
          .map((s) => s.replace(/^[•*-]\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 30)
      : [];

    const screenshots = [];
    const seen = new Set();
    $('img[src*="/uploads/screenshots/"]').each((_, el) => {
      const s = ($(el).attr('src') || '').trim();
      if (s && !seen.has(s)) { seen.add(s); screenshots.push(s); }
    });

    const date =
      parseDate(grab(html, /"datePublished"\s*:\s*"([^"]+)"/i)) ||
      parseDate(grab(html, /"Published"\s*:\s*"([^"]+)"/i)) ||
      parseDate(bodyText.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || '') ||
      null;

    return {
      id,
      source: 'ankergames',
      slug,
      site_url: card.url,
      title: title || slug,
      name: title || slug,
      version,
      date,
      genres,
      companies: null,
      repack_size: repackSize ? repackSize.label : size || null,
      repack_size_bytes: repackSize ? repackSize.bytes : null,
      requirements,
      features,
      install_time: null,
      description: null,
      screenshots: screenshots.slice(0, 10),
      poster,
      credits,
      links: [{ type: 'site', provider: 'AnkerGames', url: card.url }],
      is_trending: false,
    };
  })();
}

export async function crawlAnkerGames(cfg, opts = {}) {
  const base = cfg.sources.ankergames.base;
  const cache = new Map();

  async function crawlCard(card) {
    if (!card || !card.url) return null;
    if (cache.has(card.url)) return cache.get(card.url);
    try {
      const game = await crawlGamePage(cfg, card);
      cache.set(card.url, game);
      return game;
    } catch (e) {
      console.error(`[anker] crawl failed ${card.url}: ${e.message}`);
      return null;
    }
  }

  const main = [];
  const html = await ankerText(`${base}/games-list`);
  const cards = cardsFromList(load(html));
  for (const card of cards) {
    if (opts.limit && main.length >= opts.limit) break;
    const g = await crawlCard(card);
    if (g) main.push(g);
  }

  // Trending pages (best effort; don't fail the whole crawl if missing).
  for (const path of ['/top-games', '/trending']) {
    try {
      const html2 = await ankerText(`${base}${path}`);
      const tcards = cardsFromList(load(html2));
      const trending = [];
      for (const card of tcards) {
        const g = cache.get(card.url) || (await crawlCard(card));
        if (g) trending.push(g);
      }
      for (const g of trending) if (!main.some((m) => m.id === g.id)) main.push(g);
      for (const g of main) if (trending.some((t) => t.id === g.id)) g.is_trending = true;
    } catch { /* optional */ }
  }

  return main;
}
