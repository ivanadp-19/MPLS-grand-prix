// MPLS network topology used by every round. Fixed layout; labels are
// randomized per round in challenges.js.
//
//   CE1 -- PE1 == P1 ==\
//                       P3 -- PE2 -- CE2
//                P2 ==/
//
// CEs (Customer Edge) are plain IP routers — they DO NOT participate in
// MPLS switching and have no LFIB. PE1/PE2 are LERs (ingress / egress).
// P1/P2/P3 are LSRs (core). Drawn in viewBox "0 0 720 320".

export const BASE_TOPOLOGY = {
  nodes: [
    { id: 'CE1', role: 'CE (customer)',   type: 'customer', x: 30,  y: 160 },
    { id: 'PE1', role: 'LER (ingress)',   type: 'edge',     x: 150, y: 160 },
    { id: 'P1',  role: 'LSR',             type: 'core',     x: 300, y: 80  },
    { id: 'P2',  role: 'LSR',             type: 'core',     x: 300, y: 240 },
    { id: 'P3',  role: 'LSR',             type: 'core',     x: 470, y: 160 },
    { id: 'PE2', role: 'LER (egress)',    type: 'edge',     x: 590, y: 160 },
    { id: 'CE2', role: 'CE (customer)',   type: 'customer', x: 690, y: 160 },
  ],
  edges: [
    ['CE1', 'PE1'],
    ['PE1', 'P1'], ['PE1', 'P2'],
    ['P1', 'P3'], ['P2', 'P3'],
    ['P3', 'PE2'],
    ['PE2', 'CE2'],
  ],
};

export function getNeighbors(topo, nodeId) {
  const ns = new Set();
  topo.edges.forEach((e) => {
    if (e[0] === nodeId) ns.add(e[1]);
    if (e[1] === nodeId) ns.add(e[0]);
  });
  return [...ns];
}

// Same as getNeighbors but filters out customer (CE) routers — used by
// challenges that only care about MPLS next-hops.
export function getMplsNeighbors(topo, nodeId) {
  return getNeighbors(topo, nodeId).filter((id) => {
    const n = topo.nodes.find((x) => x.id === id);
    return n && n.type !== 'customer';
  });
}

export function getRole(nodeId) {
  const n = BASE_TOPOLOGY.nodes.find((x) => x.id === nodeId);
  return n ? n.role : '';
}

export function getType(nodeId) {
  const n = BASE_TOPOLOGY.nodes.find((x) => x.id === nodeId);
  return n ? n.type : '';
}

// Category label used by equipment-ID challenges.
export function deviceCategory(nodeId) {
  const t = getType(nodeId);
  if (t === 'customer') return 'CE (Customer Edge)';
  if (t === 'edge')     return 'LER (Provider Edge)';
  if (t === 'core')     return 'LSR (Provider core)';
  return '';
}
