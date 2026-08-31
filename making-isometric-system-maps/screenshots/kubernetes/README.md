# Kubernetes example

The [gallery](../../README.md#kubernetes-gallery) combines a repository tour with
a representative runtime view: a Deployment and selector-based ClusterIP Service
on Linux, using kube-proxy's iptables implementation. Source paths in
[data.js](data.js) refer to Kubernetes commit
[`e72c2715ade37738aa5c029e8de5285cbe1c9441`](https://github.com/kubernetes/kubernetes/tree/e72c2715ade37738aa5c029e8de5285cbe1c9441).

## Read the map

API objects are shared records, not processes or additional stores. Controllers,
the scheduler, and kubelets watch and update state through kube-apiserver; etcd
sits behind that API. Proxies watch API state and program local forwarding rules.
The controller-manager boundary contains controller code, while each worker
repeats its own agents, runtime, and dataplane. The per-node dataplane boundary
encloses forwarding state, not the proxy process that programs it. Drawn workers
and Pod replicas illustrate repetition, not a required cluster size or placement.

| Edge style | Meaning |
| --- | --- |
| Dashed | API watch delivery or writes; arrows follow the named state transfer, not who opens the HTTP request. |
| Solid / bold | Invocation, persistence, or dataplane programming / application packets. |
| Dotted | Object ownership, selection, or assignment; not direct calls between controllers. |

Trace flow is a reading order through one successful example, not a transaction,
total ordering, or single pass. Status updates, readiness changes, retries, and
independent reconciliation continue after the narrated step.

## Source anchors and boundaries

| Concern | Evidence and interpretation |
| --- | --- |
| Shared state and ownership | The [API storage adapter](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/staging/src/k8s.io/apiserver/pkg/storage/etcd3/store.go) persists objects. [Controller-manager construction](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/cmd/kube-controller-manager/app/apps.go) hosts independent loops. [Deployment reconciliation](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/controller/deployment/sync.go) creates owned ReplicaSets; [Pod creation](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/controller/controller_utils.go) carries owner references through API writes. Deployment → ReplicaSet → Pod is ownership, not an invocation pipeline. |
| Placement and execution | The [default binder](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/scheduler/framework/plugins/defaultbinder/default_binder.go) requests a Pod-to-Node binding; [API binding storage](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/registry/core/pod/storage/storage.go) sets `spec.nodeName`. [Kubelet's API source](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/kubelet/config/apiserver.go) selects assigned Pods. Kubelet invokes the external runtime through [CRI](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/staging/src/k8s.io/cri-api/pkg/apis/runtime/v1/api.proto); runtime-managed [CNI plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/) configure networking. Binding is not execution or readiness. Runtime/CNI internals are outside this repository. |
| Readiness and traffic | The [EndpointSlice controller](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/controller/endpointslice/endpointslice_controller.go) matches Service selectors against Pod labels. [Endpoint conditions](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/staging/src/k8s.io/endpointslice/utils.go) distinguish Ready, Serving, and Terminating; `publishNotReadyAddresses` changes the usual readiness rule. [iptables reconciliation](https://github.com/kubernetes/kubernetes/blob/e72c2715ade37738aa5c029e8de5285cbe1c9441/pkg/proxy/iptables/proxier.go) programs host rules that select backend IPs and ports. kube-proxy and kube-apiserver are not packet hops. |

This example covers API-assigned Pods and selector-based Services. Static Pods,
selectorless Services, and replacement dataplanes have other paths. Cross-node
network implementation and control-plane high availability are not modeled;
their omission does not imply they are absent. Running does not mean Ready,
and readiness is not an unconditional promise that every packet reaches a
healthy backend.

## Reproduce the gallery

1. Copy [assets/starter](../../assets/starter/) into a fresh directory and replace
   its `data.js` with [this example's data](data.js).
2. Copy [example.css](example.css) beside `style.css`. In the copied `index.html`,
   add `<link rel="stylesheet" href="example.css">` immediately after the
   `style.css` link. Serve that directory over HTTP; no install or build is needed.
3. Choose **Drafting Paper**. Capture the initial fitted overview, select
   **kube-apiserver**, then clear the selection and advance **Trace flow** to its
   midpoint, **12/24**: external CNI plugin → node dataplane B
   (`program-network-b`). Wait for the camera transition before capturing.

The extra stylesheet distinguishes edge IDs prefixed `watch-`/`write-`,
`invoke-`/`program-`, `packet-`, and `object-`, and supplies the compact floor-edge
legend. It also widens index codes and limits mobile index height to keep the map
prominent. It does not replace the starter renderer, geometry, or base stylesheet.

Desktop captures use a 1600 × 1000 viewport; mobile uses 430 × 932 touch emulation,
both at device pixel ratio 2. Mobile captures include the full page so the stacked
explainer remains visible. The gallery uses browser screenshots, not retouched
illustrations.
