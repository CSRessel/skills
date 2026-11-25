# Explain big changes

Pin down the comparison and its audience: a PR, two revisions, a working-tree
diff, or a proposal. If an endpoint is missing, ask; never invent one. Read the
source on both sides, not just the diff.

Name the architectural change: moved responsibility, new boundary, changed state
ownership, dependency, execution path, or failure behavior. Skip unrelated
churn.

Reuse an existing map. In before/after views, keep unchanged components in the
same place with the same IDs and framing. Mark additions, removals, and
rerouted links with labels or a legend, not color alone. Separate deployed
behavior, proposals, and migration states. Never infer a deployment sequence
from a diff.

Walk one affected path, including key feedback or failure paths. Trace order is
explanation order, not proof of synchronous execution. Cite source paths and
the compared revisions.

Deliver the map with a short summary of what changed and why it matters. Never
implement the change unless I ask. Read the
[screenshot guide](capture-screenshots.md) only if I want images.
