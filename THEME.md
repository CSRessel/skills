# Theme

Every HTML surface in this repository — the isometric system map, the code
orientation viewer, and the rendered HTML plan — uses one palette in two
variants, with one set of token names.

Each variant is **dichromatic**: one background, one foreground, and one
spectrum that the whole drawing is stated in. Nothing introduces a third hue.
`--accent` is the brightest step of that same spectrum, never a contrasting
colour.

- **`paper`** — black on warm paper, drawn in charcoal. Light. No coloured
  accent at all: emphasis is a matter of how strongly the charcoal is stated.
  Links therefore carry an underline, because colour alone cannot mark them.
- **`carbon`** — white on black, drawn in green. Dark. Descended from IBM
  Carbon, so it matches the terminal palette that
  `tui-capture-with-ghostty-web` renders with.

## Tokens

| Token | Role | `paper` | `carbon` |
| --- | --- | --- | --- |
| `--canvas` | the page, the drawing surface, the sheet | `#ece6d8` | `#161616` |
| `--panel` | flanking chrome: nav, toolbars, diagram frames | `#e7e0d0` | `#1c1c1c` |
| `--raised` | insets inside a panel: code, table heads, hover | `#d9d1bf` | `#262626` |
| `--rule` | hairlines, borders, dividers | `#b7ad99` | `#393939` |
| `--ink` | body text, headings | `#1f1c18` | `#dde1e6` |
| `--muted-ink` | labels, secondary text, captions | `#5a564f` | `#8a8f98` |
| `--faint` | de-emphasised strokes | `#a09c94` | `#4a4a4a` |
| `--accent` | active state, links, the one pointer | `#26231e` | `#42be65` |
| `--accent-ink` | text on a solid `--accent` fill | `#f4efe3` | `#0e0e0e` |
| `--draw` | ordinary drawing stroke | `#6d6a64` | `#3f9e59` |
| `--draw-strong` | the emphasised stroke | `#1f1c18` | `#7bf2a4` |
| `--edge` | connector between drawn units | `#6b6660` | `#b9bec4` |
| `--danger` | errors and refusals — the one functional exception | `#da1e28` | `#f47067` |

`making-isometric-system-maps` additionally defines `--grid-line`,
`--zone-line`, `--plate` and `--plate-ink` for the drafting grid and the
nameplates, and ships a third `cyanotype` variant. Those are specific to the
isometric drawing and are not part of the shared set.

## Print

Print is neither variant. Charcoal on warm paper wastes ink and carbon is
unprintable, so the plan scaffold falls back to black on white for
`@media print`. Those greys are print-only and are not part of either variant.

## Mermaid

Diagram rendering is theme-mapped, not left to Mermaid's built-in `default`
and `dark` themes. Both viewers initialise Mermaid with `theme: 'base'` and a
full variable set, so a diagram is drawn in charcoal under `paper` and in
green under `carbon`. The two sets live beside each other in:

- `code-orientation/viewer/viewer.js`
- `presenting-html-plans/assets/scaffold/app.mjs`

## Why the values are duplicated

Each of these asset directories is copied out and served standalone — a plan
scaffold lands in `plans/<name>/`, a system map lands in the project being
mapped. A shared stylesheet would not survive the copy. The values are
therefore repeated in each surface, and this file is the reference they are
checked against.
