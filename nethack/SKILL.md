---
name: nethack
description: Inspect and play a live NetHack game through the bundled compact `nh` harness. Use for NetHack movement, exploration, combat, prompts, inventory decisions, pet safety, screen interpretation, or run-state reporting when the game is hosted in an isolated tmux session.
---

# NetHack

Use `scripts/nh/nh`; do not send gameplay input through raw `tmux` commands.
The harness captures before and after every action, classifies the event, and
keeps terminal output out of context unless explicitly requested.

## Operating loop

1. Run `scripts/nh/nh status` before deciding.
2. Use `scripts/nh/nh do INPUT` for one atomic action.
3. Read the event flags and updated neighborhood before acting again.
4. Use `scripts/nh/nh map` only when route planning needs the whole visible map.
5. Use `scripts/nh/nh raw` only to diagnose a parser or UI-mode failure.

Use semantic directions (`north`, `south`, `east`, `west`, `ne`, `nw`, `se`,
`sw`) when clarity matters. A one-character input always retains its literal
NetHack meaning. Use `run COUNT INPUT` only for a known-safe repeated action; it
still observes each key and stops on prompts, combat, HP loss, unknown UI modes,
or two consecutive screens where the pet is hidden.

Never bypass a refusal caused by a prompt mode. Resolve the prompt with an
allowed atomic input or inspect the raw screen if its meaning is unclear.

## Research

For every factual lookup about mechanics, strategy, items, monsters, messages,
configuration, or version behavior, invoke `$nethack-wiki-research`. Do not load
the local wiki corpus into the playing agent's context.

Keep facts distinct from deductions based on the current screen. Surface only
unusual state, risk, irreversible choices, or genuinely new discoveries unless
the user requests narration or explanation.

## Harness development

The Rust project lives in `scripts/nh/`. After changing it, run:

```sh
cargo fmt --check --manifest-path scripts/nh/Cargo.toml
cargo test --all-targets --manifest-path scripts/nh/Cargo.toml
cargo clippy --all-targets --manifest-path scripts/nh/Cargo.toml -- -D warnings
```

Tests use captured fixtures and fake TUI helpers; they must not touch the live
game. See `scripts/nh/NH-HARNESS.md` only when modifying or debugging the harness.
