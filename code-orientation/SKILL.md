---
name: code-orientation
description: Use when you need to quickly understand an unfamiliar codebase, folder, library, or a big PR/diff — before reviewing or changing it. Produces a SLOC breakdown, an annotated file tree (folders, modules, god-files, hot path), and hot-path mermaid diagrams (block plus sequence) served in a clean local browser viewer. Point it at a repo, a subfolder, a dependency, or a PR range.
---

<required>
CRITICAL: Add the following steps to your task list:

1. Establish the target and mode
2. Measure SLOC with the bundled sloc.py
3. Research the architecture (delegate to subagents for large targets)
4. Produce an annotated file tree
5. Identify the hot path and author two mermaid diagrams
6. Serve the diagrams in the local viewer with the bundled serve.py
7. Report findings inline — do not just serve and wait
</required>

This skill turns "I don't know this code yet" into three artifacts, fast: numbers, a map, and a picture of the hot path. Always write and run the bundled scripts rather than counting or serving by hand.

Bundled assets live in `{{skills_dir}}/code-orientation/`:
- `sloc.py` — stdlib SLOC counter (path mode and git-diff/PR mode)
- `viewer/serve.py` — hardened localhost-only static server (extension allowlist, Host check, CSP, no CDN)
- `viewer/viewer.html`, `viewer/viewer.js`, `viewer/vendor/mermaid.min.js` — the browser renderer
- `example/` — a working diagrams.json, block.mmd, and sequence.mmd to copy from

---

## 1. Establish the target and mode

Pin down exactly what you are orienting on and pick a mode:

- Whole-target mode — a repo, a subfolder, or a library/dependency. The unit of interest is the code as it stands.
- PR/diff mode — a branch or PR. The unit of interest is what changed. Get the git range (for example `origin/main...HEAD`, or the merge-base of the PR base and head).

State the resolved target path(s) and mode back to the user in one line before proceeding. If genuinely ambiguous (which of several folders? which base branch?), ask — otherwise proceed.

Create a scratch output dir for this run, for example `mkdir -p /tmp/code-orientation/TARGET_SLUG`.

## 2. Measure SLOC with sloc.py

Tests, docs, lockfiles, vendored and generated code are excluded by default. This is the fast, quantitative first pass — it tells you where the mass is before you read anything.

Whole-target mode:
```bash
python3 {{skills_dir}}/code-orientation/sloc.py PATH --depth 2 --top 15
```

PR/diff mode (ranks changed files by net lines and shows biggest diffs):
```bash
python3 {{skills_dir}}/code-orientation/sloc.py --diff origin/main...HEAD --top 20
```

Add `--json` if you want to post-process. Use the output to note: the biggest folders/modules, the largest individual files (candidate god-files), and — in PR mode — the biggest net diffs. These are your reading priorities.

## 3. Research the architecture (delegate for large targets)

Read top-down (READMEs, entry points, package/module layout, handover docs) then bottom-up (the largest files from step 2, the entry points, the data stores).

For anything non-trivial, delegate the reading to subagents so raw file contents stay out of your context. Spawn one subagent per major module/repo (or, in PR mode, one for the changed area) and ask each for: component names, responsibilities, external integrations, data stores, and data-flow arrows (`X -> Y`). Launch independent subagents in a single message so they run concurrently. Synthesize their reports; do not dump file contents yourself.

The goal of this step is to know the hot path: the sequence of components a typical unit of work (a request, an item, an event, a record) actually flows through — as opposed to one-off scripts, backfills, eval harnesses, and other off-path bulk. Note when a large file (by SLOC) is not on the hot path — size is not centrality; say so explicitly.

## 4. Produce an annotated file tree

Write a compact ASCII tree annotated with SLOC at the folder/module level and the key files. Mark:
- ⭐ hot-path / core business-logic files
- 🔴 oversized god-files (flag the single largest, thorniest ones)
- one-line role notes for the modules and key files

Keep it to folders, modules, and genuinely key files — not every file. State the SLOC counting basis (this skill: non-blank minus whole-line comments) so numbers are comparable. In PR mode, tree only the changed areas and annotate with net diff size.

## 5. Identify the hot path and author two mermaid diagrams

Write two `.mmd` files into the run's output dir:

a. `block.mmd` — a block diagram of the hot path, with big dashed subgraph boxes grouping nodes by folder/module. Group by real directories (for example `services/`, `pipeline/`, `api/`); put external providers in their own dashed box; use dotted edges to external services. Apply dashed styling to subgraphs with stroke only — do NOT set a `fill`, or the boxes will stay light in dark mode:
```
classDef dash stroke-dasharray:5 4,stroke-width:1.5px;
class GROUP_A,GROUP_B,GROUP_C dash
```

b. `sequence.mmd` — a sequence diagram of one unit of work traversing the hot path. Group participants into module boxes with `box transparent MODULE_LABEL ... end`. NOTE: mermaid sequence boxes are always solid — they cannot be dashed; use them for grouping and keep the dashed styling for the block diagram only.

In PR mode, draw the hot path under change: the same two diagrams but centered on the components the diff touches, marking changed nodes.

Copy `{{skills_dir}}/code-orientation/example/` as a starting point — it contains a valid diagrams.json, block.mmd (with the dashed grouping), and sequence.mmd. Then write a diagrams.json in the output dir describing your diagrams:
```json
{
  "title": "TARGET — hot path",
  "subtitle": "mode / range",
  "diagrams": [
    {"title": "1 · Block — grouped by module", "file": "block.mmd", "note": "..."},
    {"title": "2 · Sequence — one unit of work", "file": "sequence.mmd", "note": "..."}
  ]
}
```

## 6. Serve the diagrams in the local viewer

Start the bundled offline server, pointed at the output dir (it also serves the bundled viewer plus vendored mermaid). Run it in the background so it stays up:
```bash
python3 {{skills_dir}}/code-orientation/viewer/serve.py --dir /tmp/code-orientation/TARGET_SLUG --port 8765
```
It prints `http://127.0.0.1:8765`. It is localhost-only by design (binds 127.0.0.1, rejects non-local Host headers) — do not expect a tailnet/LAN URL from it. Give the user the URL. Everything renders in-browser; nothing is uploaded.

Verify it responds before handing off:
```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/diagrams.json
```

If the user asks to confirm the diagrams actually render (not just serve), use the webapp-testing skill to load the page headlessly and check for a rendered `svg` in each section and no error nodes.

## 7. Report findings inline

Summarize in chat: the SLOC headline (total, biggest modules), 2–4 god-files / biggest diffs worth attention, what the hot path is, and the viewer URL. Push back explicitly if a big file is not on the hot path, or if the "hot path" is actually several independent flows. Do not stop at "served — take a look"; deliver the conclusion.
