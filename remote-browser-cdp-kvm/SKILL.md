---
name: remote-browser-cdp-kvm
description: Use when a task needs a real logged-in browser driven programmatically AND may hit human-only walls (login, CAPTCHA, SSO, 2FA, visual sign-off), especially when the human is remote. Provides a shared long-lived Chrome over CDP, small repeatable per-task "verbs" that each do one action + capture a screenshot (so single tasks can be handed to cheap subagents), and a phone/tailnet KVM escape hatch for the human-in-the-loop steps.
---

<required>
*CRITICAL* Add the following steps to your task list:

1. Start the shared browser with `bcdp launch`. On first run, install dependencies.
2. Split the browser goal into single-task verbs. Give each verb an explicit screenshot path.
3. Delegate each browser task to a worker subagent on a cheap, fast model. Never reason through the DOM in the orchestrator.
4. If a step needs a human (login, CAPTCHA, SSO, 2FA, visual approval), start the KVM, give the human the tailnet URL, wait, then verify the resulting state.
5. Read the returned screenshots and keep only the conclusions. Never keep raw DOM, page text, or worker transcripts in the orchestrator's context.
6. When done, stop the KVM. Leave the browser running for reuse.
</required>

# Overview

You drive **one** durable Chrome over the Chrome DevTools Protocol (CDP). Its dedicated profile keeps the login across sessions. Each verb does one thing, prints one JSON line, and optionally saves a screenshot. The browser holds all state, so a cheap worker can run any verb alone.

Run the CLI from this skill's `scripts/` directory. If `{{skills_dir}}` is unsubstituted, use the directory that contains this SKILL.md.

```
node {{skills_dir}}/remote-browser-cdp-kvm/scripts/bcdp.mjs <verb> [args]
```

# Setup (first run on a machine)

If the skill directory has no `node_modules`, install from the lockfile:

```
cd {{skills_dir}}/remote-browser-cdp-kvm && npm ci
```

This needs Node 22+ and a system Chrome or Chromium (`google-chrome`).

All configuration is optional env vars:

- `BCDP_PROFILE`: login profile directory. Default `~/.cache/remote-browser-cdp-kvm`.
- `BCDP_PORT`: CDP port. Default `9333`.
- `BCDP_KVM_PORT`: KVM port. Default `6080`.
- `BCDP_HEADED`: `1` or `0`. Default headed when `$DISPLAY` is set. Headless still streams over the KVM.
- `BCDP_VIEWPORT`: tab size as `WxH`. Default `1440x900`. If the human will view the KVM on a phone, set a narrow size such as `480x860`.

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

- Every verb prints one JSON line: `{ok, url, title, ...}`, plus `shot` when you pass `--shot`. Parse that line, not other terminal output.
- To reach an iframe, such as an embedded reCAPTCHA or SSO widget, pass `--frame <iframe-css>` to `click`, `type`, or `wait`.
- If several tabs are open, pick one with `--match <substr>`.
- Use `eval` only for what the verbs cannot do. It runs only when `BCDP_ALLOW_EVAL=1`. Keep the expression narrow and its return value JSON-serializable.

If a task needs more than one verb, write a small shell or `.mjs` script that runs the sequence and prints one final JSON summary. Hand the worker that script, not a chain of manual calls.

# Delegating tasks to subagents

Spawn workers with any mechanism your harness has. Give each worker only three things:

1. the exact `bcdp` verbs or script to run,
2. the screenshot output paths,
3. what to return.

Use this block:

```
GOAL: <one sentence>
RUN (in order), then report:
  node {{skills_dir}}/remote-browser-cdp-kvm/scripts/bcdp.mjs open "<url>" --shot <OUT>/step1.png
  node {{skills_dir}}/remote-browser-cdp-kvm/scripts/bcdp.mjs click --text "<label>" --shot <OUT>/step2.png
RETURN ONLY: a 2–3-line summary, the screenshot paths, and any values you were
asked to extract (as JSON). Do not paste page HTML or full page text.
```

Run workers on the cheapest model that can run a shell command and describe a screenshot. Keep the orchestrator on the smart model, planning verbs and reading screenshots.

# Human-in-the-loop (KVM over tailnet)

If a step has no automated path, hand it to the human:

1. Run `node .../scripts/bcdp.mjs kvm start`. It serves the KVM on `127.0.0.1:$BCDP_KVM_PORT` and prints a capability URL with a token in its fragment.
2. Ask the human to expose the port on their tailnet. They run this, because you usually cannot run `sudo` or `tailscale`:
   ```
   tailscale serve --bg 6080      # NEVER `tailscale funnel`, which is public
   tailscale serve status         # prints the https://<host>.ts.net URL
   ```
3. Tell the human to append the printed `/#TOKEN` fragment to the tailnet URL and open it on their phone. Tap clicks, drag scrolls, and the bottom bar types into the focused field (⏎ / ⌫ buttons). They finish the step in the real shared tab.
4. Check with `read` or `shot` until the expected state appears, such as an auth cookie or the rendered target page.
5. Run `node .../bcdp.mjs kvm stop`. Remind the human to run `tailscale serve reset`.

The KVM exposes one browser tab, never the desktop. Treat the capability URL as a secret. Never paste it into durable logs. Start the KVM only for the human step and stop it right after.

# Teardown

Leave the browser running so the next task reuses the login. Run `bcdp stop` only to end the session on purpose. Diagnostics are in `browser.log` and `kvm.log` inside `BCDP_PROFILE`.

# Development

Run `npm test` for static and failure-path checks. Run `npm run smoke` only on a machine with system Chrome. It launches an isolated temporary profile and never touches the durable logged-in profile.
