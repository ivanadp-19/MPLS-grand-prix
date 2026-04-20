import { writable, derived } from 'svelte/store';
import { DEFAULT_CONFIG, nodeLabel } from './labelswap.js';

export const COLORS = [
  '#00ff41', '#ffb000', '#ff3c3c', '#00b8ff',
  '#ff00ff', '#34d399', '#f472b6', '#c084fc',
];

// Which top-level view to render: 'lobby' | 'waiting' | 'game' | 'final'
export const view = writable('lobby');

// Local player identity
export const me = writable({
  nickname: '',
  color: COLORS[0],
  id: null,
  isHost: false,
});

// Full game state. The host holds the authoritative copy of `labels`.
// Clients only see `publicLabels` during the reveal phase and
// `swapChoiceOptions` when they personally owe a swap choice.
export const game = writable({
  phase: 'waiting',   // 'waiting' | 'reveal' | 'routing' | 'challenging' | 'swap-choice' | 'resolving' | 'final'
  roomId: null,
  hostId: null,
  hostOnline: false,
  config: { ...DEFAULT_CONFIG },

  players: {},        // connId -> { nickname, color, isHost, joinedAt }
  turnOrder: [],      // array of connId in stable display order
  eliminated: [],     // array of eliminated connIds

  // Per-turn transient state
  round: 0,
  currentPlayerId: null,
  packageAnimal: null,
  deadlineMs: 0,
  routingTarget: null,
  challenger: null,

  // Reveal / private channels
  publicLabels: null,             // only non-null during reveal phase
  swapChoiceFor: null,            // receiverId who owes a choice
  swapChoiceOptions: null,        // [label, label] — only populated for me when I'm the receiver

  // Scores (all players see this)
  scores: {},        // connId -> { packetsRouted, intercepts, bufferOverflows }

  // Last resolution (for log rendering + post-hoc overlay)
  lastResolution: null,

  // Public event feed
  networkLog: [],    // { ts, line, severity }

  // Final outcome
  winnerId: null,
});

// Convenience: index of a player in turnOrder (for NODE-NN labelling)
export const nodeLabels = derived(game, ($g) => {
  const map = {};
  $g.turnOrder.forEach((pid, i) => { map[pid] = nodeLabel(i); });
  return map;
});

export function pushLog(line, severity = 'info') {
  game.update((g) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = { ts, line, severity };
    const next = [...g.networkLog, entry];
    return { ...g, networkLog: next.length > 200 ? next.slice(-200) : next };
  });
}
