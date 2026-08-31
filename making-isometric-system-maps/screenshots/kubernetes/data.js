// Two representative workers, not a promise that a scheduler spreads replicas.
const workers = [{ id: 'a', x: 0 }, { id: 'b', x: 20 }];
const workerNodes = ({ id, x }) => [
  {
    id: `kubelet-${id}`, zone: `worker-${id}`, code: `K${id.toUpperCase()}`,
    name: `kubelet ${id.toUpperCase()}`, x: x + 1, y: 29, w: 4, d: 3, h: 2.6,
    summary: 'An independent agent on this worker. Watches Pods whose '
      + 'spec.nodeName names this Node, reconciles them through CRI, and '
      + 'reports Pod readiness/status and Node status through the API. '
      + 'Local work is retried and resynced; a binding is not a running Pod.',
    files: ['pkg/kubelet/config/apiserver.go', 'pkg/kubelet/pod_workers.go',
      'pkg/kubelet/status/status_manager.go', 'pkg/kubelet/kubelet_node_status.go'],
  },
  {
    id: `runtime-${id}`, zone: `worker-${id}`, code: 'CRI',
    name: 'external CRI runtime', x: x + 8, y: 29, w: 5, d: 3, h: 2,
    summary: 'A separate runtime implements CRI: create Pod sandboxes, '
      + 'start/stop containers, and return observed runtime state. In this '
      + 'representative Linux path it invokes a CNI plugin to configure '
      + 'sandbox networking. The runtime implementation is outside this repo.',
    files: ['staging/src/k8s.io/cri-api/pkg/apis/runtime/v1/api.proto',
      'pkg/kubelet/kuberuntime/kuberuntime_sandbox.go',
      'pkg/kubelet/kuberuntime/kuberuntime_container.go'],
  },
  {
    id: `workload-${id}`, zone: `worker-${id}`, code: `P${id.toUpperCase()}`,
    name: `workload ${id.toUpperCase()}`, x: x + 1, y: 36.5, w: 4, d: 3, h: 1.8,
    summary: 'Running application containers in a Pod sandbox, distinct '
      + 'from the shared Pod API object. A running container is not necessarily '
      + 'Ready. The illustrated request goes from workload A to a Service '
      + 'backend on worker B; actual placement and routing depend on the cluster.',
    files: ['pkg/kubelet/kuberuntime/kuberuntime_manager.go',
      'pkg/kubelet/kuberuntime/kuberuntime_container.go'],
  },
  {
    id: `cni-${id}`, zone: `worker-${id}`, code: 'CNI',
    name: 'external CNI plugin', x: x + 9, y: 34.5, w: 4, d: 2.5, h: 1.5,
    summary: 'Invoked by the runtime with CNI ADD/DEL to set up or remove '
      + 'Pod networking: interfaces, addresses, and provider-specific '
      + 'connectivity. This executable configures networking; it is not a '
      + 'packet hop. Provider internals are not implemented in Kubernetes.',
    files: ['https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/',
      'https://www.cni.dev/docs/spec/'],
  },
  {
    id: `proxy-${id}`, zone: `worker-${id}`, code: `X${id.toUpperCase()}`,
    name: `kube-proxy ${id.toUpperCase()}`, x: x + 1, y: 33, w: 4, d: 2.3, h: 1.9,
    summary: 'Watches Service and EndpointSlice API state independently on '
      + 'this Node. Reconciles local Service forwarding rules, with local '
      + 'retry/resync. It does not carry application packets or write Pod '
      + 'status. This example uses in-tree iptables; other dataplanes can replace it.',
    files: ['cmd/kube-proxy/app/server.go', 'pkg/proxy/config/config.go',
      'pkg/proxy/iptables/proxier.go', 'pkg/proxy/topology.go'],
  },
  {
    id: `dataplane-${id}`, zone: `dataplane-${id}`, code: `F${id.toUpperCase()}`,
    name: `node dataplane ${id.toUpperCase()}`, shape: 'slab',
    x: x + 8, y: 42, w: 5, d: 2.5, h: .6,
    summary: 'Packet-processing state, not another daemon: Pod network '
      + 'interfaces/routes plus Service rules. On A, iptables selects a '
      + 'backend and DNATs the Service address; cross-node transport delivers '
      + 'that backend address to B without a second Service selection. '
      + 'Transport is provider-specific and this request assumes policy permits it.',
    files: ['pkg/proxy/iptables/proxier.go', 'pkg/util/iptables/iptables.go',
      'https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/'],
  },
];

