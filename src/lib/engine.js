// Label Swap engine. Host-authoritative: the player who first connects to a
// PartyKit room becomes host and runs the entire game loop here. Clients
// only send `route`, `intercept`, and `swap-pick` — everything else is
// rendered from broadcasts they observe.
//
// Message protocol (same envelope as before, PartyKit relay):
//   client → host: { to: 'host', type: 'join'|'route'|'intercept'|'swap-pick'|'start-game', ... }
//   host → all:    { to: 'all',  type: 'game-start'|'reveal'|'new-turn'|'routing-locked'|
//                                       'resolution'|'scores'|'log'|'game-end', ... }
//   host → one:    { to: '<id>', type: 'private-swap-choice', ... }

import { get } from 'svelte/store';
import { connectToRoom } from './transport.js';
import { game, me, view, pushLog } from './stores.js';
import {
  DEFAULT_CONFIG, SEVERITY, assignLabels, pickPackage, findHolder,
  applySwap, nodeLabel,
} from './labelswap.js';

let connection = null;

// Timers (host only). We keep handles so we can cancel on interruption.
let routeDeadlineTimer = null;
let challengeDeadlineTimer = null;
let swapChoiceDeadlineTimer = null;
let resolveDelayTimer = null;
let revealTimer = null;

// Host-side authoritative state that never goes over the wire raw.
const hostState = {
  labels: {},            // connId -> [animal, animal]
  config: { ...DEFAULT_CONFIG },
  animals: [],
  turnOrder: [],
  turnIndex: 0,
  round: 0,
  eliminated: new Set(),
  currentPlayerId: null,
  packageAnimal: null,
  routingTarget: null,
  challenger: null,
  challengeDeadlineMs: 0,
  scores: {},            // connId -> {packetsRouted, intercepts, bufferOverflows}
  swapContext: null,     // { senderId, receiverId, routedAnimal, senderFalseIntercept, challengerId }
};

// =======================================================================
// Public API (called from components)
// =======================================================================

export function createRoom() {
  openRoom('mpls-' + Math.random().toString(36).substring(2, 8).toUpperCase(), 'host');
}

export function joinRoom(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) { alert('Escribe el código de la sala'); return; }
  openRoom(code, 'client');
}

export function leaveRoom() {
  teardown();
  view.set('lobby');
}

export function regenerateRoom() {
  if (!get(me).isHost) return;
  if (!confirm('Esto genera un código nuevo y desconecta a los jugadores actuales. ¿Continuar?')) return;
  pushLog('Regenerating room...', SEVERITY.WARN);
  teardown();
  setTimeout(createRoom, 250);
}

export function startGame(config) {
  if (!get(me).isHost) return;
  const players = get(game).players;
  const ids = Object.keys(players);
  if (ids.length < 2) { alert('Necesitas al menos 2 jugadores'); return; }

  hostState.config = { ...DEFAULT_CONFIG, ...config };
  hostState.turnOrder = ids.slice();
  hostState.turnIndex = -1;          // advance() will go to 0
  hostState.round = 0;
  hostState.eliminated = new Set();
  hostState.scores = {};
  ids.forEach((id) => {
    hostState.scores[id] = { packetsRouted: 0, intercepts: 0, bufferOverflows: 0 };
  });

  const { animals, labels } = assignLabels(ids);
  hostState.animals = animals;
  hostState.labels = labels;

  const endsAt = Date.now() + hostState.config.revealMs;
  broadcast({
    type: 'game-start',
    config: hostState.config,
    animals,
    turnOrder: ids,
    scores: hostState.scores,
  });
  broadcast({
    type: 'reveal',
    labels,
    endsAt,
  });

  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    revealTimer = null;
    advanceTurn();
  }, hostState.config.revealMs);
}

