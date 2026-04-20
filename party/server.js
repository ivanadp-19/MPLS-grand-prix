// PartyKit server for MPLS Grand Prix.
// One Party instance per room (room id = the "mpls-XXXXXX" code).
// The first connection to a room is promoted to "host"; all other
// connections are "clients". This server is a routing relay — game logic
// still lives on the host's browser so we stay compatible with the
// existing handleHostMessage / handleClientMessage dispatchers.
//
// Client -> server envelope:
//   { to: "host" | "all" | "<connId>", type: "...", ...payload }
// Server -> client envelope (for relayed messages):
//   { ...originalPayload, from: "<senderConnId>" }
//
// Lifecycle messages the server emits:
//   { type: "connected", role: "host"|"client", connId, roomId, hostId? }
//   { type: "peer-joined", from }         (only to host when a client connects)
//   { type: "peer-left",   from }         (only to host when a client disconnects)
//   { type: "host-left" }                 (broadcast when host disconnects)
//   { type: "host-reassigned", hostId }   (if we promote a new host)

export default class Server {
  constructor(party) {
    this.party = party;
    this.hostId = null;
  }

  onConnect(conn) {
    if (!this.hostId) {
      this.hostId = conn.id;
      conn.send(JSON.stringify({
        type: "connected",
        role: "host",
        connId: conn.id,
        roomId: this.party.id,
      }));
      return;
    }

    conn.send(JSON.stringify({
      type: "connected",
      role: "client",
      connId: conn.id,
      roomId: this.party.id,
      hostId: this.hostId,
    }));

    const hostConn = this.party.getConnection(this.hostId);
    if (hostConn) {
      hostConn.send(JSON.stringify({ type: "peer-joined", from: conn.id }));
    }
  }

  onMessage(message, sender) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }

    const envelope = JSON.stringify({ ...msg, from: sender.id });

    if (msg.to === "host") {
      if (this.hostId && this.hostId !== sender.id) {
        const hostConn = this.party.getConnection(this.hostId);
        if (hostConn) hostConn.send(envelope);
      }
      return;
    }

    if (msg.to === "all" || !msg.to) {
      this.party.broadcast(envelope, [sender.id]);
      return;
    }

    // Direct send to a specific connection id
    const target = this.party.getConnection(msg.to);
    if (target) target.send(envelope);
  }

  onClose(conn) {
    if (conn.id === this.hostId) {
      this.hostId = null;
      this.party.broadcast(JSON.stringify({ type: "host-left" }));
      return;
    }
    if (this.hostId) {
      const hostConn = this.party.getConnection(this.hostId);
      if (hostConn) {
        hostConn.send(JSON.stringify({ type: "peer-left", from: conn.id }));
      }
    }
  }
}
