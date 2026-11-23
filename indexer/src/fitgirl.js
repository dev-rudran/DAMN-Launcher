import { load } from 'cheerio';
import { cleanText, parseDate, parseSize, grab } from './extract.js';

const SKIP = new Set([
  'author', 'page', 'tag', 'category', 'feed', 'sitemap.xml', 'robots.txt', 'xmlrpc.php', 'login',
  'register', 'comments', 'wp-login.php', 'wp-json', 'faq', 'donations', 'donate', 'donate-by-mining',
  'contacts', 'repacks-troubleshooting', 'all-my-repacks', 'all-my-repacks-a-z', 'site-map', 'rss',
  'archives', 'search', 'error', '404', 'lostpassword', 'redirect', 'installers', 'contact',
  'privacy-policy', 'cookie-policy', 'terms-of-service', 'release-archive', 'releases',
]);

function cleanSlug(s) {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[–—\-_/]+/g, '-')
    .replace(/[^a-z0-9\-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function slugFromUrl(u, base) {
  try {
    const path = new URL(u).pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length !== 1) return null;
    const slug = parts[0].toLowerCase();
    if (!slug || SKIP.has(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

/** Anchor hrefs on the same host whose path is exactly one non-reserved segment (repack slug). */
function findPostLinks($, base) {
  const bh = (() => { try { return new URL(base).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    let u;
    try { u = new URL(href, base); } catch { return; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (bh && u.hostname.replace(/^www\./, '') !== bh) return;
    const slug = slugFromUrl(u.href, base);
    if (!slug) return;
    links.add(u.href);
  });
  return [...links];
}

function parseTagList(text) {
  return text
    .split(/[,|;]+/)
    .map((s) => s.replace(/[<>[\]()*`]|<a|\\|\/$/g, '').trim())
    .filter(Boolean);
}

function extractFitGirl(http, url) {
  return (async () => {
    const html = await http.text(url);
    const $ = load(html);
    const bodyText = cleanText($('body').text());
    const slug = slugFromUrl(url, url) || cleanSlug(url) || url.split('/').filter(Boolean).pop();
    const id = `fitgirl:${slug}`;

    const title = $('h1').first().text() || grab(bodyText, /^#\s*(.+?)\s*$/) || '';
    const date = parseDate(grab(bodyText, /Posted on\s*(?:the\s+)?(\d{2}\/\d{2}\/\d{4})/i) || grab(bodyText, /(\d{2}\/\d{2}\/\d{4})/)) || null;

    const genres = parseTagList(grab(bodyText, /Genres\/Tags:\s*([^\n]+)/i) || '');
    const companies = parseTagList(grab(bodyText, /Compan(?:y|ies):\s*([^\n]+)/i) || '');
    const languages = parseTagList(grab(bodyText, /Languages:\s*([^\n]+)/i) || '');
    const originalSize = parseSize(grab(bodyText, /Original Size:\s*([^\n;]+)/i));
    const repackSize = parseSize(grab(bodyText, /Repack Size:\s*([^;\n\[]+)/i));
    const version = grab(bodyText, /Game version:\s*([^;\n]+)/i) || null;
    const installTime = grab(bodyText, /Installation takes?[:\s]*([^\n;]+)/i) || grab(bodyText, /Install(?:ation)?\s+Time[:\s]*([^\n;]+)/i);
    const ram = grab(bodyText, /At least\s+([\d.,]+\s*GB[^\n;]*)/i);
    const extraCredits = grab(bodyText, /Repack uses\s+([^\n;]+)/i);

    const imgs = [];
    $('img').each((_, el) => {
      const src = ($(el).attr('src') || '').trim();
      if (src && !src.startsWith('data:')) imgs.push(src);
    });
    const poster = imgs.find((s) => !s.includes('torrent-stats.info')) || imgs[0] || null;
    const screenshots = [...new Set(imgs.filter((s) => s !== poster && !s.includes('torrent-stats.info')))].slice(0, 8);

    const ri = bodyText.toLowerCase().indexOf('repack features');
    const be = bodyText.toLowerCase().indexOf('backwards compatibility', ri);
    const featText = ri >= 0 ? bodyText.slice(ri + 'repack features'.length, be > ri ? be : undefined) : '';
    const features = featText
      .split('\n')
      .map((l) => l.replace(/^[-*•>\s]+/, '').trim())
      .filter((l) => l.length > 6 && l.length < 300)
      .slice(0, 40);

    let description = null;
    const dMatch = bodyText.match(/description\s*[:\-–]?\s*([\s\S]{0,1600})/i);
    if (dMatch) description = dMatch[1].split(/\n\s*\n/)[0].trim() || null;
    if (!description) {
      description = ($('p').map((_, el) => cleanText($(el).text())).get().find((t) => t.length > 80)) || null;
    }
    description = description ? description.slice(0, 2000) : null;

    const links = [];
    $('a[href]').each((_, el) => {
      const a = $(el);
      const href = (a.attr('href') || '').trim();
      if (!href) return;
      const text = cleanText(a.text());
      if (/magnet:\?/i.test(href)) {
        links.push({ type: 'torrent', provider: classifyTorrent(text, href), url: href });
        return;
      }
      const m = text.match(/^Filehoster:\s*([A-Za-z0-9 .\-]+?)\s*\(/);
      if (m && /paste\.|fitgirl-repacks|data\w+nodes/i.test(href)) {
        links.push({ type: 'filehoster', provider: m[1].trim(), url: href });
        return;
      }
      const t = text.toLowerCase();
      if (/1337x\.to|rutor\.info|tapochek\.net|openbittorrent/i.test(href) && t !== 'click here' && t !== '') {
        links.push({ type: 'torrent', provider: classifyTorrent(text, href), url: href });
      }
      if (t === '.torrent file only') {
        links.push({ type: 'torrent', provider: 'file', url: href });
      }
    });
    if (links.length === 0 && poster) {
      // Fallback: offer the post page as a source link.
    }

    return {
      id,
      source: 'fitgirl',
      slug,
      site_url: url,
      title: title || slug,
      name: title || slug,
      version: version || null,
      date,
      genres,
      companies,
      languages,
      repack_size: repackSize ? repackSize.label : null,
      repack_size_bytes: repackSize ? repackSize.bytes : null,
      original_size: originalSize ? originalSize.label : null,
      requirements: {},
      features,
      install_time: installTime || null,
      description,
      screenshots,
      poster,
      credits: [...(extraCredits ? ['FitGirl', extraCredits] : ['FitGirl'])].filter(Boolean),
      links: [...new Map(links.map((l) => [l.url, l])).values()].slice(0, 20),
      is_trending: false,
    };
  })();
}

function classifyTorrent(text, href) {
  const t = String(text || '').toLowerCase();
  const h = String(href || '').toLowerCase();
  if (/1337x/.test(t) || /1337x\.to/.test(h)) return '1337x';
  if (/rutor/.test(t) || /rutor\.info/.test(h)) return 'RuTor';
  if (/tapochek/.test(t) || /tapochek\.net/.test(h)) return 'Tapochek';
  if (/openbittorrent/.test(t) || /openbittorrent\.com/.test(h)) return 'OpenBitTorrent';
  if (/magnet/.test(t)) return 'magnet';
  return 'torrent';
}

export async function crawlFitGirl(cfg, http, opts = {}) {
  const base = cfg.sources.fitgirl.base;
  const seen = new Set();
  const games = [];
  const pages = cfg.sources.fitgirl.maxPages || 0;

  async function processLinks(urls) {
    for (const link of urls) {
      if (seen.has(link)) continue;
      seen.add(link);
      if (opts.limit && games.length >= opts.limit) return;
      try {
        const game = await extractFitGirl(http, link);
        if (game) games.push(game);
      } catch (e) {
        console.error(`[fitgirl] extract failed ${link}: ${e.message}`);
      }
      if (opts.limit && games.length >= opts.limit) return;
    }
  }

  await processLinks(findPostLinks(load(await http.text(base)), base));
  if (opts.limit && games.length >= opts.limit) return games;

  for (let n = 2; ; n++) {
    if (pages && n > pages) break;
    const html = await http.text(`${base}/page/${n}`);
    const before = seen.size;
    await processLinks(findPostLinks(load(html), base));
    if (seen.size === before && !(opts.limit && games.length >= opts.limit)) break;
    if (opts.limit && games.length >= opts.limit) break;
  }
  return games;
}
