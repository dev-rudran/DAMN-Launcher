import { load } from 'cheerio';
import { cleanText, parseDate, parseRequirements, grab, parseSize, parseKVBlock } from './extract.js';

const SKIP_DODI = new Set([
  'page', 'author', 'tag', 'category', 'feed', 'comments', 'sitemap.xml', 'robots.txt',
  'contacts', 'farewell', 'troubleshooting', 'request', 'leaderboard', 'donations', 'donation',
  'donate', 'blog', 'top-games', 'trending', 'hypervisor-repack', 'exclusive-repacks',
  'free-offline-activations', 'all-my-repacks', 'search', '404', 'archive', 'archives', 'rss',
]);

const SECTION_HEADERS = [
  'information', 'minimum system requirements', 'recommended system requirements', 'requirements',
  'repack features', 'features', 'description', 'how to install', 'installation', 'links',
  'screenshots', 'languages', 'notes', 'changelog', 'download', 'download links',
];
function sectionText(text, marker) {
  const low = text.toLowerCase();
  const m = low.indexOf(marker);
  if (m < 0) return null;
  const start = m + marker.length;
  const rest = low.slice(start);
  let end = rest.length;
  for (const h of SECTION_HEADERS) {
    if (h === marker) continue;
    const idx = rest.indexOf('\n' + h);
    if (idx >= 0 && idx + 1 < end) end = idx + 1;
  }
  return text.slice(start, start + end).trim();
}

