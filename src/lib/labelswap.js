// Label Swap game constants and pure helpers. Keep free of Svelte /
// transport imports — this module is reused by both host-side game logic
// and the renderless reveal phase.

export const ANIMAL_POOL = [
  'Falcon', 'Iguana', 'Otter', 'Lynx', 'Raven',
  'Hawk', 'Viper', 'Mantis', 'Wolverine', 'Octopus',
];

export const DEFAULT_CONFIG = {
  overflowThreshold: 3,
  routeTimeMs: 20000,
  challengeTimeMs: 5000,
  swapChoiceTimeMs: 5000,
  revealMs: 10000,
  resolveDelayMs: 3000,
};

export const SEVERITY = {
  OK: 'ok',
  DROP: 'drop',
  INTERCEPT: 'intercept',
  FALSE_INTERCEPT: 'false-intercept',
  TIMEOUT: 'timeout',
  INFO: 'info',
  WARN: 'warn',
};

export function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Returns { animals, labels } where labels is { [playerId]: [a, b] }.
// Uses the first 2*N animals of the shuffled pool.
export function assignLabels(playerIds) {
  const n = playerIds.length;
  if (n < 2) throw new Error('need at least 2 players');
  if (n * 2 > ANIMAL_POOL.length) throw new Error('pool too small');
  const animals = shuffle(ANIMAL_POOL).slice(0, n * 2);
  const labels = {};
  for (let i = 0; i < n; i++) {
    labels[playerIds[i]] = [animals[i * 2], animals[i * 2 + 1]];
  }
  return { animals, labels };
}

// Pick a package animal for the current router. MUST NOT be an animal the
// router currently holds (so the player always has to route elsewhere).
export function pickPackage(labels, routerId) {
  const held = new Set(labels[routerId] || []);
  const candidates = [];
  for (const [pid, [a, b]] of Object.entries(labels)) {
    if (pid === routerId) continue;
    candidates.push(a, b);
  }
  const filtered = candidates.filter((a) => !held.has(a));
  // Fall back to any non-held animal if filtering produced nothing (shouldn't
  // happen given pool + player count, but defensive).
  const list = filtered.length ? filtered : candidates;
  return list[Math.floor(Math.random() * list.length)];
}

// Lookup: which player holds a given animal? Returns null if nobody.
export function findHolder(labels, animal) {
  for (const [pid, pair] of Object.entries(labels)) {
    if (pair.includes(animal)) return pid;
  }
  return null;
}

// Apply the partial swap rule: routed animal goes to sender, receiver takes
// one of sender's current labels (keepLabel = which of sender's labels stays
// with sender). Returns new labels object (immutable).
//   sender: router who got it right.
//   receiver: who previously held the routed animal.
//   routedAnimal: the package animal.
//   senderKeepLabel: which of sender's original 2 labels STAYS with sender.
export function applySwap(labels, senderId, receiverId, routedAnimal, senderKeepLabel) {
  const senderLabels = labels[senderId];
  const receiverLabels = labels[receiverId];
  if (!senderLabels || !receiverLabels) return labels;

  const senderGiveLabel = senderLabels.find((l) => l !== senderKeepLabel) ?? senderLabels[0];
  const receiverRemaining = receiverLabels.find((l) => l !== routedAnimal) ?? receiverLabels[0];

  return {
    ...labels,
    [senderId]: [senderKeepLabel, routedAnimal],
    [receiverId]: [receiverRemaining, senderGiveLabel],
  };
}

// Short display name for a connection id so the UI can say "NODE-3" instead
// of "aB12xyz". Index comes from the turnOrder position (stable per game).
export function nodeLabel(index) {
  return `NODE-${String(index + 1).padStart(2, '0')}`;
}
