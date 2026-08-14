---
name: nethack-wiki-research
description: Research NetHack mechanics, strategy, items, monsters, messages, configuration, or version-specific behavior from the workspace's local NetHackWiki and official NetHack files. Use whenever gameplay reasoning would benefit from looking up or verifying a NetHack fact. Always delegate the research to a sub-agent so raw source material does not enter the primary playing agent's context.
---

# NetHack Wiki Research

## Mandatory delegation

Do not read or search NetHack reference material in the primary agent.

Spawn one read-only research sub-agent and give it:

- the precise question;
- only the run facts needed to answer it;
- the workspace path containing `wiki/`;
- the output contract below.

Use additional sub-agents only for genuinely independent questions. Do not let a
research sub-agent operate the live game, edit files, or delegate again.

If sub-agents are unavailable, report that research is blocked instead of loading
the wiki into the primary context. If the first result is incomplete, send a
follow-up to the same sub-agent.

## Research procedure for the sub-agent

1. Prefer local sources. Use `wiki/bin/nethackwiki search` to find titles and
   `wiki/bin/nethackwiki show` for exact pages. Use the files under
   `wiki/official/nethack-5.0.0/` for authoritative version-specific behavior.
2. Bound every extraction at the command level. Retrieve only relevant sections;
   never emit a complete long article, dump, price table, or raw XML page.
3. Prefer the NetHack 5.0.0 Guidebook or installed-version material when sources
   disagree. Identify claims inherited from 3.6.x or marked as upcoming.
4. Separate confirmed facts, strong deductions, and unresolved possibilities.
5. Do not browse the web unless the user explicitly requests it or the local
   corpus lacks the answer.

## Sub-agent output contract

Return at most 300 words using this shape:

```text
Conclusion
- Direct answer and recommended gameplay implication.

Evidence
- Source title or local file: supporting fact.

Version notes
- Compatibility caveat, or "None".

Unknowns
- Remaining ambiguity, or "None".
```

Do not include raw page source, long quotations, broad tables, search-result
noise, or a narration of commands used.

## Primary-agent handoff

Use the bounded report to answer the user or make the gameplay decision. Preserve
the fact/deduction distinction. Add durable findings to the run wiki only when
they materially affect the current run; do not copy the research transcript.