export async function crawlDodi(cfg, http, opts = {}) {
  const base = cfg.sources.dodi.base;
  const baseHost = new URL(base).hostname.replace(/^www\./, '');
  const seen = new Set();
  const games = [];
  const postUrls = new Set();

  async function addFromListing(url) {
    const html = await http.text(url);
    const $ = load(html);
    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') || '').trim();
      if (!href) return;
      let u;
      try { u = new URL(href, base); } catch { return; }
      if (u.hostname.replace(/^www\./, '') !== baseHost) return;
      if (!u.pathname.match(/^\/[a-z0-9][a-z0-9\-]*\/?$/)) return;
      const slug = (u.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
      if (SKIP_DODI.has(slug)) return;
      postUrls.add(u.href);
    });
  }

  async function crawlPage(url) {
    const html = await http.text(url);
    const $ = load(html);
    // Convert <br> and block boundaries to newlines so sections keep their structure.
    const $entry = $('.entry-content').length ? $('.entry-content') : $('article').length ? $('article') : $('main');
    const entryHtml = $entry.length ? $entry.html() : $('body').html();
    const withBreaks = String(entryHtml)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|tr|h\d|section)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    const bodyText = cleanText(
      withBreaks
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/[ \t]+/g, ' ')
    );
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    const id = `dodi:${slug}`;
    if (seen.has(id)) return;
    seen.add(id);

    const info = sectionText(bodyText, 'information');
    const featuresText = sectionText(bodyText, 'repack features');
    // Menu/non-game pages have neither Information nor Repack Features sections.
    if (!info && !featuresText) return;

    const h1 = cleanText($('h1').first().text() || '');
    const title = h1.replace(/^#+\s*/, '').replace(/^\d+[-–:]\s*/, '').trim() || slug;

    let date = null;
    const dt = $('time[datetime]').first().attr('datetime');
    if (dt) date = parseDate(dt);
    if (!date) date = parseDate(grab(bodyText, /Posted on[^\[]*\[([^\]]+)\]/i) || grab(bodyText, /(\d{2}\/\d{2}\/\d{4}|\w+ \d{1,2}, \d{4})/));

    const infoBlock = parseKVBlock(info || '', ['Title', 'Genre', 'Developer', 'Publisher', 'Release Date']);
    const genres = infoBlock.genre
      ? infoBlock.genre.split(/[,/;]/).map(cleanText).filter(Boolean)
      : null;
    const finalTitle = title;
    const releaseDate = parseDate(infoBlock['release date']);
    const devs = [];
    for (const key of ['developer', 'publisher']) {
      const v = infoBlock[key];
      if (!v) continue;
      devs.push(...v.split('\n')[0].split(',').map(cleanText).filter(Boolean).slice(0, 4));
    }

    const reqText = sectionText(bodyText, 'minimum system requirements');
    const requirements = parseRequirements(reqText || '');

    const versionRaw =
      grab(bodyText, /game version[:\s]*([^\n;|]+)/i) ||
      grab(featuresText || '', /Game version\s*[:\-–]?\s*([^\n;|]+)/i) ||
      null;
    const version = versionRaw ? versionRaw.replace(/^v+\s*/i, 'v').replace(/\s*v\s*$/, '').trim() : null;
    const repackSize = parseSize(
      grab(bodyText, /repack size\s*[:\-–]?\s*([^;\n]+)/i) ||
        grab(featuresText || '', /Repack Size\s*[:\-–]?\s*([^\n]+)/i),
    );
    const finalSize = parseSize(grab(featuresText || '', /final size\s*[:\-–]?\s*([^\n]+)/i));
    const installTime = grab(featuresText || '', /install(?:ation)? time\s*[:\-–]?\s*([^\n;]+)/i);
    const languages = (grab(featuresText || '', /language[s]?\s*[:\-–]?\s*([^\n;]+)/i) || '')
      .split(',').map(cleanText).filter(Boolean);

    const greetings = grab(featuresText || '', /greetings\s*[:\-–]?\s*([^\n;]+)/i) || grab(bodyText, /greetings\s*[:\-–]?\s*([^\n;]+)/i);
    const credits = [];
    if (greetings) credits.push(...greetings.split(',').map(cleanText).filter(Boolean));
    const repackBy = grab(featuresText || '', /repack by\s*[:\-–]?\s*([^\n;]+)/i);
    if (repackBy) credits.push(...repackBy.split(',').map(cleanText).filter(Boolean));

    const descText = sectionText(bodyText, 'description');
    const description = descText ? descText.split('\n').slice(0, 6).join(' ').slice(0, 1800) : null;

    const imgs = [];
    const seenImgs = new Set();
    $entry.find('img').each((_, el) => {
      const src = ($(el).attr('src') || '').trim();
      if (!src || src.startsWith('data:')) return;
      if (seenImgs.has(src)) return;
      seenImgs.add(src);
      imgs.push(src);
    });
    // Skip tiny banners/icons (e.g. site promos) by preferring large images.
    const bannerish = (s) => /(-\d{2,3}x\d{2,3}\.)|(\/uploads\/\d{4}\/\d{2}\/(test2|Free|HV|PC-Recompiled))/i.test(s);
    const usable = imgs.filter((s) => !bannerish(s));
    const pool = usable.length ? usable : imgs;
    // Game box art on DODI is hosted externally (imageban/fastpic); it is never a chrome banner.
    const poster = pool.find((s) => /imageban\.ru|fastpic\.ru|fastpic\.org/.test(s)) || pool[0] || null;
    const screenshots = (poster ? pool.filter((s) => s !== poster) : pool).slice(0, 8);

    const links = [];
    const seenLinks = new Set();
    const KNOWN = ['Torrent', 'SwiftUploads', 'FileKeeper', 'DataNodes', 'Mega', 'One Drive', 'OneShare', 'Uploaded', 'WeUpload', 'NitroFlare', 'DropArk', 'DropBox', 'CrackFix', 'Mediafire', '1Fichier', 'VikingFile'];
    // Provider label sits in the enclosing strong/paragraph, e.g. "Torrent – Click Here – or – Click Here".
    const blocks = $('a[href]').toArray().map((el) => {
      const a = $(el);
      const href = (a.attr('href') || '').trim();
      if (!href || !/zovo\.to/.test(href)) return null;
      const holder = a.closest('p, li, div, strong, b');
      const text = holder.length ? cleanText(holder.text()) : cleanText(a.text());
      const found = KNOWN.find((k) => new RegExp('(^|\\b)' + k.replace(/ /g, '\\s*') + '\\b', 'i').test(text));
      if (!found) return null;
      if (!seenLinks.has(found + '|' + href)) {
        seenLinks.add(found + '|' + href);
        const provider = found.replace(/\s+/g, ' ').trim();
        links.push({ type: /torrent/i.test(provider) ? 'torrent' : 'filehoster', provider, url: href });
      }
      return true;
    });
    // Keep source order, dedupe by URL; number repeated providers (Torrent 1, Torrent 2, ...)
    const byUrl = new Map();
    for (const l of links) if (!byUrl.has(l.url)) byUrl.set(l.url, l);
    const counts = new Map();
    const finalLinks = [...byUrl.values()].map((l) => {
      const n = (counts.get(l.provider) || 0) + 1;
      counts.set(l.provider, n);
      const total = [...byUrl.values()].filter((x) => x.provider === l.provider).length;
      return total > 1 ? { ...l, provider: `${l.provider} ${n}` } : l;
    });

    games.push({
      id,
      source: 'dodi',
      slug,
      site_url: url,
      title: finalTitle,
      name: finalTitle,
      version,
      date: date || releaseDate,
      genres,
      companies: devs,
      languages,
      repack_size: repackSize ? repackSize.label : null,
      repack_size_bytes: repackSize ? repackSize.bytes : null,
      final_size: finalSize ? finalSize.label : null,
      requirements,
      features: featuresText ? featuresText.split('\n').filter(Boolean).slice(0, 40) : [],
      install_time: installTime,
      description,
      screenshots: screenshots.slice(0, 8),
      poster,
      credits,
      links: finalLinks,
      is_trending: false,
    });
  }

  await addFromListing(base);
  const paginationCap = cfg.sources.dodi.maxPages || 500;
  for (let n = 2; n <= paginationCap; n++) {
    if (opts.limit && postUrls.size > opts.limit * 4) break;
    const before = postUrls.size;
    try {
      await addFromListing(`${base}/page/${n}`);
    } catch {
      break;
    }
    if (postUrls.size === before) break;
  }

  for (const url of postUrls) {
    if (opts.limit && games.length >= opts.limit) break;
    try {
      await crawlPage(url);
    } catch (e) {
      console.error(`[dodi] crawl failed ${url}: ${e.message}`);
    }
  }
  return games;
}
