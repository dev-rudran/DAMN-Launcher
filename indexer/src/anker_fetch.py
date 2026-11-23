#!/usr/bin/env python3
"""Fetch a URL and print the body to stdout.

Used for ankergames.net: it sits behind Cloudflare's anti-bot page, which the
plain Node/undici fetch is rejected for. curl_cffi with browser fingerprint
impersonation passes. Requires: pip install curl_cffi (and python3 on PATH).

Usage: python3 anker_fetch.py <url> [timeout_seconds]
"""

import sys

from curl_cffi import requests


def main():
    if len(sys.argv) < 2:
        print("usage: anker_fetch.py <url> [timeout]", file=sys.stderr)
        sys.exit(2)
    url = sys.argv[1]
    timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0
    r = requests.get(url, impersonate="chrome", timeout=timeout)
    sys.stdout.write(r.text)
    if r.status_code >= 400:
        print(f"HTTP {r.status_code} for {url}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
