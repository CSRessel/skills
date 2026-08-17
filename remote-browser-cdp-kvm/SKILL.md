---
name: remote-browser-cdp-kvm
description: Use when a task needs a real logged-in browser driven programmatically AND may hit human-only walls (login, CAPTCHA, SSO, 2FA, visual sign-off), especially when the human is remote. Provides a shared long-lived Chrome over CDP, small repeatable per-task "verbs" that each do one action + capture a screenshot (so single tasks can be handed to cheap subagents), and a phone/tailnet KVM escape hatch for the human-in-the-loop steps.
---

<required>
*CRITICAL* Add the following steps to your task list:

1. Ensure the shared browser is up (`bcdp launch`); bootstrap deps on first run.
2. Decompose the browser goal into a sequence of single-task verbs, each with an explicit screenshot output path.
3. Delegate each browser task to a worker subagent (a cheap/fast model) via whatever mechanism your harness provides. Do NOT reason through the DOM in the orchestrator.
4. For any human-only step (login / CAPTCHA / SSO / 2FA / visual approval), start the KVM, hand the human the tailnet URL, wait, then verify the resulting state.
5. Read the returned screenshots, keep only the conclusions. Never let raw DOM / page text / worker transcripts accumulate in the orchestrator's context.
6. Tear down the KVM when done; leave the browser running for reuse.
</required>

# Overview

You control **one** durable, headed-or-headless Chrome that persists its login
across sessions (dedicated user-data-dir). You drive it over the Chrome DevTools
Protocol (CDP). All browser work is expressed as small **verbs**, and each verb
connects to the shared browser, does exactly one thing, prints a compact JSON
result, and optionally writes a screenshot.

Why this shape:

- **The browser holds all state**, so every verb is stateless and repeatable. A
  verb call is a complete, self-contained task.
- That means a **single task can be handed to a cheap, fast subagent** which
  runs one or two verbs, looks at a screenshot, and returns a few lines. The
  smart orchestrator model keeps the plan and its context clean, and never eats
  DOM dumps or Playwright noise.
- When a step can only be done by a human (and the human is on their phone,
  travelling, behind a tailnet), the **KVM** streams just that browser tab to
  them and forwards their taps/keys, with no VNC, exposed desktop, or sudo.

The bundled scripts live under this skill's `scripts/` directory. If
`{{skills_dir}}` is unsubstituted, resolve it to the directory containing this
SKILL.md. Call the CLI as:

```
node {{skills_dir}}/remote-browser-cdp-kvm/scripts/bcdp.mjs <verb> [args]
```

# Setup (first run on a machine)

The scripts need Playwright (used only as a scripting layer; no browser download
because we use the system Chrome via `channel: 'chrome'`). If `node_modules` is
absent in the skill directory, bootstrap from the committed lockfile:

```
cd {{skills_dir}}/remote-browser-cdp-kvm && npm ci
```

Requires Node 22+ and a system Chrome/Chromium (`google-chrome`). Config is via
env vars (all optional): `BCDP_PROFILE` (login profile dir, default
`~/.cache/remote-browser-cdp-kvm`), `BCDP_PORT` (CDP port, default `9333`),
`BCDP_KVM_PORT` (default `6080`), `BCDP_HEADED` (`1`/`0`; default headed iff
`$DISPLAY` is set, while headless still streams fine over the KVM).

# The verbs

Run `node .../bcdp.mjs help` for the authoritative list. Summary:

| Verb | Does | Key args |
|------|------|----------|
| `launch` | Ensure the shared browser is up (idempotent) | — |
| `status` | Is it up? list open tabs | — |
| `open <url>` | Navigate + optional screenshot | `--shot p` `--wait ms` `--until load` |
| `shot <path>` | Screenshot current tab | `--full` `--match sub` |
| `click` | Click an element | `--selector` \| `--text` \| `--role` with optional `--name`, `--frame <iframe-css>`, `--shot` |
| `type <text>` | Fill a field | `--selector <css>` `--enter` `--shot` |
| `read` | Extract innerText | `--selector` `--max n` |
| `wait` | Wait for an element/state | `--selector` \| `--text` \| `--role`, `--state visible`, `--timeout` |
| `eval "<js>"` | Run JS, return JSON value | `--shot` |
| `kvm start\|stop` | Human-in-the-loop control | — |

