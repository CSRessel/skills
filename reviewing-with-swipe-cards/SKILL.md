---
name: reviewing-with-swipe-cards
description: Use when a person needs to give a quick agree or disagree on a list of items - open questions, spec assumptions, grilling-session answers, implementation choices, PRs to approve, issues or feature requests to triage - one card at a time in a swipeable browser page with keyboard shortcuts and optional notes, and the agent needs to read the answers back.
---

<required>
CRITICAL Add the following steps to your task tracker: TaskCreate (claude), update_plan (codex), etc.

1. Write the items as a deck file in a durable folder. (§1)
2. Serve the deck on a free port in the background and check that it responds. (§2)
3. Send the link with a cache-busting timestamp, plus a one-line how-to. End your turn. (§3)
4. When the person says they are done, run `summary.mjs` and act on every decision and note. Ask about every card that is still open. (§4)
5. To change cards, edit the deck and send a fresh timestamped link. (§5)
</required>

The tool lives in the `assets/` folder next to this file. Below, `$TOOL` means the absolute path to that folder. It needs only Node 18 or later; there are no dependencies.

## 1. Write the deck

Put the deck in a folder that survives the session, for example `.local/reviews/NAME/deck.json` in the repository the review is about. Do not use `/tmp`.

Start from `$TOOL/example-deck.json`. Each item has:

- `id`: short, stable, unique. Answers are keyed by it, so do not rename it after serving.
- `title`: the short question, ideally under 10 words.
- `description`: the full context the person needs to decide. Inline `code`, `**bold**` and URLs render.
- `recommendation`: your default, starting with the verdict ("Accept.", "Merge.", "Drop it.").
- `eyebrow` (optional): replaces the "Question N of M" label, for example a PR number.

Optional top-level keys: `title`, `subtitle`, `agreeLabel`, `disagreeLabel` (for example "Merge" and "Skip" for a PR queue).

Write each card so the decision makes sense without the rest of the conversation. Keep one decision per card. Keep descriptions short enough to fit the card. Longer text scrolls inside the card.

## 2. Serve and check

Pick a free port, for example 4100.

```bash
nohup node "$TOOL/server.mjs" "$DECK" "" 4100 > "$(dirname "$DECK")/server.log" 2>&1 &
curl --silent --show-error --fail-with-body -o /dev/null http://127.0.0.1:4100/
```

Arguments are the deck path, an optional answers path, and an optional port. An empty answers argument means `deck.answers.json` next to the deck. The server saves every answer to that file as the person swipes.

The server listens on `127.0.0.1` only. If the person reaches this machine through a reverse proxy or tunnel, check the URL they will open, not just localhost. Set `HOST=0.0.0.0` only when you need to expose it on the network directly.

For two reviews at once, use separate deck folders and ports.

## 3. Send the link

Send the URL the person can open, with `?t=$(date +%s)` appended so the browser does not show a stale deck. In Slack, link it as `<URL|short label>`; elsewhere post the plain URL.

Tell the person: drag right to agree, left to disagree, or tap the buttons. Keys: `→` agree, `←` disagree, `U` or `⌘Z` undo, `↵` to add a note, `Esc` to leave the note. They finish on a summary where any row can be reopened. Ask them to tell you when they are done.

End your turn. Do not poll the answers file while they review.

## 4. Read the answers

```bash
node "$TOOL/summary.mjs" "$DECK"
```

It prints every card as AGREE, DISAGREE or OPEN, with notes. Then:

- Treat a disagree or a note as a decision to act on or ask about. Do not assume what a bare disagree means; ask when the alternative is unclear.
- List the OPEN cards back to the person and ask for them. Never treat an open card as agreed.
- Record the decisions where the work keeps them, such as project docs, the PR, or the spec.

## 5. Change the deck

Edit `deck.json` and send a fresh timestamped link. The server re-reads the deck on every page load, so no restart is needed. Answers to unchanged ids stay. To start over, delete the answers file.

## Things to know

- Cards have a fixed height and the controls are pinned to the bottom of the screen, so taps land in the same place on mobile. Do not reintroduce layouts where the controls move with the card height.
- The page follows the system light or dark setting.
