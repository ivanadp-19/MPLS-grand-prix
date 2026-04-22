// MPLS network topology used by every round. Fixed layout; labels are
// randomized per round in challenges.js.
//
//         P1
//       /    \
//   PE1        P3 -- PE2
//       \    /
//         P2

export const BASE_TOPOLOGY = {
  nodes: [
    { id: 'PE1', role: 'LER (ingress)', type: 'edge', x: 60,  y: 160 },
    { id: 'P1',  role: 'LSR',           type: 'core', x: 200, y: 80  },
    { id: 'P2',  role: 'LSR',           type: 'core', x: 200, y: 240 },
    { id: 'P3',  role: 'LSR',           type: 'core', x: 400, y: 160 },
    { id: 'PE2', role: 'LER (egress)',  type: 'edge', x: 540, y: 160 },
  ],
  edges: [
    ['PE1', 'P1'], ['PE1', 'P2'], ['P1', 'P3'], ['P2', 'P3'], ['P3', 'PE2'],
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

export function getRole(nodeId) {
  const n = BASE_TOPOLOGY.nodes.find((x) => x.id === nodeId);
  return n ? n.role : '';
}
