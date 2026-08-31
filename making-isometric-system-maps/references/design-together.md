# Build an architecture together

Treat the map as a design conversation, not a claim about existing code. Start
from what I have already told you. Establish the system's purpose, users, key
requests, and constraints before selecting components.

Ask one question at a time, recommend an answer with its tradeoff, and resolve
dependent decisions first. Investigate questions existing code can answer. For a
greenfield project, make assumptions explicit instead of inventing source paths.

Sketch the smallest useful arrangement: responsibilities, state ownership,
boundaries, and the main relationships. Where a consequential choice remains,
show a small number of alternatives and ask me to choose before elaborating it.

If no map exists, copy `assets/starter/` into a working map directory once there
is enough agreement to sketch. Adapt its data; leave `files` empty for proposed
components without source. Use the project name as the title and label the view
as proposed in its subtitle. Keep existing and proposed parts distinguishable.

Walk a representative request or event through the design, then examine relevant
failure, retry, and recovery behavior. Revise the same map as decisions settle;
put unresolved questions in the affected component's explanation.

Finish with the agreed map, key tradeoffs, and remaining decisions. Do not turn
agreement on a diagram into permission to implement the system.
