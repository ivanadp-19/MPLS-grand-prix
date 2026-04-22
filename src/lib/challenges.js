import {
  BASE_TOPOLOGY,
  getNeighbors,
  getMplsNeighbors,
  getRole,
  getType,
  deviceCategory,
} from './topology.js';

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);
const uniqueArr = (arr) => [...new Set(arr)];

// Challenge types, weighted so that the rubric criteria all get hit across a
// normal 10-round game:
//   equipment (criterio 1): EQUIPMENT_WHICH, ROUTER_ROLE
//   roles (criterio 2):     ROUTER_ROLE, LDP_PURPOSE
//   PUSH/SWAP/POP (c. 3):   OPERATION, FLOW_SEQUENCE
//   LDP function (c. 4):    LDP_DIRECTION, LDP_FIRST, LDP_PURPOSE, LABEL_VALUE
//   routing (bonus):        NEXT_HOP, LFIB_LOOKUP
export const CHALLENGE_TYPES = [
  'NEXT_HOP',
  'OPERATION',
  'ROUTER_ROLE',
  'LABEL_VALUE',
  'LFIB_LOOKUP',
  'FLOW_SEQUENCE',
  'EQUIPMENT_WHICH',
  'LDP_DIRECTION',
  'LDP_FIRST',
  'LDP_PURPOSE',
];

