#!/usr/bin/env python3
"""Health check for the NetEase music player integration.

Usage:
    python3 .github/scripts/check_music_player.py [public_dir] [api_base] [playlist_id]

Defaults:
    public_dir = public
    api_base   = https://api.toolkal.com
    playlist_id = 8243918033
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

PUBLIC_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public")
API_BASE = sys.argv[2] if len(sys.argv) > 2 else "https://api.toolkal.com"
PLAYLIST_ID = sys.argv[3] if len(sys.argv) > 3 else "8243918033"
PORT = 1313
REQUEST_TIMEOUT = 30
SITE_ORIGIN = "https://konpaku-ming.github.io"


def fetch_response(url, timeout=REQUEST_TIMEOUT, extra_headers=None):
    headers = {
        "User-Agent": "Mozilla/5.0 (MusicPlayerHealthCheck/1.0)",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    req = urllib.request.Request(url, headers=headers)
    return urllib.request.urlopen(req, timeout=timeout)


def fetch_json(url, timeout=REQUEST_TIMEOUT, extra_headers=None):
    with fetch_response(url, timeout=timeout, extra_headers=extra_headers) as resp:
        content_type = resp.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            raise ValueError(f"Expected JSON response, got {content_type}")
        return json.loads(resp.read().decode("utf-8"))


def check_cors(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (MusicPlayerHealthCheck/1.0)",
            "Accept": "application/json",
            "Origin": SITE_ORIGIN,
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        allow_origin = resp.headers.get("Access-Control-Allow-Origin")
        if allow_origin not in ("*", SITE_ORIGIN):
            fail(
                "API response is not readable by the browser; "
                f"Access-Control-Allow-Origin={allow_origin!r}"
            )


def fail(message):
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def ok(message):
    print(f"OK: {message}")


def section(title):
    print(f"\n=== {title} ===")


def main():
    section("Checking generated music-fallbacks JS")
    index_html = PUBLIC_DIR / "index.html"
    if not index_html.exists():
        fail(f"{index_html} not found; run 'hugo --minify' first")

    content = index_html.read_text(encoding="utf-8")
    match = re.search(r"music-fallbacks\.min\.[a-f0-9]+\.js", content)
    if not match:
        fail("music-fallbacks JS not referenced in index.html")
    js_file = match.group(0)
    print(f"Found JS: {js_file}")

    js_path = PUBLIC_DIR / "js" / js_file
    if not js_path.exists():
        fail(f"{js_path} not found")

    js_content = js_path.read_text(encoding="utf-8")
    if API_BASE not in js_content:
        fail(f"API base {API_BASE} not found in {js_file}")
    ok("API base found in generated JS")

    if "AbortController" not in js_content:
        fail("AbortController not found; fetch requests are not bound to page lifecycle")
    ok("AbortController present in generated JS")

    if "fallbackPlaylist" in js_content:
        print("WARNING: fallbackPlaylist still present in generated JS")
    else:
        ok("fallbackPlaylist removed from generated JS")

    section("Checking local fallback files")
    fallback_ids = [
        "28234319",
        "28234322",
        "28466084",
        "28466105",
        "29922939",
        "691506",
        "850775",
        "869119",
    ]
    for fid in fallback_ids:
        for ext in ("mp3", "lrc", "jpg"):
            path = PUBLIC_DIR / "music" / f"{fid}.{ext}"
            if not path.exists():
                fail(f"Missing {path}")
    ok("All local fallback files present")

    section("Testing Netease API")
    playlist_url = f"{API_BASE}/playlist/track/all?id={PLAYLIST_ID}&limit=5"
    print(f"GET {playlist_url}")
    try:
        data = fetch_json(playlist_url)
    except Exception as exc:  # pylint: disable=broad-except
        fail(f"Playlist API request failed: {exc}")

    if data.get("code") != 200:
        fail(f"Playlist API returned code {data.get('code')}")
    songs = data.get("songs", [])
    if not songs:
        fail("Playlist API returned empty songs")
    ok("Playlist API works")

    song_ids = [str(song.get("id")) for song in songs[:5] if song.get("id")]
    if not song_ids:
        fail("Could not extract song IDs")
    print(f"Song IDs: {', '.join(song_ids)}")

    song_url = f"{API_BASE}/song/url?id={','.join(song_ids)}"
    print(f"GET {song_url}")
    try:
        song_data = fetch_json(song_url)
    except Exception as exc:  # pylint: disable=broad-except
        fail(f"Song URL API request failed: {exc}")

    if song_data.get("code") != 200:
        fail(f"Song URL API returned code {song_data.get('code')}")
    url_list = song_data.get("data", [])
    playable = [item for item in url_list if item.get("url")]
    if not playable:
        fail("Song URL API returned no playable urls for sampled playlist tracks")
    ok("Song URL API works")

    section("Checking browser CORS")
    try:
        check_cors(song_url)
    except Exception as exc:  # pylint: disable=broad-except
        fail(f"CORS check failed: {exc}")
    ok("API CORS allows the blog origin")

    section("Starting static server")
    server = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "http.server",
            str(PORT),
            "--directory",
            str(PUBLIC_DIR),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2)

    try:
        section("Checking homepage")
        try:
            with urllib.request.urlopen(
                f"http://localhost:{PORT}/", timeout=10
            ) as resp:
                if resp.status != 200:
                    fail(f"Homepage returned HTTP {resp.status}")
                html = resp.read().decode("utf-8")
        except Exception as exc:  # pylint: disable=broad-except
            fail(f"Homepage request failed: {exc}")

        if "global-aplayer" not in html:
            fail("global-aplayer markup not found in homepage")
        ok("Homepage returns HTTP 200 and contains player markup")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)

    print("\n=== All checks passed ===")


if __name__ == "__main__":
    main()