const workerEdges = ({ id }) => [
  { id: `watch-bound-${id}`, from: 'apiserver', to: `kubelet-${id}`, kind: 'data', label: 'watch Pods bound to this Node' },
  { id: `write-status-${id}`, from: `kubelet-${id}`, to: 'apiserver', kind: 'data', label: 'Pod readiness/status + Node status' },
  { id: `invoke-cri-${id}`, from: `kubelet-${id}`, to: `runtime-${id}`, kind: 'control', label: 'CRI: reconcile sandboxes + containers' },
  { id: `invoke-observe-${id}`, from: `runtime-${id}`, to: `kubelet-${id}`, kind: 'data', label: 'CRI observations → kubelet local state' },
  { id: `invoke-cni-${id}`, from: `runtime-${id}`, to: `cni-${id}`, kind: 'control', label: 'CNI ADD / DEL' },
  { id: `invoke-run-${id}`, from: `runtime-${id}`, to: `workload-${id}`, kind: 'control', label: 'create sandbox; start/stop containers' },
  { id: `program-network-${id}`, from: `cni-${id}`, to: `dataplane-${id}`, kind: 'control', label: 'configure Pod network connectivity' },
  { id: `watch-service-${id}`, from: 'apiserver', to: `proxy-${id}`, kind: 'data', label: 'watch Services + EndpointSlices' },
  { id: `program-service-${id}`, from: `proxy-${id}`, to: `dataplane-${id}`, kind: 'control', label: 'reconcile local Service forwarding rules' },
];

