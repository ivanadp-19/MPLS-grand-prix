import { writable } from 'svelte/store';

export const COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
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

// Full game state (mirrors the PartyKit-synced host state for everyone)
export const game = writable({
  roomId: null,
  hostId: null,
  players: {},           // connId -> {nickname, color, score, answered, isHost}
  config: { numRounds: 10, roundTime: 30 },
  currentRound: 0,
  totalRounds: 10,
  roundTime: 30,
  currentChallenge: null,
  answeredThisRound: false,
  myAnswerIndex: null,
  roundResult: null,     // {correctIndex, correctAnswer, scoreDetails, explanation}
  roundStartTime: 0,
  hostOnline: true,
  chatMessages: [],      // { id, fromId, nickname, color, text, ts }
});

// Rolling event log shown in the sidebar
export const eventLog = writable([]);

export function log(msg, type = '') {
  eventLog.update((entries) => {
    const ts = new Date().toLocaleTimeString();
    const next = [...entries, { ts, msg, type }];
    return next.length > 120 ? next.slice(-120) : next;
  });
}