export function submitRoute(targetId) {
  const meNow = get(me);
  if (meNow.isHost) {
    // host routes for itself — handle locally without a round trip.
    handleRoute(meNow.id, targetId);
  } else {
    send({ to: 'host', type: 'route', targetId });
  }
}

export function submitIntercept() {
  const meNow = get(me);
  if (meNow.isHost) {
    handleIntercept(meNow.id);
  } else {
    send({ to: 'host', type: 'intercept' });
  }
}

export function submitSwapPick(label) {
  const meNow = get(me);
  if (meNow.isHost) {
    handleSwapPick(meNow.id, label);
  } else {
    send({ to: 'host', type: 'swap-pick', label });
  }
}

export function submitChat(rawText) {
  const text = (rawText || '').trim();
  if (!text) return;
  const meNow = get(me);
  if (meNow.isHost) {
    handleChat(meNow.id, text);
  } else {
    send({ to: 'host', type: 'chat', text });
  }
}

// =======================================================================
// Transport plumbing
// =======================================================================

function openRoom(roomId, expectedRole) {
  teardown();
  connection = connectToRoom(roomId, {
    onLifecycle: (msg) => handleLifecycle(expectedRole, msg),
    onMessage: handleRelayedMessage,
    onClose: () => {
      pushLog('WEBSOCKET CLOSED', SEVERITY.DROP);
      game.update((g) => ({ ...g, hostOnline: false }));
    },
    onError: () => pushLog('WEBSOCKET ERROR', SEVERITY.DROP),
  });
}

function send(envelope) {
  if (!connection) return;
  connection.send(envelope);
}

function broadcast(payload) {
  send({ to: 'all', ...payload });
  // Host also applies the message locally — the server doesn't echo to sender.
  applyBroadcastLocally(payload);
}

function sendPrivate(toId, payload) {
  send({ to: toId, ...payload });
}

function normalizeCode(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return 'mpls-' + trimmed.replace(/^mpls[-_ ]?/i, '').toUpperCase();
}

// =======================================================================
// Lifecycle (connected / peer-joined / peer-left / host-left)
// =======================================================================

function handleLifecycle(expectedRole, msg) {
  switch (msg.type) {
    case 'connected': {
      if (expectedRole === 'host' && msg.role !== 'host') {
        alert('Ese código ya tiene una sala activa. Regenera uno nuevo.');
        teardown();
        return;
      }
      if (expectedRole === 'client' && msg.role === 'host') {
        alert('Esa sala no existe (o el host se fue). Verifica el código.');
        teardown();
        return;
      }
      me.update((m) => ({ ...m, id: msg.connId, isHost: msg.role === 'host' }));

      if (msg.role === 'host') {
        pushLog(`ROOM INITIALIZED :: ${msg.roomId}`, SEVERITY.OK);
        const meNow = get(me);
        game.update((g) => ({
          ...g,
          roomId: msg.roomId,
          hostId: msg.connId,
          hostOnline: true,
          phase: 'waiting',
          players: {
            ...g.players,
            [msg.connId]: {
              nickname: meNow.nickname,
              color: meNow.color,
              isHost: true,
              joinedAt: Date.now(),
            },
          },
        }));
        view.set('waiting');
      } else {
        game.update((g) => ({ ...g, roomId: msg.roomId, hostId: msg.hostId, hostOnline: true, phase: 'waiting' }));
        const meNow = get(me);
        send({ to: 'host', type: 'join', nickname: meNow.nickname, color: meNow.color });
        pushLog('LINK UP :: AWAITING HOST', SEVERITY.OK);
        view.set('waiting');
      }
      return;
    }
    case 'peer-joined':
      // wait for client's own 'join' payload
      return;
    case 'peer-left': {
      if (!get(me).isHost) return;
      const player = get(game).players[msg.from];
      if (player) pushLog(`${player.nickname || 'unknown'} :: LINK DOWN`, SEVERITY.WARN);
      game.update((g) => {
        const players = { ...g.players };
        delete players[msg.from];
        return { ...g, players };
      });
      // If a game is in progress, mark them eliminated so turns skip them.
      if (['reveal', 'routing', 'challenging', 'swap-choice', 'resolving'].includes(get(game).phase)) {
        hostState.eliminated.add(msg.from);
        checkGameEnd();
      }
      broadcastPlayers();
      return;
    }
    case 'host-left': {
      if (get(me).isHost) return;
      alert('El host se desconectó. La sala se cerró.');
      teardown();
      view.set('lobby');
      return;
    }
  }
}

