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

Produce three artifacts: SLOC numbers, an annotated tree, and two hot-path diagrams. Always run the bundled scripts. Never count lines or serve files by hand.

Bundled assets in `{{skills_dir}}/code-orientation/`:
- `sloc.py`: SLOC counter for a path or a git diff.
- `viewer/serve.py`: localhost-only static server.
- `viewer/viewer.html`, `viewer/viewer.js`, `viewer/vendor/mermaid.min.js`: the browser renderer.
- `example/`: a working diagrams.json, block.mmd, and sequence.mmd.

---

## 1. Establish the target and mode

Pick one mode:

- Whole-target mode: a repo, subfolder, or dependency, as it stands.
- PR/diff mode: a branch or PR. Get the git range, for example `origin/main...HEAD`.

State the resolved target and mode to me in one line. If the target or base branch is ambiguous, ask. Otherwise continue.

Create a scratch output directory, for example `mkdir -p /tmp/code-orientation/TARGET_SLUG`.

## 2. Measure SLOC with sloc.py

sloc.py excludes tests, docs, lockfiles, and vendored and generated code by default.

Whole-target mode:
```bash
python3 {{skills_dir}}/code-orientation/sloc.py PATH --depth 2 --top 15
```

PR/diff mode (ranks changed files by net lines and shows biggest diffs):
```bash
python3 {{skills_dir}}/code-orientation/sloc.py --diff origin/main...HEAD --top 20
```

Add `--json` to post-process. Note the biggest modules, the largest files (candidate god-files), and in PR mode the biggest net diffs. Read those first.

## 3. Research the architecture

Read top-down first: READMEs, entry points, module layout. Then read bottom-up: the largest files from step 2 and the data stores.

If the target is larger than a few files, delegate the reading. Spawn one subagent per major module, or one for the changed area in PR mode, in a single message. Ask each for component names, responsibilities, external integrations, data stores, and data-flow arrows (`X -> Y`). Synthesize their reports. Never paste file contents into your own context.

Find the hot path: the components one typical unit of work (a request, event, or record) flows through. Exclude one-off scripts, backfills, and eval harnesses. If a large file is not on the hot path, say so.

## 4. Produce an annotated file tree

Write a compact ASCII tree of folders, modules, and key files, with SLOC per folder and key file. Mark:
- ⭐ hot-path or core business-logic files
- 🔴 the largest, thorniest god-files
- a one-line role note for each module and key file

State the counting basis: non-blank lines minus whole-line comments. In PR mode, tree only the changed areas and annotate net diff size.

## 5. Author two mermaid diagrams

Copy `{{skills_dir}}/code-orientation/example/` into the output directory as a starting point. Write two files:

a. `block.mmd`: the hot path as a block diagram. Group nodes in dashed subgraphs by real directory (for example `services/`, `api/`). Put external providers in their own dashed box and use dotted edges to them. Style subgraphs with stroke only. Never set a `fill`, because it stays light under the dark theme:
```
classDef dash stroke-dasharray:5 4,stroke-width:1.5px;
class GROUP_A,GROUP_B,GROUP_C dash
```

b. `sequence.mmd`: one unit of work traversing the hot path. Group participants with `box transparent MODULE_LABEL ... end`. Mermaid sequence boxes cannot be dashed.

In PR mode, center both diagrams on the components the diff touches and mark the changed nodes.

Write `diagrams.json` in the output directory:
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

Never hard-code colours in diagrams. The viewer themes them.

## 6. Serve the diagrams in the local viewer

Run the server in the background, pointed at the output directory:
```bash
python3 {{skills_dir}}/code-orientation/viewer/serve.py --dir /tmp/code-orientation/TARGET_SLUG --port 8765
```
It binds 127.0.0.1 and rejects non-local Host headers. Never offer a LAN or tailnet URL for it.

The viewer follows the OS light or dark setting. For a capture, pin a theme with `?theme=light`, `dark`, `paper`, or `carbon`. `THEME.md` documents them.

Verify it responds before you hand off:
```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/diagrams.json
```

If I ask you to confirm the diagrams render, load the page headlessly with the webapp-testing skill. Check for a rendered `svg` in each section and no error nodes.

## 7. Report findings inline

Report in chat: total SLOC and the biggest modules, 2–4 god-files or biggest diffs, the hot path, and the viewer URL. If a big file is off the hot path, or the "hot path" is really several independent flows, say so. Never stop at "served, take a look".
