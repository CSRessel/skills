# Isometric system maps — draft

This package contains the authoring workflow in [SKILL.md](SKILL.md) and the approved
[starter](assets/starter/): the page, map data, renderer, geometry and its existing
test file, styles, and bundled fonts. The package remains a draft pending review.

The default [map data](assets/starter/data.js) follows a simplified SQLite
`SELECT`: compile SQL, run bytecode, read uncached pages, and return a result row
to the caller. It is grounded in
[pinned SQLite source](https://github.com/sqlite/sqlite/tree/d92acf1afe6dbd4c8aec9aa9513a518f690c2acf);
source paths in the map are relative to that repository. It is not a complete
transaction or WAL model.

The page's font link is local; font notices are included in
[fonts.css](assets/starter/fonts.css). See [NOTICE](../NOTICE).

## Kubernetes gallery

A Deployment and selector-based ClusterIP Service, organized around shared API
objects. Controllers, the scheduler, and kubelets independently watch state and
write updates through kube-apiserver. Proxies watch API state and reconcile local
forwarding rules. Control-plane,
controller-manager, worker-node, and per-node dataplane boundaries separate
logical objects, executing code, and packet forwarding.

The networking example uses Linux kube-proxy/iptables: proxies program local
rules; packets do not pass through the proxy process. See the
[source notes and reproduction steps](screenshots/kubernetes/README.md) for the
pinned Kubernetes evidence, edge vocabulary, and limits of this mixed code/runtime
view.

Click any screenshot to view the original.

| Moment | Desktop | Mobile |
| --- | --- | --- |
| **Overview**<br>The entire map. | [<img src="screenshots/kubernetes/desktop-overview.png" alt="Desktop overview of the Kubernetes system map in the paper theme" width="640">](screenshots/kubernetes/desktop-overview.png) | [<img src="screenshots/kubernetes/mobile-overview.png" alt="Mobile overview of the Kubernetes system map, including the stacked explainer" width="180">](screenshots/kubernetes/mobile-overview.png) |
| **Selection**<br>kube-apiserver and all its incident relationships. | [<img src="screenshots/kubernetes/desktop-selected.png" alt="Desktop map with kube-apiserver selected and its incident relationships highlighted" width="640">](screenshots/kubernetes/desktop-selected.png) | [<img src="screenshots/kubernetes/mobile-selected.png" alt="Mobile map with kube-apiserver selected and its explanation below" width="180">](screenshots/kubernetes/mobile-selected.png) |
| **Flow trace**<br>External CNI plugin → node dataplane B, with automatic zoom and an explainer. | [<img src="screenshots/kubernetes/desktop-flow.png" alt="Desktop Kubernetes flow trace at step 12 of 24: external CNI plugin configures node dataplane B, with automatic zoom and an explainer" width="640">](screenshots/kubernetes/desktop-flow.png) | [<img src="screenshots/kubernetes/mobile-flow.png" alt="Mobile Kubernetes flow trace at step 12 of 24: external CNI plugin configures node dataplane B, with automatic zoom and the explainer below" width="180">](screenshots/kubernetes/mobile-flow.png) |

Real, unretouched browser captures in the paper theme. Desktop uses a
1600 × 1000 viewport; mobile uses 430 × 932 touch emulation. Both use device
pixel ratio 2. Mobile captures include the full page so the stacked explainer
remains visible.

The example uses the [starter](assets/starter/) with replacement
[map data](screenshots/kubernetes/data.js) and a small
[example-only stylesheet](screenshots/kubernetes/example.css) for the edge
vocabulary, legend, and index legibility. The core starter files remain unchanged.
No package installation or build is needed.

## Optional guides

The core workflow stays short. Load only the guide that matches the task, reusing
existing answers and map files rather than restarting the creation workflow.

- [Customize the visuals](references/customize-visuals.md): spatial judgment, layout, styling, and controls.
- [Explain big changes](references/explain-changes.md): source-grounded comparisons with stable framing.
- [Build an architecture together](references/design-together.md): explore proposed designs and their tradeoffs.
- [Capture architectural screenshots](references/capture-screenshots.md): reproducible browser images for documentation or review.

## Validation status

Independent source audits informed the shared-state example, including ownership,
Pod binding, node execution, readiness feedback, and Service forwarding. Browser
checks validated selection, flow tracing, camera controls, and desktop/mobile
touch interactions. These are not live-cluster tests or a complete model of
Kubernetes.

This is evidence from one revised example, not a new blind test or broad
validation of the workflow or the optional guides.
