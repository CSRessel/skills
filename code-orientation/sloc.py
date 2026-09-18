#!/usr/bin/env python3
"""Portable SLOC counter for code orientation. Stdlib only.

Two modes:
  * Path mode (default): count source lines under one or more paths, grouped by
    folder/module, with the biggest files ranked.
  * Diff mode (--diff RANGE): rank changed files by net/added lines for a git
    range (e.g. `origin/main...HEAD`), for PR review.

"SLOC" here = non-blank lines minus obvious whole-line comments. It is an
approximation (no full per-language parsing) but is stable and language-aware
enough to compare folders and spot large files. Tests, docs, lockfiles, vendored
and generated code are excluded by default.

Examples:
  sloc.py .
  sloc.py src/ --depth 2 --top 15
  sloc.py --diff origin/main...HEAD
  sloc.py . --json
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# extension -> (language, line-comment prefixes, has C-style block comments)
LANGS: dict[str, tuple[str, tuple[str, ...], bool]] = {
    ".py": ("Python", ("#",), False),
    ".pyi": ("Python", ("#",), False),
    ".rs": ("Rust", ("//",), True),
    ".go": ("Go", ("//",), True),
    ".ts": ("TypeScript", ("//",), True),
    ".tsx": ("TypeScript", ("//",), True),
    ".js": ("JavaScript", ("//",), True),
    ".jsx": ("JavaScript", ("//",), True),
    ".mjs": ("JavaScript", ("//",), True),
    ".cjs": ("JavaScript", ("//",), True),
    ".java": ("Java", ("//",), True),
    ".kt": ("Kotlin", ("//",), True),
    ".c": ("C", ("//",), True),
    ".h": ("C", ("//",), True),
    ".cc": ("C++", ("//",), True),
    ".cpp": ("C++", ("//",), True),
    ".hpp": ("C++", ("//",), True),
    ".cs": ("C#", ("//",), True),
    ".rb": ("Ruby", ("#",), False),
    ".php": ("PHP", ("//", "#"), True),
    ".swift": ("Swift", ("//",), True),
    ".scala": ("Scala", ("//",), True),
    ".sh": ("Shell", ("#",), False),
    ".bash": ("Shell", ("#",), False),
    ".zsh": ("Shell", ("#",), False),
    ".sql": ("SQL", ("--",), True),
    ".vue": ("Vue", ("//",), True),
    ".svelte": ("Svelte", ("//",), True),
}

# directory names pruned everywhere
SKIP_DIRS: frozenset[str] = frozenset({
    ".git", "node_modules", "dist", "build", "out", "target", ".venv", "venv",
    "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".next",
    ".turbo", "vendor", "third_party", "migrations", "versions",
    "__snapshots__", ".idea", ".vscode", "coverage", "site-packages",
})
TEST_DIR_NAMES: frozenset[str] = frozenset({"tests", "test", "__tests__", "e2e", "spec"})

# excluded filename patterns (checked on the basename, lowercased)
SKIP_FILES: frozenset[str] = frozenset({
    "uv.lock", "poetry.lock", "package-lock.json", "yarn.lock", "bun.lock",
    "bun.lockb", "cargo.lock", "go.sum", "composer.lock", "pnpm-lock.yaml",
    "gemfile.lock",
})


def is_test_file(name: str) -> bool:
    low = name.lower()
    return (
        low.startswith("test_")
        or low.endswith(("_test.py", "_test.go", "_test.rs"))
        or ".test." in low
        or ".spec." in low
        or low.endswith(("_spec.rb",))
    )


def is_generated(name: str) -> bool:
    low = name.lower()
    return low.endswith((".min.js", ".min.css", ".map", ".lock", ".pb.go", "_pb2.py"))


@dataclass
class FileStat:
    path: str
    lang: str
    sloc: int
    comments: int
    blanks: int
    total: int
    added: int = 0  # diff mode
    removed: int = 0  # diff mode


@dataclass
class Bucket:
    sloc: int = 0
    files: int = 0
    added: int = 0
    removed: int = 0
    langs: dict[str, int] = field(default_factory=dict)


def count_file(path: Path) -> FileStat | None:
    ext = path.suffix.lower()
    meta = LANGS.get(ext)
    if meta is None:
        return None
    lang, prefixes, cstyle = meta
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    sloc = comments = blanks = total = 0
    in_block = False
    for raw in text.splitlines():
        total += 1
        line = raw.strip()
        if not line:
            blanks += 1
            continue
        if in_block:
            comments += 1
            if "*/" in line:
                in_block = False
            continue
        if cstyle and line.startswith("/*"):
            comments += 1
            if "*/" not in line:
                in_block = True
            continue
        if any(line.startswith(p) for p in prefixes) or (cstyle and line.startswith("*")):
            comments += 1
            continue
        sloc += 1
    return FileStat(str(path), lang, sloc, comments, blanks, total)


def walk_files(root: Path, include_tests: bool) -> list[Path]:
    found: list[Path] = []
    if root.is_file():
        return [root]
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and (include_tests or d not in TEST_DIR_NAMES)
        ]
        for fn in filenames:
            low = fn.lower()
            if low in SKIP_FILES or is_generated(fn):
                continue
            if not include_tests and is_test_file(fn):
                continue
            if low.endswith((".md", ".rst", ".txt")):
                continue
            found.append(Path(dirpath) / fn)
    return found


def module_key(rel: str, base: str, depth: int) -> str:
    parts = Path(rel).parts
    if len(parts) <= 1:
        return base or "."
    key = os.path.join(*parts[:depth]) if depth < len(parts) else os.path.dirname(rel)
    return key or (base or ".")


def gather_paths(paths: list[str], include_tests: bool) -> list[FileStat]:
    stats: list[FileStat] = []
    for p in paths:
        root = Path(p).resolve()
        for f in walk_files(root, include_tests):
            st = count_file(f)
            if st is not None:
                stats.append(st)
    return stats


def gather_diff(range_spec: str, include_tests: bool) -> tuple[list[FileStat], Path]:
    repo = Path(
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    )
    out = subprocess.run(
        ["git", "diff", "--numstat", range_spec],
        capture_output=True, text=True, check=True,
    ).stdout
    stats: list[FileStat] = []
    for line in out.splitlines():
        cols = line.split("\t")
        if len(cols) != 3:
            continue
        added_s, removed_s, name = cols
        if added_s == "-" or removed_s == "-":  # binary
            continue
        if name.lower().endswith((".md", ".rst", ".txt")) or Path(name).name.lower() in SKIP_FILES:
            continue
        if is_generated(Path(name).name):
            continue
        parts = set(Path(name).parts)
        if parts & SKIP_DIRS:
            continue
        if not include_tests and (is_test_file(Path(name).name) or parts & TEST_DIR_NAMES):
            continue
        ext = Path(name).suffix.lower()
        lang = LANGS.get(ext, ("other", (), False))[0]
        if ext not in LANGS:
            continue
        fpath = repo / name
        cur = count_file(fpath) if fpath.exists() else None
        sloc = cur.sloc if cur else 0
        stats.append(FileStat(name, lang, sloc, 0, 0, 0, int(added_s), int(removed_s)))
    return stats, repo


def bucketize(stats: list[FileStat], base: Path, depth: int, diff: bool) -> dict[str, Bucket]:
    buckets: dict[str, Bucket] = {}
    for st in stats:
        try:
            rel = os.path.relpath(st.path, base) if not diff else st.path
        except ValueError:
            rel = st.path
        key = os.path.dirname(rel) if diff else module_key(rel, base.name, depth)
        key = key or "."
        b = buckets.setdefault(key, Bucket())
        b.sloc += st.sloc
        b.files += 1
        b.added += st.added
        b.removed += st.removed
        b.langs[st.lang] = b.langs.get(st.lang, 0) + st.sloc
    return buckets


def bar(n: int, peak: int, width: int = 24) -> str:
    if peak <= 0:
        return ""
    return "█" * max(1, round(width * n / peak)) if n else ""


def render_path_report(stats: list[FileStat], base: Path, depth: int, top: int) -> str:
    total_sloc = sum(s.sloc for s in stats)
    total_comments = sum(s.comments for s in stats)
    lines: list[str] = []
    lines.append(f"SLOC report for {base}")
    lines.append(f"  files: {len(stats)}   SLOC: {total_sloc:,}   comments: {total_comments:,}")
    langs: dict[str, int] = {}
    for s in stats:
        langs[s.lang] = langs.get(s.lang, 0) + s.sloc
    lines.append("  by language: " + ", ".join(
        f"{k} {v:,}" for k, v in sorted(langs.items(), key=lambda kv: -kv[1])
    ))
    lines.append("")
    buckets = bucketize(stats, base, depth, diff=False)
    peak = max((b.sloc for b in buckets.values()), default=0)
    lines.append(f"By folder/module (depth {depth}):")
    lines.append(f"  {'SLOC':>8}  {'files':>5}  module")
    for key, b in sorted(buckets.items(), key=lambda kv: -kv[1].sloc):
        lines.append(f"  {b.sloc:>8,}  {b.files:>5}  {key}  {bar(b.sloc, peak)}")
    lines.append("")
    lines.append(f"Largest files (top {top}):")
    lines.append(f"  {'SLOC':>8}  file")
    for s in sorted(stats, key=lambda x: -x.sloc)[:top]:
        rel = os.path.relpath(s.path, base)
        lines.append(f"  {s.sloc:>8,}  {rel}")
    return "\n".join(lines)


def render_diff_report(stats: list[FileStat], repo: Path, range_spec: str, top: int) -> str:
    total_add = sum(s.added for s in stats)
    total_rem = sum(s.removed for s in stats)
    lines: list[str] = []
    lines.append(f"Diff SLOC report for {range_spec}  (repo {repo})")
    lines.append(f"  changed source files: {len(stats)}   +{total_add:,} / -{total_rem:,}   net {total_add - total_rem:+,}")
    lines.append("")
    buckets = bucketize(stats, repo, 0, diff=True)
    lines.append("By folder:")
    lines.append(f"  {'net':>8}  {'+add':>7}  {'-rem':>7}  {'files':>5}  folder")
    for key, b in sorted(buckets.items(), key=lambda kv: -(kv[1].added - kv[1].removed)):
        net = b.added - b.removed
        lines.append(f"  {net:>+8}  {b.added:>7}  {b.removed:>7}  {b.files:>5}  {key or '.'}")
    lines.append("")
    lines.append(f"Biggest net changes (top {top}):")
    lines.append(f"  {'net':>8}  {'+add':>7}  {'-rem':>7}  {'now':>7}  file")
    for s in sorted(stats, key=lambda x: -(x.added - x.removed))[:top]:
        net = s.added - s.removed
        lines.append(f"  {net:>+8}  {s.added:>7}  {s.removed:>7}  {s.sloc:>7,}  {s.path}")
    return "\n".join(lines)


def to_json(stats: list[FileStat], base: str, depth: int, diff: bool) -> str:
    b = bucketize(stats, Path(base), depth, diff)
    payload = {
        "mode": "diff" if diff else "path",
        "base": base,
        "total_sloc": sum(s.sloc for s in stats),
        "total_added": sum(s.added for s in stats),
        "total_removed": sum(s.removed for s in stats),
        "folders": {
            k: {"sloc": v.sloc, "files": v.files, "added": v.added,
                "removed": v.removed, "langs": v.langs}
            for k, v in sorted(b.items(), key=lambda kv: -kv[1].sloc)
        },
        "files": [
            {"path": s.path, "lang": s.lang, "sloc": s.sloc,
             "added": s.added, "removed": s.removed}
            for s in sorted(stats, key=lambda x: -(x.added - x.removed if diff else x.sloc))
        ],
    }
    return json.dumps(payload, indent=2)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*", default=["."], help="paths to scan (path mode)")
    ap.add_argument("--diff", metavar="RANGE", help="git range for PR mode, e.g. origin/main...HEAD")
    ap.add_argument("--depth", type=int, default=2, help="folder grouping depth (path mode)")
    ap.add_argument("--top", type=int, default=12, help="how many largest files to list")
    ap.add_argument("--include-tests", action="store_true", help="do not exclude tests")
    ap.add_argument("--json", action="store_true", help="emit JSON")
    args = ap.parse_args(argv)

    if args.diff:
        stats, repo = gather_diff(args.diff, args.include_tests)
        if args.json:
            print(to_json(stats, str(repo), 0, diff=True))
        else:
            print(render_diff_report(stats, repo, args.diff, args.top))
        return 0

    paths = args.paths or ["."]
    base = Path(paths[0]).resolve()
    stats = gather_paths(paths, args.include_tests)
    if args.json:
        print(to_json(stats, str(base), args.depth, diff=False))
    else:
        print(render_path_report(stats, base, args.depth, args.top))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
