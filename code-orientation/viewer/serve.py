#!/usr/bin/env python3
"""Offline local viewer for code-orientation mermaid diagrams. Stdlib only.

Serves a generated output directory (diagrams.json + *.mmd) plus this skill's
bundled static assets (viewer.html, viewer.js, vendor/mermaid.min.js). Binds
127.0.0.1 only, rejects non-localhost Host headers, restricts to an extension
allowlist, and blocks path traversal. No CDN, no telemetry.

Usage:
  serve.py --dir /path/to/output [--port 8765]

The output dir is searched first, then this script's own directory, so you only
write small files (diagrams.json, *.mmd) into --dir; the heavy viewer assets
come from the bundle.
"""
from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ASSET_DIR = Path(__file__).resolve().parent

CONTENT_TYPES: dict[str, str] = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".mmd": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
    "": "text/plain; charset=utf-8",
}
CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; "
    "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)


class Handler(BaseHTTPRequestHandler):
    # roots injected onto the server instance
    def do_GET(self) -> None:
        self.send_file()

    def do_HEAD(self) -> None:
        self.send_file(head=True)

    def resolve(self, rel: str) -> Path | None:
        rel = rel.lstrip("/") or "viewer.html"
        for root in self.server.roots:  # type: ignore[attr-defined]
            candidate = (root / rel).resolve()
            try:
                candidate.relative_to(root)
            except ValueError:
                continue  # traversal outside root
            if candidate.is_file() and candidate.suffix.lower() in CONTENT_TYPES:
                return candidate
        return None

    def send_file(self, head: bool = False) -> None:
        port = self.server.server_port
        if self.headers.get("Host") not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
            self.send_error(403)
            return
        target = self.resolve(urlsplit(self.path).path)
        if target is None:
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES[target.suffix.lower()])
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", CSP)
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def log_message(self, *args: object) -> None:  # quiet
        pass


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", required=True, help="output dir with diagrams.json and *.mmd")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args(argv)

    out = Path(args.dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.roots = [out, ASSET_DIR]  # type: ignore[attr-defined]
    print(f"Code-orientation viewer: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