// forcedType lets the engine use a shuffled deck so no type repeats before
// all have been seen. Falls back to pure random if omitted.
export function generateChallenge(forcedType) {
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

  const challengeType = forcedType && CHALLENGE_TYPES.includes(forcedType)
    ? forcedType
    : pick(CHALLENGE_TYPES);
  const challenge = { type: challengeType, topo, lsp, path };

  // ---- Rubric 3: PUSH / SWAP / POP on a specific router ----
  if (challengeType === 'OPERATION') {
    const hop = pick(lsp);
    challenge.question = `Un paquete pasa por el router <code>${hop.node}</code> (rol: <b>${getRole(hop.node)}</b>). ¿Qué operación MPLS realiza sobre la etiqueta?`;
    challenge.correctAnswer = hop.op;
    challenge.options = shuffle(['PUSH', 'SWAP', 'POP', 'NO-OP']);
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Operación MPLS';

  // ---- Rubric 3: PUSH / SWAP / POP — full flow sequence ----
  } else if (challengeType === 'FLOW_SEQUENCE') {
    const opsStr = lsp.map((h) => h.op).join(' → ');   // "PUSH → SWAP → SWAP → POP"
    const distractors = shuffle([
      'PUSH → PUSH → POP → POP',
      'SWAP → PUSH → SWAP → POP',
      'PUSH → POP → SWAP → SWAP',
      'PUSH → SWAP → POP → SWAP',
      'POP → SWAP → SWAP → PUSH',
    ]).slice(0, 3);
    challenge.question = `Un paquete viaja desde <code>CE1</code> (cliente) hacia <code>CE2</code> cruzando el LSP <code>${path.join(' → ')}</code>. ¿Cuál es la secuencia correcta de operaciones MPLS aplicadas a la etiqueta a lo largo del camino?`;
    challenge.correctAnswer = opsStr;
    challenge.options = shuffle(uniqueArr([opsStr, ...distractors]));
    challenge.label = 'Reto: Flujo PUSH → SWAP → POP';
    challenge.highlightNode = null;

  // ---- Rubric 1 + 2: Role / device category ----
  } else if (challengeType === 'ROUTER_ROLE') {
    const node = pick(topo.nodes);
    challenge.question = `Observa el router <code>${node.id}</code> destacado. ¿Cuál es su rol en la red MPLS?`;
    challenge.correctAnswer = deviceCategory(node.id);
    challenge.options = shuffle([
      'CE (Customer Edge)',
      'LER (Provider Edge)',
      'LSR (Provider core)',
      'Route Reflector',
    ]);
    challenge.highlightNode = node.id;
    challenge.label = 'Reto: Rol del Router';

  // ---- Rubric 1: Which of these equipos participates (or doesn't) in MPLS ----
  } else if (challengeType === 'EQUIPMENT_WHICH') {
    // Ask which of a shuffled subset is a specific category — randomize which.
    const askCategory = pick(['CE (Customer Edge)', 'LER (Provider Edge)', 'LSR (Provider core)']);
    const matchingIds = topo.nodes.filter((n) => deviceCategory(n.id) === askCategory).map((n) => n.id);
    const correctAnswer = pick(matchingIds);
    const nonMatching = topo.nodes.filter((n) => !matchingIds.includes(n.id)).map((n) => n.id);
    const options = shuffle([correctAnswer, ...shuffle(nonMatching).slice(0, 3)]);
    challenge.question = `De los equipos de esta red, ¿cuál es un <b>${askCategory}</b>?`;
    challenge.correctAnswer = correctAnswer;
    challenge.options = uniqueArr(options);
    challenge.highlightNode = null;
    challenge.label = 'Reto: Equipos MPLS';

  // ---- Rubric 4: LDP direction of label distribution ----
  } else if (challengeType === 'LDP_DIRECTION') {
    challenge.question = 'En LDP (<i>Label Distribution Protocol</i>), ¿en qué dirección se propagan las asignaciones de etiqueta para una FEC?';
    challenge.correctAnswer = 'Downstream → Upstream (del egress hacia el ingress)';
    challenge.options = shuffle([
      'Downstream → Upstream (del egress hacia el ingress)',
      'Upstream → Downstream (del ingress hacia el egress)',
      'Bidireccional simultánea',
      'Solo en el router donde se origina el tráfico',
    ]);
    challenge.highlightNode = null;
    challenge.label = 'Reto: LDP — dirección';

  // ---- Rubric 4: Which router initiates the LDP label advertisement ----
  } else if (challengeType === 'LDP_FIRST') {
    challenge.question = 'Para construir el LSP hacia una FEC específica, ¿qué router <b>anuncia primero</b> la etiqueta asociada a esa FEC mediante LDP?';
    challenge.correctAnswer = 'El LER de egreso (PE2)';
    challenge.options = shuffle([
      'El LER de egreso (PE2)',
      'El LER de ingreso (PE1)',
      'Cualquier LSR interno (P1/P2/P3)',
      'El CE de origen (CE1)',
    ]);
    challenge.highlightNode = 'PE2';
    challenge.label = 'Reto: LDP — quién arranca';

  // ---- Rubric 2 + 4: What LDP actually does ----
  } else if (challengeType === 'LDP_PURPOSE') {
    challenge.question = '¿Cuál es la función principal del protocolo <code>LDP</code> en una red MPLS?';
    challenge.correctAnswer = 'Distribuir asignaciones de etiquetas (label bindings) entre routers';
    challenge.options = shuffle([
      'Distribuir asignaciones de etiquetas (label bindings) entre routers',
      'Calcular rutas IP más cortas (como OSPF)',
      'Negociar QoS y ancho de banda entre dominios',
      'Autenticar clientes antes de permitir tráfico MPLS',
    ]);
    challenge.highlightNode = null;
    challenge.label = 'Reto: LDP — función';

  // ---- Rubric 4 (concrete label assigned by LDP) ----
  } else if (challengeType === 'LABEL_VALUE') {
    const hop = lsp.find((h) => h.op === 'SWAP');
    challenge.question = `En el router <code>${hop.node}</code> llega un paquete con etiqueta <code>${hop.inLabel}</code>. Según la LFIB (construida por LDP), ¿qué etiqueta debe reenviar al siguiente salto?`;
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

  // ---- Next-hop along the LSP (MPLS-only neighbors) ----
  } else if (challengeType === 'NEXT_HOP') {
    const hop = pick(lsp.filter((h) => h.nextHop));
    challenge.question = `Un paquete con etiqueta MPLS <code>${hop.inLabel || '(IP puro, aún sin label)'}</code> llega al router <code>${hop.node}</code>. ¿Cuál es el siguiente salto en el LSP?`;
    challenge.correctAnswer = hop.nextHop;
    const neighbors = getMplsNeighbors(topo, hop.node);
    challenge.options = neighbors.slice();
    if (!challenge.options.includes(hop.nextHop)) challenge.options.push(hop.nextHop);
    if (challenge.options.length < 2) challenge.options.push('PE2');
    challenge.options = shuffle(uniqueArr(challenge.options));
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Siguiente Salto';

  // ---- LFIB lookup (exit interface / neighbor) ----
  } else if (challengeType === 'LFIB_LOOKUP') {
    const hop = lsp.find((h) => h.op === 'SWAP');
    challenge.question = `LFIB de <code>${hop.node}</code>: entrada <code>${hop.inLabel}</code> → salida <code>${hop.outLabel}</code>. Si llega un paquete con label <code>${hop.inLabel}</code>, ¿por qué vecino se reenvía?`;
    challenge.correctAnswer = hop.nextHop;
    const neighbors = getMplsNeighbors(topo, hop.node);
    challenge.options = shuffle(uniqueArr([...neighbors, hop.nextHop]));
    challenge.highlightNode = hop.node;
    challenge.label = 'Reto: Consulta LFIB';
  }

  // Visual: highlight the LSP edges and label them with LDP-assigned values.
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

// Contextual explanation per challenge type — reinforces the learning goal
// covered by that question so the rubric coverage sticks even on wrong answers.
export function buildExplanation(ch) {
  const path = ch.path.join(' → ');
  const base = `
    <h4>Solución</h4>
    <p>LSP de esta ronda: <code>${path}</code></p>
    <p><b>Respuesta correcta:</b> <code>${ch.correctAnswer}</code></p>
  `;

  let note = '';
  switch (ch.type) {
    case 'OPERATION':
    case 'FLOW_SEQUENCE':
      note = 'Flujo estándar: <b>PUSH</b> en el LER de ingreso (añade la etiqueta), <b>SWAP</b> en cada LSR del core (cambia la etiqueta según su LFIB), y <b>POP</b> en el LER de egreso (retira la etiqueta antes de entregar el paquete IP al CE de destino).';
      break;
    case 'ROUTER_ROLE':
    case 'EQUIPMENT_WHICH':
      note = 'Los equipos que participan en MPLS son: <b>CE</b> (cliente, IP puro, no hace switching MPLS), <b>LER/PE</b> en el borde del provider (PUSH/POP), y <b>LSR/P</b> en el core (solo SWAP). En nuestra topología: CE1/CE2 = CE · PE1/PE2 = LER · P1/P2/P3 = LSR.';
      break;
    case 'LDP_DIRECTION':
      note = 'LDP distribuye bindings <b>downstream → upstream</b>: el router más cercano al destino (el egreso) anuncia primero qué etiqueta espera recibir, y esa información se propaga hacia atrás saltando de vecino a vecino hasta el ingreso.';
      break;
    case 'LDP_FIRST':
      note = 'El <b>LER de egreso</b> (PE2) es quien arranca: anuncia el label binding para la FEC destino. Cada router aguas arriba recibe ese anuncio y asigna su propio label local para esa FEC antes de anunciarlo al siguiente upstream.';
      break;
    case 'LDP_PURPOSE':
      note = 'LDP (<i>Label Distribution Protocol</i>) se encarga <b>únicamente</b> de distribuir las asignaciones de etiquetas (label bindings) entre routers MPLS para construir las LFIBs. No calcula rutas (eso lo hace el IGP como OSPF/IS-IS), no negocia QoS, no autentica clientes.';
      break;
    case 'LABEL_VALUE':
    case 'LFIB_LOOKUP':
      note = 'La <b>LFIB</b> (Label Forwarding Information Base) se construye a partir de los bindings que LDP distribuye. Cada entrada dice: <i>si llega label X → aplica esta operación → envía al vecino Y con label Z</i>.';
      break;
    default:
      note = 'El LER de ingreso hace <code>PUSH</code>, los LSRs hacen <code>SWAP</code>, y el LER de egreso hace <code>POP</code>.';
  }

  return `${base}<p style="margin-top:8px; font-size:0.9rem;">${note}</p>`;
}