// =======================================================================
// Relayed message router
// =======================================================================

function handleRelayedMessage(msg) {
  const imHost = get(me).isHost;

  if (imHost) {
    switch (msg.type) {
      case 'join':         return handleClientJoin(msg.from, msg);
      case 'route':        return handleRoute(msg.from, msg.targetId);
      case 'intercept':    return handleIntercept(msg.from);
      case 'swap-pick':    return handleSwapPick(msg.from, msg.label);
      case 'chat':         return handleChat(msg.from, msg.text);
    }
  }
  // Host also sees its own broadcasts? No — PartyKit excludes sender. That's
  // why broadcast() also calls applyBroadcastLocally(). Same for private sends.
  // Below dispatches messages FROM the host that clients observe.
  applyBroadcastLocally(msg);
}

function applyBroadcastLocally(msg) {
  switch (msg.type) {
    case 'game-start':
      game.update((g) => ({
        ...g,
        config: msg.config,
        scores: msg.scores,
        turnOrder: msg.turnOrder,
        phase: 'reveal',
        networkLog: [],
      }));
      view.set('game');
      pushLog('GAME START :: LABELS ASSIGNED', SEVERITY.OK);
      return;
    case 'reveal':
      game.update((g) => ({
        ...g,
        publicLabels: msg.labels,
        deadlineMs: msg.endsAt,
        phase: 'reveal',
      }));
      pushLog('LABEL REVEAL :: 10s WINDOW', SEVERITY.INFO);
      return;
    case 'new-turn':
      game.update((g) => ({
        ...g,
        phase: 'routing',
        publicLabels: null,
        round: msg.round,
        currentPlayerId: msg.currentPlayerId,
        packageAnimal: msg.packageAnimal,
        deadlineMs: msg.deadlineMs,
        routingTarget: null,
        challenger: null,
        swapChoiceFor: null,
        swapChoiceOptions: null,
        lastResolution: null,
      }));
      return;
    case 'routing-locked':
      game.update((g) => ({
        ...g,
        phase: 'challenging',
        routingTarget: msg.targetId,
        deadlineMs: msg.challengeDeadlineMs,
      }));
      return;
    case 'private-swap-choice':
      game.update((g) => ({
        ...g,
        phase: 'swap-choice',
        swapChoiceFor: get(me).id,
        swapChoiceOptions: msg.options,
        deadlineMs: msg.deadlineMs,
      }));
      return;
    case 'swap-choice-public':
      game.update((g) => ({
        ...g,
        phase: 'swap-choice',
        swapChoiceFor: msg.receiverId,
        swapChoiceOptions: null,
        deadlineMs: msg.deadlineMs,
      }));
      return;
    case 'resolution':
      game.update((g) => ({
        ...g,
        phase: 'resolving',
        lastResolution: {
          routerId: msg.routerId,
          targetId: msg.targetId,
          animal: msg.animal,
          correct: msg.correct,
          challengerId: msg.challengerId,
          challengerFalse: msg.challengerFalse,
          severity: msg.severity,
        },
        routingTarget: null,
        challenger: null,
        swapChoiceFor: null,
        swapChoiceOptions: null,
      }));
      return;
    case 'scores':
      game.update((g) => ({ ...g, scores: msg.scores, eliminated: msg.eliminated || g.eliminated }));
      return;
    case 'log':
      pushLog(msg.line, msg.severity || SEVERITY.INFO);
      return;
    case 'players-update':
      game.update((g) => ({ ...g, players: msg.players }));
      return;
    case 'game-end':
      game.update((g) => ({
        ...g,
        phase: 'final',
        winnerId: msg.winnerId,
        scores: msg.finalScores,
      }));
      view.set('final');
      return;
    case 'chat': {
      game.update((g) => {
        const entry = {
          id: msg.id,
          fromId: msg.fromId,
          nickname: msg.nickname,
          color: msg.color,
          text: msg.text,
          ts: msg.ts,
        };
        const next = [...g.chatMessages, entry];
        return { ...g, chatMessages: next.length > 80 ? next.slice(-80) : next };
      });
      return;
    }
  }
}

