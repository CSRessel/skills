# Build an architecture together

The map is a proposal, not a claim about existing code. Build on what I have
already said. Settle purpose, users, key requests, and constraints before
picking components.

Ask one question at a time, with a recommended answer and its tradeoff. Settle
dependent decisions first. Read existing code instead of asking what it can
tell you. For greenfield work, state assumptions; never invent source paths.

Sketch the smallest useful design: responsibilities, state ownership,
boundaries, main relationships. For an open, consequential choice, show a few
alternatives and wait for my pick.

Once we agree enough to sketch, copy `assets/starter/` if no map exists. Leave
`files` empty for proposed components. Title it with the project name, mark it
"proposed" in the subtitle, and keep existing and proposed parts visibly
different.

Walk one request or event through the design, then its failure, retry, and
recovery paths. Update the same map as decisions settle. Put open questions in
the affected component's explanation.

Finish with the map, key tradeoffs, and open decisions. Never implement the
system unless I ask.
