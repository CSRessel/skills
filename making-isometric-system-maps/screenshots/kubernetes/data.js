export default {
  title: 'Kubernetes',
  subtitle: 'A Deployment and a Service · source e72c2715ade3',
  theme: 'paper',

  // Regions group responsibilities, not machines. Reconciliation and endpoint
  // publication are controller-manager loops; node agents repeat on each Node.
  zones: [
    { id: 'intent', label: 'DECLARE INTENT', x: 0, y: 0, w: 7, d: 7 },
    { id: 'state', label: 'API & SHARED STATE', x: 9, y: 4, w: 13, d: 12 },
    { id: 'control', label: 'RECONCILE & PLACE', x: 25, y: 7, w: 15, d: 13 },
    { id: 'node', label: 'EXECUTE ON NODES', x: 26, y: 23, w: 17, d: 13 },
    { id: 'network', label: 'DELIVER SERVICE TRAFFIC', x: 8, y: 23, w: 15, d: 13 },
  ],

  nodes: [
    {
      id: 'kubectl', zone: 'intent', code: 'K', name: 'kubectl',
      summary: 'Applies a desired Deployment and a selector-based Service to the '
        + 'API. Follow one successful path: create Pods, choose a Node, run '
        + 'containers, then program Service forwarding. In a real cluster, '
        + 'these independent reconciliation loops keep repeating.',
      x: 2, y: 2, w: 3, d: 3, h: 2.2,
      files: ['staging/src/k8s.io/kubectl/pkg/cmd/apply/apply.go'],
    },
    {
      id: 'apiserver', zone: 'state', code: 'A', name: 'kube-apiserver',
      summary: 'The shared REST and watch front door. Authenticates and '
        + 'authorizes requests, runs admission on writes, and stores API '
        + 'objects. Controllers, scheduler, kubelet, and kube-proxy communicate '
        + 'through this API—not directly with etcd.',
      x: 11, y: 10, w: 4, d: 4, h: 4.3,
      files: [
        'cmd/kube-apiserver/app/server.go',
        'staging/src/k8s.io/apiserver/pkg/server/config.go',
        'staging/src/k8s.io/apiserver/pkg/endpoints/handlers/create.go',
      ],
    },
    {
      id: 'etcd', zone: 'state', code: 'E', name: 'etcd', shape: 'cylinder',
      summary: 'External key-value store behind the API server’s etcd3 '
        + 'storage adapter. Persists cluster API objects and their versions. '
        + 'This is shared cluster state, not a Pod log or container-image store; '
        + 'the paths below are Kubernetes’ integration, not etcd internals.',
      x: 17, y: 6, w: 3.5, d: 3.5, h: 2.7,
      files: [
        'staging/src/k8s.io/apiserver/pkg/storage/storagebackend/factory/etcd3.go',
        'staging/src/k8s.io/apiserver/pkg/storage/etcd3/store.go',
      ],
    },
    {
      id: 'deployment', zone: 'control', code: 'D', name: 'Deployment loop',
      summary: 'A loop in kube-controller-manager. Watches Deployments and '
        + 'ReplicaSets, creates an owned ReplicaSet from the Pod template, '
        + 'and scales old and new sets according to rollout policy. '
        + 'Its writes return through the API; it does not call the next controller.',
      x: 27, y: 9, w: 4, d: 3, h: 2.1,
      files: [
        'pkg/controller/deployment/deployment_controller.go',
        'pkg/controller/deployment/sync.go',
      ],
    },
    {
      id: 'replicaset', zone: 'control', code: 'R', name: 'ReplicaSet loop',
      summary: 'Another kube-controller-manager loop. Compares the requested '
        + 'replica count with cached active Pods, then creates or deletes '
        + 'owned Pods through the API. Maintaining a replica count is distinct '
        + 'from choosing where those Pods run.',
      x: 34, y: 9, w: 4, d: 3, h: 2.1,
      files: [
        'pkg/controller/replicaset/replica_set.go',
        'pkg/controller/controller_utils.go',
      ],
    },
    {
      id: 'scheduler', zone: 'control', code: 'S', name: 'kube-scheduler',
      summary: 'Watches unassigned Pods and Node state. The scheduling '
        + 'framework filters and scores feasible Nodes; binding records the '
        + 'chosen Node through the API. A successful binding means placement, '
        + 'not container execution or readiness.',
      x: 30, y: 15, w: 4, d: 3, h: 3.2,
      files: [
        'pkg/scheduler/eventhandlers.go',
        'pkg/scheduler/schedule_one.go',
        'pkg/scheduler/framework/plugins/defaultbinder/default_binder.go',
      ],
    },
    {
      id: 'kubelet', zone: 'node', code: 'L', name: 'kubelet',
      summary: 'Per-node agent. Watches Pods assigned to its Node and '
        + 'reconciles them locally: performs admission, prepares volumes, '
        + 'and calls the runtime through CRI. Reports observed Pod status '
        + 'back to the API so other loops can react.',
      x: 28, y: 25, w: 4, d: 3, h: 3.1,
      files: [
        'pkg/kubelet/config/apiserver.go',
        'pkg/kubelet/kubelet.go',
        'pkg/kubelet/status/status_manager.go',
      ],
    },
    {
      id: 'runtime', zone: 'node', code: 'C', name: 'CRI runtime',
      summary: 'External runtime process reached through kubelet’s CRI '
        + 'client. Creates Pod sandboxes and starts or stops containers. '
        + 'Kubernetes defines the protocol and integration here; concrete '
        + 'runtime and network-plugin internals are outside this map.',
      x: 36, y: 25, w: 4, d: 3, h: 2.3,
      files: [
        'staging/src/k8s.io/cri-api/pkg/apis/runtime/v1/api.proto',
        'pkg/kubelet/kuberuntime/kuberuntime_sandbox.go',
        'pkg/kubelet/kuberuntime/kuberuntime_container.go',
      ],
    },
    {
      id: 'pods', zone: 'node', code: 'P', name: 'application Pods',
      shape: 'repeat', count: 3,
      summary: 'Application Pod replicas, launched into runtime sandboxes. '
        + 'Repeated blocks indicate replicas, not a guaranteed count of three. '
        + 'A running Pod is not necessarily Ready; readiness reported by '
        + 'kubelet influences ordinary Service endpoint selection.',
      x: 33, y: 32, w: 8, d: 2.5, h: 1.8,
      files: [
        'staging/src/k8s.io/api/core/v1/types.go',
        'pkg/kubelet/kuberuntime/kuberuntime_manager.go',
        'staging/src/k8s.io/endpointslice/utils.go',
      ],
    },
    {
      id: 'endpointslice', zone: 'network', code: 'EΣ', name: 'EndpointSlice loop',
      summary: 'A kube-controller-manager loop that watches Services, Pods, '
        + 'Nodes, and EndpointSlices. For selector-based Services, derives '
        + 'backend addresses and conditions, then publishes EndpointSlice '
        + 'objects. Selectorless and ExternalName Services take other paths.',
      x: 10, y: 25, w: 4, d: 3, h: 2.1,
      files: [
        'pkg/controller/endpointslice/endpointslice_controller.go',
        'staging/src/k8s.io/endpointslice/reconciler.go',
      ],
    },
    {
      id: 'proxy', zone: 'network', code: 'X', name: 'kube-proxy',
      summary: 'Watches Service and EndpointSlice API updates on each Node '
        + 'and reconciles local forwarding state. Application packets do not '
        + 'pass through this process. This is the in-tree kube-proxy path; '
        + 'clusters can use replacement dataplanes.',
      x: 17, y: 25, w: 4, d: 3, h: 2.3,
      files: [
        'cmd/kube-proxy/app/server.go',
        'pkg/proxy/config/config.go',
        'pkg/proxy/iptables/proxier.go',
      ],
    },
    {
      id: 'forwarding', zone: 'network', code: 'F', name: 'Service forwarding',
      shape: 'slab',
      summary: 'Host packet-forwarding rules programmed by kube-proxy. '
        + 'The verified iptables example selects a backend and translates '
        + 'Service traffic to its IP and port. Packet traffic bypasses the '
        + 'API server; cross-node network plumbing is outside this map.',
      x: 13, y: 32, w: 7, d: 2.5, h: .6,
      files: [
        'pkg/proxy/iptables/proxier.go',
        'pkg/util/iptables/iptables.go',
      ],
    },
  ],

  // Direction follows the named transfer: watches carry state out of the API;
  // reconciliation writes return to it. These are not direct controller calls.
  edges: [
    { id: 'apply', from: 'kubectl', to: 'apiserver', kind: 'data', label: 'apply Deployment + Service' },
    { id: 'persist', from: 'apiserver', to: 'etcd', kind: 'store', label: 'persist versioned API objects' },
    { id: 'watch-deployment', from: 'apiserver', to: 'deployment', kind: 'data', label: 'Deployment + ReplicaSet watches' },
    { id: 'write-replicaset', from: 'deployment', to: 'apiserver', kind: 'control', label: 'create or scale ReplicaSets' },
    { id: 'watch-replicaset', from: 'apiserver', to: 'replicaset', kind: 'data', label: 'ReplicaSet + Pod watches' },
    { id: 'write-pods', from: 'replicaset', to: 'apiserver', kind: 'control', label: 'create or delete owned Pods' },
    { id: 'watch-unassigned', from: 'apiserver', to: 'scheduler', kind: 'data', label: 'unassigned Pods + Node state' },
    { id: 'bind', from: 'scheduler', to: 'apiserver', kind: 'control', label: 'bind Pod to a chosen Node' },
    { id: 'watch-assigned', from: 'apiserver', to: 'kubelet', kind: 'data', label: 'Pods assigned to this Node' },
    { id: 'cri', from: 'kubelet', to: 'runtime', kind: 'control', label: 'CRI sandbox + container RPCs' },
    { id: 'run', from: 'runtime', to: 'pods', kind: 'control', label: 'create sandboxes; start containers' },
    { id: 'status', from: 'kubelet', to: 'apiserver', kind: 'data', label: 'report observed Pod status' },
    { id: 'watch-backends', from: 'apiserver', to: 'endpointslice', kind: 'data', label: 'Services + Pods + Nodes + EndpointSlices' },
    { id: 'write-slices', from: 'endpointslice', to: 'apiserver', kind: 'control', label: 'publish backend addresses + conditions' },
    { id: 'watch-routing', from: 'apiserver', to: 'proxy', kind: 'data', label: 'Service + EndpointSlice watches' },
    { id: 'program', from: 'proxy', to: 'forwarding', kind: 'control', label: 'reconcile host forwarding rules' },
    { id: 'serve', from: 'forwarding', to: 'pods', kind: 'data', label: 'Service traffic → backend IP:port' },
  ],

  // A successful narrative across asynchronous loops, not a transaction or
  // a claim that every production cluster uses this runtime/network path.
  flow: [
    ['apply', '1. Declare intent: kubectl applies a Deployment and a selector-based Service.'],
    ['persist', '2. The API validates the write and persists versioned objects through its etcd3 adapter.'],
    ['watch-deployment', '3. An API watch informs the Deployment controller that desired state has changed.'],
    ['write-replicaset', '4. The Deployment loop creates or scales an owned ReplicaSet through the API.'],
    ['watch-replicaset', '5. A separate ReplicaSet loop observes the requested replica count and current Pods.'],
    ['write-pods', '6. That loop creates the missing Pods through the API. They do not have Nodes yet.'],
    ['watch-unassigned', '7. The scheduler observes unassigned Pods and the available Node state.'],
    ['bind', '8. After filtering and scoring Nodes, the scheduler writes a binding for the chosen Node.'],
    ['watch-assigned', '9. The selected Node’s kubelet sees the assignment. Placement now becomes local reconciliation.'],
    ['cri', '10. Kubelet prepares the Pod and asks the external runtime for sandboxes and containers through CRI.'],
    ['run', '11. The runtime starts application containers. Running and Ready are separate states.'],
    ['status', '12. Kubelet reports observed Pod status to the API; this is feedback, not a one-way pipeline.'],
    ['watch-backends', '13. The EndpointSlice loop observes the Service selector and matching Pods, including their conditions.'],
    ['write-slices', '14. It publishes backend addresses and conditions as EndpointSlice API objects.'],
    ['watch-routing', '15. Kube-proxy observes Services and EndpointSlices independently of kubelet.'],
    ['program', '16. Kube-proxy reconciles host rules. The source-backed example here is Linux iptables.'],
    ['serve', '17. Host rules send Service traffic to a backend Pod. The packet path does not traverse the API server.'],
  ],
};