// =======================================================================
// Host handlers
// =======================================================================

// Per-sender sliding-window rate limit: 5 messages per 10 seconds.
const chatWindowMs = 10000;
const chatMaxPerWindow = 5;
const chatHistory = new Map();       // senderId -> number[] (timestamps)
let chatIdCounter = 0;

function handleChat(fromId, rawText) {
  const text = (rawText || '').toString().slice(0, 240).trim();
  if (!text) return;

  const now = Date.now();
  const recent = (chatHistory.get(fromId) || []).filter((t) => now - t < chatWindowMs);
  if (recent.length >= chatMaxPerWindow) return;
  recent.push(now);
  chatHistory.set(fromId, recent);

  const player = get(game).players[fromId];
  if (!player) return;

  broadcast({
    type: 'chat',
    id: `${now}-${chatIdCounter++}`,
    fromId,
    nickname: player.nickname,
    color: player.color,
    text,
    ts: now,
  });
}

function handleClientJoin(fromId, data) {
  // Prevent duplicate joins
  game.update((g) => ({
    ...g,
    players: {
      ...g.players,
      [fromId]: {
        nickname: data.nickname,
        color: data.color,
        isHost: false,
        joinedAt: Date.now(),
      },
    },
  }));
  hostState.scores[fromId] = { packetsRouted: 0, intercepts: 0, bufferOverflows: 0 };
  pushLog(`${data.nickname} :: LINK UP`, SEVERITY.OK);
  broadcastPlayers();
}

function handleRoute(routerId, targetId) {
  if (get(game).phase !== 'routing') return;
  if (routerId !== hostState.currentPlayerId) return;
  if (hostState.eliminated.has(routerId)) return;
  if (!hostState.labels[targetId]) return;

  clearTimeout(routeDeadlineTimer);
  routeDeadlineTimer = null;

  hostState.routingTarget = targetId;
  hostState.challenger = null;
  const challengeDeadlineMs = Date.now() + hostState.config.challengeTimeMs;
  hostState.challengeDeadlineMs = challengeDeadlineMs;

  broadcast({
    type: 'routing-locked',
    routerId,
    targetId,
    challengeDeadlineMs,
  });
  const routerLabel = nodeLabel(hostState.turnOrder.indexOf(routerId));
  const targetLabel = nodeLabel(hostState.turnOrder.indexOf(targetId));
  broadcastLog(`${routerLabel} :: ROUTE LOCKED → ${targetLabel} :: INTERCEPT WINDOW OPEN`, SEVERITY.WARN);

  clearTimeout(challengeDeadlineTimer);
  challengeDeadlineTimer = setTimeout(() => {
    challengeDeadlineTimer = null;
    resolveRoute({ timedOut: false });
  }, hostState.config.challengeTimeMs);
}

function handleIntercept(challengerId) {
  if (get(game).phase !== 'challenging') return;
  if (challengerId === hostState.currentPlayerId) return;
  if (hostState.eliminated.has(challengerId)) return;
  if (hostState.challenger) return;                  // first intercept wins
  hostState.challenger = challengerId;

  clearTimeout(challengeDeadlineTimer);
  challengeDeadlineTimer = null;
  resolveRoute({ timedOut: false });
}