Notes:
- Every verb prints one JSON line: `{ok, url, title, ...}` (plus `shot` if you
  passed `--shot`). Parse that, not the terminal output.
- `--frame <iframe-css>` scopes `click`/`type`/`wait` **into an iframe**, which
  is how you reach embedded reCAPTCHA / SSO widgets.
- `--match <substr>` picks which tab to act on when several are open.
- `eval` is a reviewed escape hatch for anything the verbs do not cover. It is
  disabled unless `BCDP_ALLOW_EVAL=1`; keep the expression narrow and its return
  value JSON-serialisable.

**Write code, don't hand-drive.** For any task that needs more than one verb,
write a tiny shell (or `.mjs`) script that runs the sequence and prints one final
JSON summary, and hand *that* to the worker rather than a chain of manual calls.

# Delegating tasks to subagents (harness-agnostic)

This skill does **not** assume how you spawn subagents. Whatever your harness
offers, use it, whether a Task/Agent tool, a fork, an RPC to another agent, or a
shell that runs a second CLI agent. A "browser task" is fully specified by three things,
so a worker needs nothing else:

1. the exact `bcdp` verb(s) to run,
2. the screenshot output path(s),
3. what to return.

Because the shared browser holds all state and the CDP port is fixed, workers
need **no** shared memory beyond those three. Hand each worker a block like:

```
GOAL: <one sentence>
RUN (in order), then report:
  node {{skills_dir}}/remote-browser-cdp-kvm/scripts/bcdp.mjs open "<url>" --shot <OUT>/step1.png
  node {{skills_dir}}/remote-browser-cdp-kvm/scripts/bcdp.mjs click --text "<label>" --shot <OUT>/step2.png
RETURN ONLY: a 2–3-line summary, the screenshot paths, and any values you were
asked to extract (as JSON). Do not paste page HTML or full page text.
```

Model guidance: run **workers on the cheapest/fastest model** that can execute a
shell command and describe a screenshot, because the verbs do the deterministic work,
so workers barely need to reason. Keep the **orchestrator on the smart model**;
its only jobs are to plan the verb sequence, read returned screenshots, and
decide the next step. This is the whole point: protect the orchestrator's
context and speed while parallelising/serialising cheap browser tasks.

# Human-in-the-loop (KVM over tailnet)

Some steps have no automated path: interactive login, a reCAPTCHA image
challenge, an SSO consent screen, a 2FA prompt, or "look at this and approve".
When you hit one:

1. `node .../scripts/bcdp.mjs kvm start`, which verifies the shared browser,
   starts the screencast control on `127.0.0.1:$BCDP_KVM_PORT`, and prints a
   capability URL containing a random token in its fragment.
2. Tell the human to expose it over their tailnet (they run this, since an agent
   usually can't `sudo`/`tailscale`):
   ```
   tailscale serve --bg 6080      # NEVER `tailscale funnel`, which is public
   tailscale serve status         # prints the https://<host>.ts.net URL
   ```
3. Append the printed `/#TOKEN` fragment to the tailnet URL. The human opens
   that complete URL on their phone: **tap = click, drag = scroll**, and
   the bottom bar types into the focused field (⏎ / ⌫ buttons). They complete the
   human-only step in the real shared tab.
4. Verify from your side with `read` / `shot` until the expected state appears
   (e.g., an auth cookie is present or the target page has rendered).
5. `node .../bcdp.mjs kvm stop`, and remind the human to run
   `tailscale serve reset` to close the tailnet route.

Security: `serve` keeps it tailnet-private, and the random token gates the KVM
stream and input endpoints. The KVM exposes only one browser tab, never the
desktop. Still treat the capability URL as a secret: start it only for the human
step, do not paste it into durable logs, and tear it down immediately afterward.

# Teardown

- `kvm stop` + remind the human to `tailscale serve reset`.
- Leave the **browser** running (that is the point, so reuse the login next time).
  Only `bcdp stop` it if you deliberately want to end the session.

Browser and KVM diagnostics are written with user-only permissions to
`browser.log` and `kvm.log` inside `BCDP_PROFILE`.

# Development

Run `npm test` for static and failure-path checks. Run `npm run smoke` only on a
machine with system Chrome; it launches an isolated temporary profile and never
uses the durable logged-in profile.