export default {
  title: 'Kubernetes',
  subtitle: 'Shared API state · independent loops · source e72c2715ade3',
  theme: 'paper',

  // Nested regions are logical boundaries, not an exact deployment topology.
  zones: [
    { id: 'client', label: 'API CLIENT', x: -8, y: 10, w: 6, d: 6 },
    { id: 'control', label: 'CONTROL PLANE', x: 0, y: 0, w: 34, d: 23 },
    { id: 'objects', label: 'API OBJECTS · SHARED STATE, NOT PROCESSES', x: 1, y: 1, w: 18, d: 9 },
    { id: 'manager', label: 'KUBE-CONTROLLER-MANAGER', x: 22, y: 2, w: 11, d: 13 },
    ...workers.flatMap(({ id, x }) => [
      { id: `worker-${id}`, label: `WORKER NODE ${id.toUpperCase()}`, x, y: 27, w: 16, d: 19 },
      { id: `dataplane-${id}`, label: 'NODE DATAPLANE', x: x + 7, y: 40, w: 8.5, d: 5.5 },
    ]),
  ],

  nodes: [
    {
      id: 'kubectl', zone: 'client', code: 'K', name: 'kubectl',
      summary: 'kubectl applies Deployment and Service intent through the API. '
        + 'Shared API objects coordinate independent controller, scheduler, '
        + 'kubelet, and proxy loops that converge actual state toward intent. '
        + 'Two representative workers show repeated agents and local dataplanes. '
        + 'Trace follows one successful convergence story, not a synchronous pipeline.',
      x: -7, y: 11.5, w: 4, d: 3, h: 2,
      files: ['staging/src/k8s.io/kubectl/pkg/cmd/apply/apply.go'],
    },
    {
      id: 'apiserver', zone: 'control', code: 'API', name: 'kube-apiserver',
      summary: 'The shared REST/watch interface serves the API objects shown '
        + 'above. Validates and persists writes; watches feed independent '
        + 'consumers, whose updates return here. Object links explain the '
        + 'schema, not extra network hops. Only this component accesses etcd '
        + 'in the illustrated control loops; application packets bypass it.',
      x: 11, y: 13, w: 4.5, d: 3.5, h: 3.8,
      files: ['cmd/kube-apiserver/app/server.go',
        'staging/src/k8s.io/apiserver/pkg/registry/generic/registry/store.go'],
    },
    {
      id: 'etcd', zone: 'control', code: 'E', name: 'etcd', shape: 'cylinder',
      summary: 'External persistence behind the API server’s etcd3 adapter. '
        + 'Stores versioned API objects, not Pod logs or container images. '
        + 'Controllers and node agents use the API rather than accessing '
        + 'this store directly. These source paths are the Kubernetes integration.',
      x: 17, y: 18, w: 3.5, d: 3.5, h: 2.4,
      files: ['staging/src/k8s.io/apiserver/pkg/storage/storagebackend/factory/etcd3.go',
        'staging/src/k8s.io/apiserver/pkg/storage/etcd3/store.go'],
    },
    {
      id: 'deployment-object', zone: 'objects', code: 'DEP', name: 'Deployment (API)',
      summary: 'Declarative rollout intent: replica count, selector, Pod '
        + 'template, and observed rollout status. The Deployment loop creates '
        + 'or scales owned ReplicaSets through the API. The dotted ownership '
        + 'line is metadata, not a call to another component.',
      x: 2, y: 2, w: 4.2, d: 2.5, h: .8,
      files: ['staging/src/k8s.io/api/apps/v1/types.go', 'pkg/controller/deployment/sync.go'],
    },
    {
      id: 'replicaset-object', zone: 'objects', code: 'RS', name: 'ReplicaSet (API)',
      summary: 'Desired replica count and Pod template, with observed '
        + 'replica/readiness status. Owned by a Deployment in this example '
        + 'and itself the owner of its Pods. The ReplicaSet controller reacts '
        + 'to this state independently; ownership does not invoke it.',
      x: 8, y: 2, w: 4.2, d: 2.5, h: .8,
      files: ['staging/src/k8s.io/api/apps/v1/types.go', 'pkg/controller/replicaset/replica_set.go'],
    },
    {
      id: 'pod-object', zone: 'objects', code: 'POD', name: 'Pod (API)',
      summary: 'The shared record of desired containers, labels, assignment '
        + '(spec.nodeName), and observed status/readiness. Different loops '
        + 'read or update different parts. This API record is distinct from '
        + 'the actual sandbox and containers drawn on each worker.',
      x: 14, y: 2, w: 4.2, d: 2.5, h: .8,
      files: ['staging/src/k8s.io/api/core/v1/types.go', 'pkg/registry/core/pod/storage/storage.go'],
    },
    {
      id: 'service-object', zone: 'objects', code: 'SVC', name: 'Service (API)',
      summary: 'A selector-based Service declares an address/ports and '
        + 'which Pod labels identify its backends. It owns generated '
        + 'EndpointSlices, but is not a process that forwards packets. '
        + 'Selectorless, ExternalName, and headless Services are outside this path.',
      x: 2, y: 6.5, w: 4.2, d: 2.5, h: .8,
      files: ['staging/src/k8s.io/api/core/v1/types.go',
        'pkg/controller/endpointslice/endpointslice_controller.go'],
    },
    {
      id: 'slice-object', zone: 'objects', code: 'ES', name: 'EndpointSlice (API)',
      summary: 'Backend addresses, ports, Pod references, and ready/serving/'
        + 'terminating conditions derived by the EndpointSlice controller. '
        + 'Not-ready endpoints may remain in slices; publishNotReadyAddresses '
        + 'overrides ready. Proxies interpret these conditions and traffic '
        + 'policy rather than treating every address as immediately eligible.',
      x: 8, y: 6.5, w: 4.2, d: 2.5, h: .8,
      files: ['staging/src/k8s.io/api/discovery/v1/types.go',
        'staging/src/k8s.io/endpointslice/utils.go', 'pkg/proxy/topology.go'],
    },
    {
      id: 'node-object', zone: 'objects', code: 'NODE', name: 'Node (API)',
      summary: 'The API representation of a registered Node: capabilities, '
        + 'capacity, labels, and observed conditions. Scheduler decisions '
        + 'use this state; kubelet reports status through the API. A Pod’s '
        + 'spec.nodeName references this Node—it does not call the machine.',
      x: 14, y: 6.5, w: 4.2, d: 2.5, h: .8,
      files: ['staging/src/k8s.io/api/core/v1/types.go',
        'pkg/kubelet/kubelet_node_status.go', 'pkg/scheduler/eventhandlers.go'],
    },
    {
      id: 'deployment', zone: 'manager', code: 'D↻', name: 'Deployment loop',
      summary: 'Code running inside kube-controller-manager, not a separate '
        + 'service. Observes Deployment/ReplicaSet state, creates or scales '
        + 'ReplicaSets, and writes rollout status through the API. Work is '
        + 'queued, retried with backoff, and revisited as state changes.',
      x: 24, y: 3, w: 6.5, d: 2.4, h: 1.7,
      files: ['cmd/kube-controller-manager/app/apps.go',
        'pkg/controller/deployment/deployment_controller.go', 'pkg/controller/deployment/sync.go'],
    },
    {
      id: 'replicaset', zone: 'manager', code: 'R↻', name: 'ReplicaSet loop',
      summary: 'A separate loop within kube-controller-manager. Compares '
        + 'desired replicas to observed Pods, creates/deletes owned Pods '
        + 'through the API, and publishes replica/readiness status. Failed '
        + 'work is requeued; it never tells the scheduler or kubelet to run.',
      x: 24, y: 7, w: 6.5, d: 2.4, h: 1.7,
      files: ['cmd/kube-controller-manager/app/apps.go', 'pkg/controller/replicaset/replica_set.go',
        'pkg/controller/replicaset/replica_set_utils.go', 'pkg/controller/controller_utils.go'],
    },
    {
      id: 'endpointslice', zone: 'manager', code: 'E↻', name: 'EndpointSlice loop',
      summary: 'A kube-controller-manager loop watching Services, Pods, '
        + 'Nodes, and EndpointSlices. Matches the Service selector to '
        + 'same-namespace Pod labels and writes backend addresses/conditions through the API. '
        + 'Pod readiness changes trigger new reconciliation; failed writes '
        + 'are retried. It neither forwards traffic nor calls kube-proxy.',
      x: 24, y: 11, w: 6.5, d: 2.4, h: 1.7,
      files: ['cmd/kube-controller-manager/app/discovery.go',
        'pkg/controller/endpointslice/endpointslice_controller.go',
        'staging/src/k8s.io/endpointslice/reconciler.go'],
    },
    {
      id: 'scheduler', zone: 'control', code: 'S↻', name: 'kube-scheduler',
      summary: 'An independent API consumer outside controller-manager. '
        + 'Uses Pod and Node state to choose a feasible Node, then writes a '
        + 'Pod binding through the API (spec.nodeName). Failures update '
        + 'scheduling status and requeue eligible work. Binding is placement, '
        + 'not container execution, readiness, or a call to kubelet.',
      x: 25, y: 18, w: 5, d: 3, h: 2.8,
      files: ['pkg/scheduler/eventhandlers.go', 'pkg/scheduler/schedule_one.go',
        'pkg/scheduler/framework/plugins/defaultbinder/default_binder.go',
        'pkg/registry/core/pod/storage/storage.go'],
    },
    ...workers.flatMap(workerNodes),
  ],

  // Prefixes distinguish API state, conceptual objects, calls, and packets.
  // A watch arrow follows the delivered state; its client initiated the watch.
  edges: [
    { id: 'write-apply', from: 'kubectl', to: 'apiserver', kind: 'control', label: 'apply Deployment + Service' },
    { id: 'persist', from: 'apiserver', to: 'etcd', kind: 'store', label: 'persist versioned API objects' },
    ...['deployment', 'replicaset', 'pod', 'service', 'slice', 'node'].map(id => ({
      id: `object-serve-${id}`, from: 'apiserver', to: `${id}-object`, kind: 'data', label: 'serves this API object type (conceptual)',
    })),
    { id: 'object-deployment-owns', from: 'deployment-object', to: 'replicaset-object', kind: 'data', label: 'owns ReplicaSets; not invocation' },
    { id: 'object-replicaset-owns', from: 'replicaset-object', to: 'pod-object', kind: 'data', label: 'owns Pods; not invocation' },
    { id: 'object-service-slices', from: 'service-object', to: 'slice-object', kind: 'data', label: 'selector + ports; owns generated slices' },
    { id: 'object-pod-slices', from: 'pod-object', to: 'slice-object', kind: 'data', label: 'matching labels + IPs + readiness conditions' },
    { id: 'object-assignment', from: 'pod-object', to: 'node-object', kind: 'data', label: 'spec.nodeName references chosen Node' },
    { id: 'watch-deployment', from: 'apiserver', to: 'deployment', kind: 'data', label: 'watch Deployment + ReplicaSet state' },
    { id: 'write-replicasets', from: 'deployment', to: 'apiserver', kind: 'control', label: 'create/scale ReplicaSets; rollout status' },
    { id: 'watch-replicaset', from: 'apiserver', to: 'replicaset', kind: 'data', label: 'watch ReplicaSets + Pods' },
    { id: 'write-pods', from: 'replicaset', to: 'apiserver', kind: 'control', label: 'create/delete owned Pods; replica status' },
    { id: 'watch-scheduling', from: 'apiserver', to: 'scheduler', kind: 'data', label: 'watch Pod + Node state' },
    { id: 'write-binding', from: 'scheduler', to: 'apiserver', kind: 'control', label: 'Pod binding → spec.nodeName; scheduling status' },
    { id: 'watch-backends', from: 'apiserver', to: 'endpointslice', kind: 'data', label: 'watch Service + Pod + Node + EndpointSlice state' },
    { id: 'write-slices', from: 'endpointslice', to: 'apiserver', kind: 'control', label: 'publish backend addresses + conditions' },
    ...workers.flatMap(workerEdges),
    { id: 'packet-request', from: 'workload-a', to: 'dataplane-a', kind: 'data', label: 'request to Service address; select backend + DNAT' },
    { id: 'packet-cross-node', from: 'dataplane-a', to: 'dataplane-b', kind: 'data', label: 'provider-specific transport to backend Pod IP' },
    { id: 'packet-deliver', from: 'dataplane-b', to: 'workload-b', kind: 'data', label: 'deliver to backend; no second Service selection' },
  ],

  // One successful convergence story, not a transaction or synchronous pipeline.
  // Worker A is already running; B illustrates a newly started Service backend.
  flow: [
    ['write-apply', '1. kubectl applies a Deployment and selector-based Service. Independent loops take it from here.'],
    ['persist', '2. The API validates and persists shared objects through its etcd3 adapter. No controller accesses etcd directly.'],
    ['watch-deployment', '3. The Deployment loop observes changed API state, using its informer cache.'],
    ['write-replicasets', '4. It creates or scales an owned ReplicaSet through the API and reports rollout status.'],
    ['watch-replicaset', '5. The independent ReplicaSet loop observes desired replicas and the Pods that already exist.'],
    ['write-pods', '6. It creates missing owned Pods through the API. Ownership is metadata, not a controller-to-controller call.'],
    ['watch-scheduling', '7. The scheduler observes unassigned Pods and Node state; assigned Pods also inform resource accounting.'],
    ['write-binding', '8. A binding records the chosen Node in Pod.spec.nodeName. Here it is B; spreading replicas is not guaranteed.'],
    ['watch-bound-b', '9. Worker B’s kubelet watches its assigned Pods and begins local reconciliation.'],
    ['invoke-cri-b', '10. Kubelet asks its external CRI runtime to reconcile the sandbox and containers.'],
    ['invoke-cni-b', '11. In this representative Linux path, the runtime invokes a CNI plugin to configure sandbox networking.'],
    ['program-network-b', '12. CNI configures Pod connectivity. Its executable is a configuration step, never an application packet hop.'],
    ['invoke-run-b', '13. The runtime starts workload B’s containers in the sandbox. Running does not yet mean Ready.'],
    ['invoke-observe-b', '14. Runtime observations return to kubelet; its local Pod workers resync and retry as needed.'],
    ['write-status-b', '15. Kubelet publishes observed Pod readiness/status and Node status through the API. These updates close the feedback loop.'],
    ['watch-backends', '16. The EndpointSlice loop observes the Service selector and matching Pod labels, addresses, and conditions.'],
    ['write-slices', '17. It publishes EndpointSlice objects. Not-ready addresses may remain; conditions and Service settings govern eligibility.'],
    ['watch-service-a', '18. Worker A’s kube-proxy independently watches Services and EndpointSlices through the API.'],
    ['watch-service-b', '19. Worker B has its own watcher and forwarding state; there is no single central packet proxy.'],
    ['program-service-a', '20. Proxy A reconciles local iptables Service rules. Failed updates are retried locally.'],
    ['program-service-b', '21. Proxy B maintains its own Service rules too. Neither proxy carries the application request.'],
    ['packet-request', '22. An already-running workload A sends to the Service address. A’s dataplane selects B’s backend and translates the destination.'],
    ['packet-cross-node', '23. The network carries the packet to B using its backend Pod IP. The transport is provider-specific and policy must allow it.'],
    ['packet-deliver', '24. B delivers to the backend without another Service selection. API state and local loops continue converging as the cluster changes.'],
  ],
};