function resolveRoute({ timedOut }) {
  const routerId = hostState.currentPlayerId;
  const targetId = hostState.routingTarget;
  const animal = hostState.packageAnimal;
  const challengerId = hostState.challenger;

  if (timedOut) {
    // Router never picked. Treat as wrong + buffer overflow, no swap.
    bump(routerId, 'bufferOverflows');
    pushLog(`${labelFor(routerId)} :: TIMEOUT :: PACKET DROPPED`, SEVERITY.DROP);
    broadcastResolution({
      routerId, targetId: null, animal, correct: false,
      challengerId: null, challengerFalse: false, severity: SEVERITY.TIMEOUT,
    });
    afterResolution();
    return;
  }

  const correct = findHolder(hostState.labels, animal) === targetId;
  const challengerFalse = !!challengerId && correct;

  if (correct) {
    bump(routerId, 'packetsRouted');
    if (challengerFalse) {
      bump(challengerId, 'bufferOverflows');
      pushLog(`${labelFor(challengerId)} :: FALSE INTERCEPT :: +1 OVERFLOW`, SEVERITY.FALSE_INTERCEPT);
    }
    pushLog(`${labelFor(routerId)} → ${labelFor(targetId)} :: CHECKSUM OK`, SEVERITY.OK);

    broadcastResolution({
      routerId, targetId, animal, correct: true,
      challengerId, challengerFalse,
      severity: challengerFalse ? SEVERITY.FALSE_INTERCEPT : SEVERITY.OK,
    });

    // Enter swap-choice phase targeting the receiver.
    beginSwapChoice(routerId, targetId, animal);
    return;
  }

  // Wrong route.
  bump(routerId, 'bufferOverflows');
  if (challengerId) {
    bump(challengerId, 'intercepts');
    pushLog(`${labelFor(challengerId)} :: INTERCEPT CONFIRMED :: ${labelFor(routerId)} +OVERFLOW`, SEVERITY.INTERCEPT);
  } else {
    pushLog(`${labelFor(routerId)} :: PACKET DROPPED :: +OVERFLOW`, SEVERITY.DROP);
  }

  broadcastResolution({
    routerId, targetId, animal, correct: false,
    challengerId, challengerFalse: false,
    severity: challengerId ? SEVERITY.INTERCEPT : SEVERITY.DROP,
  });
  afterResolution();
}

function beginSwapChoice(senderId, receiverId, routedAnimal) {
  hostState.swapContext = { senderId, receiverId, routedAnimal };
  const options = hostState.labels[senderId].slice(); // receiver picks which of sender's 2 labels to pull
  const deadlineMs = Date.now() + hostState.config.swapChoiceTimeMs;

  // Public signal so others know we're waiting.
  broadcast({ type: 'swap-choice-public', receiverId, deadlineMs });
  // Private options to the receiver only.
  if (receiverId === get(me).id) {
    // Host is the receiver — apply directly via local state update.
    game.update((g) => ({
      ...g,
      phase: 'swap-choice',
      swapChoiceFor: receiverId,
      swapChoiceOptions: options,
      deadlineMs,
    }));
  } else {
    sendPrivate(receiverId, {
      type: 'private-swap-choice',
      options,
      deadlineMs,
    });
  }
  pushLog(`${labelFor(receiverId)} :: SELECTING PULL LABEL`, SEVERITY.WARN);

  clearTimeout(swapChoiceDeadlineTimer);
  swapChoiceDeadlineTimer = setTimeout(() => {
    swapChoiceDeadlineTimer = null;
    // Timeout → pick randomly.
    const randomPick = options[Math.floor(Math.random() * options.length)];
    finalizeSwap(receiverId, randomPick, /*timedOut*/ true);
  }, hostState.config.swapChoiceTimeMs);
}

