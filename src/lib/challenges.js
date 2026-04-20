import { BASE_TOPOLOGY, getNeighbors, getRole } from './topology.js';

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
const uniqueArr = (arr) => [...new Set(arr)];

export function generateChallenge() {
  const topo = JSON.parse(JSON.stringify(BASE_TOPOLOGY));

  const takenLabels = new Set();
  const newLabel = () => {
    let l;
    do { l = randInt(16, 99); } while (takenLabels.has(l));
    takenLabels.add(l);
    return l;
  };

  const useUpperPath = Math.random() < 0.5;
  const path = useUpperPath ? ['PE1', 'P1', 'P3', 'PE2'] : ['PE1', 'P2', 'P3', 'PE2'];

  const inLabelAtPE2 = newLabel();
  const inLabelAtP3 = newLabel();
  const inLabelAtMiddleP = newLabel();

  const lsp = [
    { node: 'PE1',   op: 'PUSH', outLabel: inLabelAtMiddleP, nextHop: path[1] },
    { node: path[1], op: 'SWAP', inLabel: inLabelAtMiddleP, outLabel: inLabelAtP3,  nextHop: 'P3' },
    { node: 'P3',    op: 'SWAP', inLabel: inLabelAtP3,      outLabel: inLabelAtPE2, nextHop: 'PE2' },
    { node: 'PE2',   op: 'POP',  inLabel: inLabelAtPE2 },
  ];

  const challengeType = pick(['NEXT_HOP', 'OPERATION', 'ROUTER_ROLE', 'LABEL_VALUE', 'LFIB_LOOKUP']);
  const challenge = { type: challengeType, topo, lsp, path };

  if (challengeType === 'NEXT_HOP') {
    const hop = pick(lsp.filter((h) => h.nextHop));
    challenge.question = `Un paquete con etiqueta MPLS <code>${hop.inLabel || '(IP puro)'}</code> llega al router <code>${hop.node}</code>. ¿Cuál es el siguiente salto en el LSP?`;
    challenge.correctAnswer = hop.nextHop;
    const neighbors = getNeighbors(topo, hop.node);
    challenge.options = neighbors;
    if (neighbors.length < 2) challenge.options.push('PE2');
    challenge.options = shuffle(uniqueArr(challenge.options));
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Siguiente Salto';
  } else if (challengeType === 'OPERATION') {
    const hop = pick(lsp);
    challenge.question = `Un paquete pasa por el router <code>${hop.node}</code> (rol: <b>${getRole(hop.node)}</b>). ¿Qué operación MPLS realiza sobre la etiqueta?`;
    challenge.correctAnswer = hop.op;
    challenge.options = shuffle(['PUSH', 'SWAP', 'POP', 'NO-OP']);
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Operación MPLS';
  } else if (challengeType === 'ROUTER_ROLE') {
    const node = pick(topo.nodes);
    challenge.question = `Observa el router <code>${node.id}</code> destacado. ¿Cuál es su rol en la red MPLS?`;
    challenge.correctAnswer = node.type === 'edge' ? 'LER (PE)' : 'LSR (P)';
    challenge.options = shuffle(['LER (PE)', 'LSR (P)', 'CE (Customer Edge)', 'Route Reflector']);
    challenge.highlightNode = node.id;
    challenge.label = 'Reto: Rol del Router';
  } else if (challengeType === 'LABEL_VALUE') {
    const hop = lsp.find((h) => h.op === 'SWAP');
    challenge.question = `En el router <code>${hop.node}</code>, llega un paquete con etiqueta <code>${hop.inLabel}</code>. Según la LFIB asignada por LDP, ¿qué etiqueta debe reenviar al siguiente salto?`;
    challenge.correctAnswer = String(hop.outLabel);
    const distractors = new Set();
    while (distractors.size < 3) {
      const d = randInt(16, 99);
      if (d !== hop.outLabel && d !== hop.inLabel) distractors.add(String(d));
    }
    challenge.options = shuffle([String(hop.outLabel), ...distractors]);
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Etiqueta de Salida (LDP)';
    challenge.showLFIB = hop.node;
  } else if (challengeType === 'LFIB_LOOKUP') {
    const hop = lsp.find((h) => h.op === 'SWAP');
    challenge.question = `LFIB de <code>${hop.node}</code>: entrada <code>${hop.inLabel}</code> → salida <code>${hop.outLabel}</code>. Si llega un paquete con label <code>${hop.inLabel}</code>, ¿por qué interfaz (vecino) se reenvía?`;
    challenge.correctAnswer = hop.nextHop;
    const neighbors = getNeighbors(topo, hop.node);
    challenge.options = shuffle(neighbors);
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Consulta LFIB';
  }

  challenge.activeEdges = [];
  for (let i = 0; i < path.length - 1; i++) {
    challenge.activeEdges.push([path[i], path[i + 1]]);
  }
  challenge.edgeLabels = {};
  challenge.edgeLabels[path[0] + '-' + path[1]] = 'L=' + inLabelAtMiddleP;
  challenge.edgeLabels[path[1] + '-' + path[2]] = 'L=' + inLabelAtP3;
  challenge.edgeLabels[path[2] + '-' + path[3]] = 'L=' + inLabelAtPE2;

  return challenge;
}

export function buildExplanation(ch) {
  const path = ch.path.join(' → ');
  return `<h4>Solución</h4>
    <p>LSP de esta ronda: <code>${path}</code></p>
    <p><b>Respuesta correcta:</b> <code>${ch.correctAnswer}</code></p>
    <p style="margin-top:8px; font-size:0.85rem;">Recuerda: el LER de ingreso hace <code>PUSH</code>, los LSRs hacen <code>SWAP</code>, y el LER de egreso hace <code>POP</code> (o PHP en el penúltimo salto).</p>`;
}
