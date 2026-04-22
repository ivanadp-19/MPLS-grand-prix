// Game engine: wires the PartyKit transport to the Svelte stores and runs
// the host-authoritative round loop. The host runs all the game logic
// (generates challenges, scores, broadcasts state); clients just render
// what they receive.
import { get } from 'svelte/store';
import { connectToRoom } from './transport.js';
import { generateChallenge, buildExplanation, CHALLENGE_TYPES } from './challenges.js';
import { game, me, view, log } from './stores.js';

let connection = null;
let roundTimer = null;       // setTimeout id for round end (host only)
let everyoneAnsweredPoll = null;
let clientTickTimer = null;  // client-side visual timer

// Host-only working state that never needs reactivity
const hostState = {
  currentChallenge: null,
  answersReceived: {},   // connId -> {index, time}
  roundStartTime: 0,
  challengeDeck: [],     // shuffled queue of types; refills when empty
};

function shuffleArr(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextChallengeType() {
  if (hostState.challengeDeck.length === 0) {
    let deck = shuffleArr(CHALLENGE_TYPES);
    // Avoid back-to-back repeats across deck boundaries.
    if (hostState.currentChallenge && deck[0] === hostState.currentChallenge.type && deck.length > 1) {
      [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    hostState.challengeDeck = deck;
  }
  return hostState.challengeDeck.shift();
}

function send(envelope) {
  if (!connection) return;
  connection.send(envelope);
}

function sendToHost(msg) {
  send({ to: 'host', ...msg });
}

function broadcastToAll(msg) {
  send({ to: 'all', ...msg });
}

function randomRoomId() {
  return 'mpls-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function normalizeCode(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return 'mpls-' + trimmed.replace(/^mpls[-_ ]?/i, '').toUpperCase();
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

export function createRoom() {
  const roomId = randomRoomId();
  openRoom(roomId, 'host');
}

export function joinRoom(rawCode) {
  const roomId = normalizeCode(rawCode);
  if (!roomId) {
    alert('Escribe el código de la sala');
    return;
  }
  openRoom(roomId, 'client');
}

export function leaveRoom() {
  teardown();
  view.set('lobby');
}

export function regenerateRoom() {
  if (!get(me).isHost) return;
  if (!confirm('Esto generará un código nuevo y desconectará a los jugadores actuales. ¿Continuar?')) return;
  log('Regenerando sala...', 'warn');
  teardown();
  setTimeout(() => createRoom(), 250);
}

export function startGame(config) {
  const meNow = get(me);
  if (!meNow.isHost) return;
  const players = get(game).players;
  if (Object.keys(players).length < 2) {
    alert('Necesitas al menos 2 jugadores');
    return;
  }

  hostState.challengeDeck = [];       // fresh shuffle per game
  hostState.currentChallenge = null;
  game.update((g) => ({ ...g, config, currentRound: 0, totalRounds: config.numRounds, roundTime: config.roundTime }));
  broadcastToAll({ type: 'game-start', config });
  view.set('game');
  setTimeout(() => nextRoundHost(), 1000);
}

export function submitChat(rawText) {
  const text = (rawText || '').trim();
  if (!text) return;
  const meNow = get(me);
  if (meNow.isHost) {
    handleChat(meNow.id, text);
  } else {
    sendToHost({ type: 'chat', text });
  }
}

export function submitAnswer(index) {
  const g = get(game);
  if (g.answeredThisRound) return;
  game.update((s) => ({ ...s, answeredThisRound: true, myAnswerIndex: index }));

  const meNow = get(me);
  if (meNow.isHost) {
    hostState.answersReceived[meNow.id] = {
      index,
      time: Date.now() - hostState.roundStartTime,
    };
    // Mark the host's own player entry as answered and broadcast.
    game.update((s) => ({
      ...s,
      players: {
        ...s.players,
        [meNow.id]: { ...s.players[meNow.id], answered: true },
      },
    }));
    broadcastGameState();
  } else {
    sendToHost({ type: 'answer', index });
  }
  log('Respuesta enviada', 'warn');
}

// -----------------------------------------------------------------------
// Connection plumbing
// -----------------------------------------------------------------------

function openRoom(roomId, expectedRole) {
  teardown();
  connection = connectToRoom(roomId, {
    onLifecycle: handleLifecycle.bind(null, expectedRole),
    onMessage: handleRelayedMessage,
    onClose: () => {
      log('WebSocket cerrado', 'error');
      game.update((g) => ({ ...g, hostOnline: false }));
    },
    onError: () => log('Error de WebSocket. Revisa PARTYKIT_HOST.', 'error'),
  });
}

function handleLifecycle(expectedRole, msg) {
  switch (msg.type) {
    case 'connected': {
      if (expectedRole === 'host' && msg.role !== 'host') {
        alert('Ese código ya lo tiene otra sala en curso. Regenera uno nuevo.');
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
        const meNow = get(me);
        log('Sala creada con ID: ' + msg.roomId, 'success');
        game.update((g) => ({
          ...g,
          roomId: msg.roomId,
          hostId: msg.connId,
          hostOnline: true,
          players: {
            ...g.players,
            [msg.connId]: {
              nickname: meNow.nickname,
              color: meNow.color,
              score: 0,
              isHost: true,
              answered: false,
            },
          },
        }));
        view.set('waiting');
      } else {
        game.update((g) => ({ ...g, roomId: msg.roomId, hostId: msg.hostId, hostOnline: true }));
        const meNow = get(me);
        sendToHost({ type: 'join', nickname: meNow.nickname, color: meNow.color });
        log('Conectado. Esperando al host...', 'success');
        view.set('waiting');
      }
      return;
    }
    case 'peer-joined': {
      // Host-only; the actual "join" payload (with nickname/color) arrives
      // as a relayed message a moment later. Nothing to do here.
      return;
    }
    case 'peer-left': {
      if (!get(me).isHost) return;
      game.update((g) => {
        const p = g.players[msg.from];
        if (p) log((p.nickname || msg.from) + ' se desconectó', 'warn');
        const players = { ...g.players };
        delete players[msg.from];
        return { ...g, players };
      });
      delete hostState.answersReceived[msg.from];
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

function handleRelayedMessage(msg) {
  if (get(me).isHost) {
    handleHostMessage(msg.from, msg);
  } else {
    handleClientMessage(msg);
  }
}

// Chat: 240-char cap, sliding-window 5 msgs / 10 s per sender. Host is the
// single point that validates and rebroadcasts; clients never gossip directly.
const chatWindowMs = 10000;
const chatMaxPerWindow = 5;
const chatHistory = new Map();
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

  const msg = {
    id: `${now}-${chatIdCounter++}`,
    fromId,
    nickname: player.nickname,
    color: player.color,
    text,
    ts: now,
  };
  // Append locally on the host (PartyKit excludes the sender from broadcasts).
  appendChat(msg);
  // And send to every other connection.
  broadcastToAll({ type: 'chat', ...msg });
}

function appendChat(msg) {
  game.update((g) => {
    const next = [...g.chatMessages, msg];
    return { ...g, chatMessages: next.length > 80 ? next.slice(-80) : next };
  });
}

function handleHostMessage(fromId, data) {
  if (data.type === 'chat') {
    handleChat(fromId, data.text);
    return;
  }
  if (data.type === 'join') {
    game.update((g) => ({
      ...g,
      players: {
        ...g.players,
        [fromId]: {
          nickname: data.nickname,
          color: data.color,
          score: 0,
          isHost: false,
          answered: false,
        },
      },
    }));
    log(data.nickname + ' se unió', 'success');
    broadcastPlayers();
  } else if (data.type === 'answer') {
    if (!hostState.answersReceived[fromId] && hostState.currentChallenge) {
      hostState.answersReceived[fromId] = {
        index: data.index,
        time: Date.now() - hostState.roundStartTime,
      };
      game.update((g) => {
        const p = g.players[fromId];
        if (p) {
          log(p.nickname + ' respondió', 'warn');
          return {
            ...g,
            players: { ...g.players, [fromId]: { ...p, answered: true } },
          };
        }
        return g;
      });
      broadcastGameState();
    }
  }
}

function handleClientMessage(data) {
  if (data.type === 'players-update') {
    game.update((g) => ({ ...g, players: data.players }));
  } else if (data.type === 'game-start') {
    game.update((g) => ({
      ...g,
      config: data.config,
      currentRound: 0,
      totalRounds: data.config.numRounds,
      roundTime: data.config.roundTime,
    }));
    view.set('game');
    log('¡Partida iniciada!', 'success');
  } else if (data.type === 'new-round') {
    startRoundClient(data);
  } else if (data.type === 'round-result') {
    showRoundResult(data);
  } else if (data.type === 'game-state') {
    game.update((g) => ({ ...g, players: data.players }));
  } else if (data.type === 'game-end') {
    game.update((g) => ({ ...g, players: data.players }));
    view.set('final');
  } else if (data.type === 'error') {
    alert(data.message);
    teardown();
    view.set('lobby');
  } else if (data.type === 'chat') {
    appendChat({
      id: data.id,
      fromId: data.fromId,
      nickname: data.nickname,
      color: data.color,
      text: data.text,
      ts: data.ts,
    });
  }
}

// -----------------------------------------------------------------------
// Host round loop
// -----------------------------------------------------------------------

function nextRoundHost() {
  const g = get(game);
  const meNow = get(me);
  const nextRound = g.currentRound + 1;
  if (nextRound > g.totalRounds) {
    endGameHost();
    return;
  }

  hostState.currentChallenge = generateChallenge(nextChallengeType());
  hostState.answersReceived = {};
  hostState.roundStartTime = Date.now();

  // Reset per-player answered flag
  game.update((s) => {
    const players = { ...s.players };
    for (const id of Object.keys(players)) players[id] = { ...players[id], answered: false };
    return {
      ...s,
      currentRound: nextRound,
      players,
      answeredThisRound: false,
      myAnswerIndex: null,
      roundResult: null,
      currentChallenge: null,
      roundStartTime: hostState.roundStartTime,
    };
  });

  const payload = {
    type: 'new-round',
    round: nextRound,
    totalRounds: g.totalRounds,
    roundTime: g.roundTime,
    challenge: {
      type: hostState.currentChallenge.type,
      question: hostState.currentChallenge.question,
      options: hostState.currentChallenge.options,
      label: hostState.currentChallenge.label,
      topo: hostState.currentChallenge.topo,
      highlightNode: hostState.currentChallenge.highlightNode,
      activeEdges: hostState.currentChallenge.activeEdges,
      edgeLabels: hostState.currentChallenge.edgeLabels,
      showLFIB: hostState.currentChallenge.showLFIB,
      lsp: hostState.currentChallenge.lsp,
    },
  };

  broadcastToAll(payload);
  startRoundClient(payload); // host plays too
  broadcastGameState();

  clearTimeout(roundTimer);
  roundTimer = setTimeout(() => finishRoundHost(), g.roundTime * 1000);

  clearInterval(everyoneAnsweredPoll);
  everyoneAnsweredPoll = setInterval(() => {
    if (!hostState.currentChallenge) {
      clearInterval(everyoneAnsweredPoll);
      return;
    }
    const players = get(game).players;
    const everyone = Object.keys(players).every((id) =>
      id === meNow.id ? get(game).answeredThisRound : players[id].answered
    );
    if (everyone) {
      clearInterval(everyoneAnsweredPoll);
      clearTimeout(roundTimer);
      setTimeout(() => finishRoundHost(), 500);
    }
  }, 500);
}

function finishRoundHost() {
  if (!hostState.currentChallenge) return;
  const challenge = hostState.currentChallenge;
  const meNow = get(me);
  const g = get(game);

  const correctAnswer = challenge.correctAnswer;
  const correctIndex = challenge.options.indexOf(correctAnswer);

  // Include host's own answer
  if (g.answeredThisRound && g.myAnswerIndex != null) {
    hostState.answersReceived[meNow.id] = {
      index: g.myAnswerIndex,
      time: Date.now() - hostState.roundStartTime,
    };
  }

  const scoreDetails = {};
  const updatedPlayers = { ...g.players };
  Object.keys(updatedPlayers).forEach((pid) => {
    const ans = hostState.answersReceived[pid];
    let earned = 0;
    let correct = false;
    if (ans && ans.index === correctIndex) {
      correct = true;
      earned = 100;
      const t = ans.time / 1000;
      if (t < 8) earned += 50;
      else if (t < 16) earned += 25;
      else if (t < 24) earned += 10;
    }
    updatedPlayers[pid] = { ...updatedPlayers[pid], score: updatedPlayers[pid].score + earned };
    scoreDetails[pid] = { earned, correct, answerIndex: ans ? ans.index : -1 };
  });

  const correctAnswerers = Object.entries(hostState.answersReceived)
    .filter(([, a]) => a.index === correctIndex)
    .sort((a, b) => a[1].time - b[1].time);
  if (correctAnswerers.length > 0) {
    const firstPid = correctAnswerers[0][0];
    if (updatedPlayers[firstPid]) {
      updatedPlayers[firstPid] = { ...updatedPlayers[firstPid], score: updatedPlayers[firstPid].score + 25 };
      scoreDetails[firstPid].earned += 25;
      scoreDetails[firstPid].firstBonus = true;
    }
  }

  game.update((s) => ({ ...s, players: updatedPlayers }));

  const result = {
    type: 'round-result',
    correctIndex,
    correctAnswer,
    scoreDetails,
    explanation: buildExplanation(challenge),
  };
  broadcastToAll(result);
  showRoundResult(result);
  broadcastGameState();

  hostState.currentChallenge = null;
  setTimeout(() => nextRoundHost(), 5000);
}

function endGameHost() {
  const players = get(game).players;
  broadcastToAll({ type: 'game-end', players });
  view.set('final');
}

// -----------------------------------------------------------------------
// Client-side per-round rendering helpers
// -----------------------------------------------------------------------

function startRoundClient(data) {
  clearInterval(clientTickTimer);
  game.update((g) => ({
    ...g,
    currentChallenge: data.challenge,
    currentRound: data.round,
    totalRounds: data.totalRounds,
    roundTime: data.roundTime,
    answeredThisRound: false,
    myAnswerIndex: null,
    roundResult: null,
    roundStartTime: Date.now(),
  }));
}

function showRoundResult(data) {
  clearInterval(clientTickTimer);
  game.update((g) => ({ ...g, roundResult: data }));
}

function broadcastPlayers() {
  broadcastToAll({ type: 'players-update', players: get(game).players });
}

function broadcastGameState() {
  broadcastToAll({ type: 'game-state', players: get(game).players });
}

function teardown() {
  clearTimeout(roundTimer);
  clearInterval(everyoneAnsweredPoll);
  clearInterval(clientTickTimer);
  roundTimer = null;
  everyoneAnsweredPoll = null;
  clientTickTimer = null;
  hostState.currentChallenge = null;
  hostState.answersReceived = {};
  hostState.challengeDeck = [];
  chatHistory.clear();
  if (connection) {
    connection.close();
    connection = null;
  }
  game.set({
    roomId: null,
    hostId: null,
    players: {},
    config: { numRounds: 10, roundTime: 30 },
    currentRound: 0,
    totalRounds: 10,
    roundTime: 30,
    currentChallenge: null,
    answeredThisRound: false,
    myAnswerIndex: null,
    roundResult: null,
    roundStartTime: 0,
    hostOnline: false,
    chatMessages: [],
  });
  me.update((m) => ({ ...m, id: null, isHost: false }));
}
