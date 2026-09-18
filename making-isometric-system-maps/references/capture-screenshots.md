# Capture architectural screenshots

Reuse the existing map. Match the requested destination, viewport, theme, and
moments. If unspecified, a useful set is the full overview, a well-connected
component selected, and a midway flow step with its explanation. Include mobile
when requested or relevant to the destination; do not create extra views by habit.

Serve the map over HTTP and use available browser tools, following their setup
instructions. Wait for fonts, rendering, and camera motion to settle. Use the same
viewport and pixel ratio for comparable images. Set the theme explicitly; saved
browser preferences can override the map's default.

For the overview, clear selection by selecting again or tapping blank space,
then fit the map. Fit alone does not clear selection. For a trace, start from a
cleared state and advance to the intended step. Keep its endpoints and explainer
legible. Move the pointer away from the map to avoid accidental hover labels.

Capture real PNGs. Inspect each image for clipping, unreadable text, wrong state,
and browser errors. Include the stacked explainer in mobile captures; keep
diagrams, titles, and legends visible when cropping UI for a document.

Save the requested files with descriptive names. Record enough to reproduce them:
map source/revision, theme, viewport, pixel ratio, selected component or flow step.
Use captions that explain the moment, not just “screenshot.” If browser tools are
unavailable, report that limitation instead of claiming captures or visual checks.
