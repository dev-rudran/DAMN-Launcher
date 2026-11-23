import fs from 'node:fs/promises';
import path from 'node:path';
import { fetch, ProxyAgent } from 'undici';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export class FetchError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function makeFetcher({ proxy = '', timeoutMs = 20000, retries = 2, slowDownMs = 0 } = {}) {
  let dispatcher;
  if (proxy) {
    try {
      dispatcher = new ProxyAgent(proxy);
    } catch (e) {
      throw new Error(
        `Invalid proxy URL "${proxy}": ${e.message}. Use http://, https:// or socks5:// — if you run a local/VPN proxy, set DAMN_PROXY_URL.`,
      );
    }
  }

  async function get(url, opts = {}) {
    if (slowDownMs) await sleep(slowDownMs);
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          dispatcher,
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'user-agent': UA,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            ...(opts.headers || {}),
          },
          ...(opts.redirect !== undefined ? { redirect: opts.redirect } : {}),
        });
        if (res.status >= 400) throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
        return res;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) await sleep(1500 * (attempt + 1) + Math.random() * 800);
      }
    }
    throw lastErr;
  }

  return {
    get,
    async text(url, opts) {
      const res = await get(url, opts);
      return res.text();
    },
    async bytes(url, opts) {
      const res = await get(url, opts);
      return Buffer.from(await res.arrayBuffer());
    },
    async json(url, opts) {
      const res = await get(url, opts);
      return res.json();
    },
    async writeTo(url, dest, opts) {
      const buf = await this.bytes(url, opts);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, buf);
      return dest;
    },
  };
}
