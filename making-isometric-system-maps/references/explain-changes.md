# Explain big changes

Establish what is changing and for whom: a PR, two revisions, a working-tree diff,
or a proposed design. Ask for missing comparison endpoints rather than inventing
them. Read the relevant source on both sides, not only the diff; delegate
independent subsystem research when useful.

Identify the architectural change: moved responsibility, new boundary, changed
state ownership, dependency, execution path, or failure behavior. Omit unrelated
implementation churn.

Reuse an existing map when available. For before/after views, keep unchanged
components in the same positions with stable identifiers and comparable framing.
Make additions, removals, and rerouted relationships explicit in labels or a small
legend; do not rely on color alone. Distinguish deployed behavior from a proposal
and any temporary migration state. Do not invent a deployment sequence from a diff.

Walk through one affected path and its consequences, including important feedback
or failure paths. A trace is an explanation order, not evidence of synchronous
execution. Include useful source paths and the compared revisions.

Deliver the map with a short account of what changed and why it matters. Creating
the explanation does not authorize implementing the underlying change. Read the
[screenshot guide](capture-screenshots.md) only if images are also requested.