function handleSwapPick(fromId, label) {
  const ctx = hostState.swapContext;
  if (!ctx) return;
  if (fromId !== ctx.receiverId) return;
  if (!hostState.labels[ctx.senderId] || !hostState.labels[ctx.senderId].includes(label)) return;
  clearTimeout(swapChoiceDeadlineTimer);
  swapChoiceDeadlineTimer = null;
  finalizeSwap(fromId, label, /*timedOut*/ false);
}

function finalizeSwap(receiverId, chosenLabel, timedOut) {
  const ctx = hostState.swapContext;
  if (!ctx) return;
  const { senderId, routedAnimal } = ctx;
  hostState.swapContext = null;

  // chosenLabel = which of sender's labels the receiver *takes*.
  // So sender KEEPS the other one.
  const senderKeepLabel = hostState.labels[senderId].find((l) => l !== chosenLabel) ?? hostState.labels[senderId][0];
  hostState.labels = applySwap(hostState.labels, senderId, receiverId, routedAnimal, senderKeepLabel);

  pushLog(`SWAP EXECUTED :: ${labelFor(senderId)} ↔ ${labelFor(receiverId)}${timedOut ? ' (AUTO)' : ''}`, SEVERITY.OK);
  afterResolution();
}

function afterResolution() {
  hostState.routingTarget = null;
  hostState.challenger = null;
  hostState.challengeDeadlineMs = 0;

  broadcastScores();
  checkEliminationsAndBroadcast();
  if (checkGameEnd()) return;

  clearTimeout(resolveDelayTimer);
  resolveDelayTimer = setTimeout(() => {
    resolveDelayTimer = null;
    advanceTurn();
  }, hostState.config.resolveDelayMs);
}

function advanceTurn() {
  if (checkGameEnd()) return;
  const alive = hostState.turnOrder.filter((id) => !hostState.eliminated.has(id) && hostState.labels[id]);
  if (alive.length <= 1) { endGame(alive[0] || null); return; }

  // Find next alive after turnIndex
  const n = hostState.turnOrder.length;
  let idx = hostState.turnIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const candidate = hostState.turnOrder[idx];
    if (!hostState.eliminated.has(candidate) && hostState.labels[candidate]) {
      hostState.turnIndex = idx;
      hostState.currentPlayerId = candidate;
      break;
    }
  }
  hostState.round += 1;
  hostState.packageAnimal = pickPackage(hostState.labels, hostState.currentPlayerId);
  const deadlineMs = Date.now() + hostState.config.routeTimeMs;

  broadcast({
    type: 'new-turn',
    round: hostState.round,
    currentPlayerId: hostState.currentPlayerId,
    packageAnimal: hostState.packageAnimal,
    deadlineMs,
  });
  broadcastLog(
    `${labelFor(hostState.currentPlayerId)} :: PKT INGRESS :: PAYLOAD=[${hostState.packageAnimal}] TTL=${hostState.config.routeTimeMs / 1000}s`,
    SEVERITY.INFO
  );

  clearTimeout(routeDeadlineTimer);
  routeDeadlineTimer = setTimeout(() => {
    routeDeadlineTimer = null;
    // Timeout: current never routed. Resolve as timeout.
    hostState.routingTarget = null;
    resolveRoute({ timedOut: true });
  }, hostState.config.routeTimeMs);
}

function endGame(winnerId) {
  clearAllTimers();
  const finalScores = { ...hostState.scores };
  if (winnerId === null) {
    // Pick by score as tiebreaker
    const ranked = Object.entries(finalScores).sort(
      (a, b) => (b[1].packetsRouted - a[1].packetsRouted) ||
                (b[1].intercepts - a[1].intercepts) ||
                (a[1].bufferOverflows - b[1].bufferOverflows)
    );
    winnerId = ranked[0]?.[0] ?? null;
  }
  broadcast({ type: 'game-end', winnerId, finalScores });
  broadcastLog(`TRANSMISSION COMPLETE :: WINNER ${winnerId ? labelFor(winnerId) : 'UNDEFINED'}`, SEVERITY.OK);
}

