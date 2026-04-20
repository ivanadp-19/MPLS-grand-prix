// PartyKit WebSocket transport. Wraps partysocket to handle (re)connection
// and provides a tiny pub/sub over the same envelope protocol the server
// (party/server.js) speaks:
//   client -> { to: "host" | "all" | "<connId>", type, ...payload }
//   server -> { type, from, ...payload } for relayed messages, plus
//             lifecycle: connected / peer-joined / peer-left / host-left
import PartySocket from 'partysocket';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST
  || 'mpls-grand-prix.ivanadp-19.partykit.dev';

export function connectToRoom(roomId, { onLifecycle, onMessage, onClose, onError } = {}) {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const host = isLocal ? `${location.hostname}:1999` : PARTYKIT_HOST;

  const socket = new PartySocket({
    host,
    room: roomId,
    party: 'main',
  });

  socket.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    const isLifecycle = ['connected', 'peer-joined', 'peer-left', 'host-left'].includes(msg.type);
    if (isLifecycle) {
      onLifecycle?.(msg);
    } else {
      onMessage?.(msg);
    }
  });

  socket.addEventListener('close', (ev) => onClose?.(ev));
  socket.addEventListener('error', (ev) => onError?.(ev));

  return {
    socket,
    send(envelope) {
      if (socket.readyState !== 1 /* OPEN */) return false;
      socket.send(JSON.stringify(envelope));
      return true;
    },
    close() {
      try { socket.close(); } catch (_) { /* ignore */ }
    },
  };
}

export { PARTYKIT_HOST };