// =======================================================================
// Host helpers
// =======================================================================

function bump(playerId, field) {
  if (!hostState.scores[playerId]) {
    hostState.scores[playerId] = { packetsRouted: 0, intercepts: 0, bufferOverflows: 0 };
  }
  hostState.scores[playerId][field] += 1;
}

function checkEliminationsAndBroadcast() {
  const newly = [];
  for (const id of hostState.turnOrder) {
    if (hostState.eliminated.has(id)) continue;
    const s = hostState.scores[id];
    if (s && s.bufferOverflows >= hostState.config.overflowThreshold) {
      hostState.eliminated.add(id);
      newly.push(id);
      broadcastLog(`${labelFor(id)} :: OFFLINE (${s.bufferOverflows}/${hostState.config.overflowThreshold} OVERFLOWS)`, SEVERITY.DROP);
    }
  }
  if (newly.length) broadcastScores();
}

function checkGameEnd() {
  const alive = hostState.turnOrder.filter(
    (id) => !hostState.eliminated.has(id) && hostState.labels[id],
  );
  if (alive.length <= 1) {
    endGame(alive[0] || null);
    return true;
  }
  return false;
}

function broadcastPlayers() {
  broadcast({ type: 'players-update', players: get(game).players });
}

function broadcastScores() {
  broadcast({
    type: 'scores',
    scores: { ...hostState.scores },
    eliminated: [...hostState.eliminated],
  });
}

function broadcastResolution({ routerId, targetId, animal, correct, challengerId, challengerFalse, severity }) {
  broadcast({
    type: 'resolution',
    routerId, targetId, animal, correct,
    challengerId: challengerId || null,
    challengerFalse: !!challengerFalse,
    severity,
  });
}

function broadcastLog(line, severity = SEVERITY.INFO) {
  broadcast({ type: 'log', line, severity });
}

function labelFor(playerId) {
  const i = hostState.turnOrder.indexOf(playerId);
  return i >= 0 ? nodeLabel(i) : 'NODE-??';
}

// =======================================================================
// Cleanup
// =======================================================================

function clearAllTimers() {
  clearTimeout(routeDeadlineTimer); routeDeadlineTimer = null;
  clearTimeout(challengeDeadlineTimer); challengeDeadlineTimer = null;
  clearTimeout(swapChoiceDeadlineTimer); swapChoiceDeadlineTimer = null;
  clearTimeout(resolveDelayTimer); resolveDelayTimer = null;
  clearTimeout(revealTimer); revealTimer = null;
}

function teardown() {
  clearAllTimers();
  hostState.labels = {};
  hostState.animals = [];
  hostState.turnOrder = [];
  hostState.turnIndex = 0;
  hostState.round = 0;
  hostState.eliminated = new Set();
  hostState.currentPlayerId = null;
  hostState.packageAnimal = null;
  hostState.routingTarget = null;
  hostState.challenger = null;
  hostState.scores = {};
  hostState.swapContext = null;
  chatHistory.clear();

  if (connection) { connection.close(); connection = null; }
  game.set({
    phase: 'waiting',
    roomId: null,
    hostId: null,
    hostOnline: false,
    config: { ...DEFAULT_CONFIG },
    players: {},
    turnOrder: [],
    eliminated: [],
    round: 0,
    currentPlayerId: null,
    packageAnimal: null,
    deadlineMs: 0,
    routingTarget: null,
    challenger: null,
    publicLabels: null,
    swapChoiceFor: null,
    swapChoiceOptions: null,
    scores: {},
    lastResolution: null,
    networkLog: [],
    chatMessages: [],
    winnerId: null,
  });
  me.update((m) => ({ ...m, id: null, isHost: false }));
}
