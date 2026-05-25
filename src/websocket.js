'use strict';

// WebSockets, from scratch (RFC 6455), on the same raw `net` socket.
//
// fs-forge already owns the wire: the HTTP parser surfaces the Upgrade
// headers, and the SSE work proved the socket-hijack convention
// (`res.hijacked`). A WebSocket is just that pattern taken one step
// further — after a `101 Switching Protocols` handshake the connection
// stops being HTTP, so this module takes over the socket entirely:
// it decodes inbound frames itself and encodes outbound ones, handing
// handlers a small connection object that never touches a byte.
//
// Scope (documented boundaries, matching the project's style):
//   - text + binary + close + ping/pong opcodes
//   - client->server frames are unmasked here (browsers always mask)
//   - server->client frames are sent unmasked (per spec)
//   - single-frame messages only: a fragmented message (FIN=0 +
//     continuation frames) is rejected with a 1009 close. permessage-
//     deflate and subprotocol negotiation are out of scope.

const crypto = require('crypto');
const { EventEmitter } = require('events');

// The magic GUID from RFC 6455 §1.3 — concatenated with the client's
// Sec-WebSocket-Key, SHA-1'd, base64'd, to prove we speak the protocol.
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Opcodes (RFC 6455 §5.2).
const OP = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
};

const MAX_MESSAGE_BYTES = 1024 * 1024; // 1 MiB, mirrors the HTTP body cap

// Compute the Sec-WebSocket-Accept value for a client's key.
function acceptKey(secWebSocketKey) {
  return crypto
    .createHash('sha1')
    .update(secWebSocketKey + WS_GUID)
    .digest('base64');
}

// Is this a valid WebSocket upgrade request? Returns the key if so, else null.
// Per RFC 6455 §4.2.1 we need: Upgrade: websocket, Connection contains
// "upgrade", a Sec-WebSocket-Key, and version 13.
function isUpgrade(headers) {
  const upgrade = String(headers['upgrade'] || '').toLowerCase();
  const connection = String(headers['connection'] || '').toLowerCase();
  const key = headers['sec-websocket-key'];
  const version = String(headers['sec-websocket-version'] || '').trim();
  if (upgrade !== 'websocket') return null;
  if (!connection.split(',').map((s) => s.trim()).includes('upgrade')) return null;
  if (!key) return null;
  // RFC 6455 §4.2.1: Sec-WebSocket-Key MUST be a base64-encoded 16-byte value.
  // Reject anything else rather than hashing arbitrary text into a 101.
  if (!isValidKey(key)) return null;
  if (version !== '13') return { error: '426', key: null }; // Upgrade Required
  return { error: null, key };
}

function isValidKey(key) {
  if (!/^[A-Za-z0-9+/]{22}==$/.test(String(key).trim())) return false;
  try {
    return Buffer.from(key, 'base64').length === 16;
  } catch {
    return false;
  }
}

// Build the raw 101 response bytes. Written directly to the socket (NOT via
// the Response class, which has no 101 status text and force-injects HTTP
// headers like Content-Length / Server).
function handshakeResponse(key) {
  return (
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n` +
    '\r\n'
  );
}

// ---- Frame encoding (server -> client, unmasked) -------------------------
function encodeFrame(opcode, payload) {
  const data = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(String(payload), 'utf8');
  const len = data.length;

  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    // 64-bit length: high 32 bits are zero for any realistic payload.
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x80 | opcode; // FIN=1, single-frame message
  return Buffer.concat([header, data]);
}

// ---- Frame decoding (client -> server, masked) ---------------------------
// Pulls exactly one complete frame off the front of `buf`. Returns:
//   { need: true }                              -> not enough bytes yet
//   { frame: { fin, opcode, payload }, rest }   -> one frame + remaining bytes
//   { error: code }                             -> protocol violation (close)
function decodeFrame(buf) {
  if (buf.length < 2) return { need: true };

  const b0 = buf[0];
  const b1 = buf[1];
  const fin = (b0 & 0x80) !== 0;
  const rsv = b0 & 0x70; // reserved bits must be zero (no extensions)
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;

  if (rsv !== 0) return { error: 1002 }; // protocol error
  // RFC 6455 §5.1: a client MUST mask its frames.
  if (!masked) return { error: 1002 };

  let offset = 2;
  if (len === 126) {
    if (buf.length < offset + 2) return { need: true };
    len = buf.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buf.length < offset + 8) return { need: true };
    const high = buf.readUInt32BE(offset);
    const low = buf.readUInt32BE(offset + 4);
    if (high !== 0) return { error: 1009 }; // too big to address sanely
    len = low;
    offset += 8;
  }

  if (len > MAX_MESSAGE_BYTES) return { error: 1009 }; // message too big

  // 4-byte masking key follows the length.
  if (buf.length < offset + 4) return { need: true };
  const mask = buf.slice(offset, offset + 4);
  offset += 4;

  if (buf.length < offset + len) return { need: true };
  const payload = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    payload[i] = buf[offset + i] ^ mask[i & 3];
  }
  offset += len;

  return { frame: { fin, opcode, payload }, rest: buf.slice(offset) };
}

// ---- The connection object handlers receive ------------------------------
// Mirrors how HTTP handlers get a friendly Request/Response and never touch
// raw bytes: WS handlers get `.send()`, `.on('message'|'close')`, `.ping()`,
// `.close()` and never see a frame.
class WebSocketConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.closed = false;
    this.ip = socket.remoteAddress;
  }

  send(data) {
    if (this.closed) return false;
    const isBuf = Buffer.isBuffer(data);
    const opcode = isBuf ? OP.BINARY : OP.TEXT;
    return this.socket.write(encodeFrame(opcode, data));
  }

  ping(data = Buffer.alloc(0)) {
    if (this.closed) return false;
    return this.socket.write(encodeFrame(OP.PING, data));
  }

  // Send a Close frame (with an optional code) and tear down.
  close(code = 1000, reason = '') {
    if (this.closed) return;
    this.closed = true;
    const reasonBuf = Buffer.from(String(reason), 'utf8');
    const payload = Buffer.alloc(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    try {
      this.socket.write(encodeFrame(OP.CLOSE, payload));
    } catch {
      /* socket may already be gone */
    }
    this.socket.end();
  }
}

// Take ownership of a freshly-upgraded socket: write the 101, attach a frame
// decoder to the socket's data events, and drive the connection object.
// `leftover` is any bytes that arrived in the same TCP packet as the upgrade
// request (a client may pipeline the first frame — we must not drop it).
function attach(socket, key, handler, leftover) {
  socket.write(handshakeResponse(key));

  const conn = new WebSocketConnection(socket);
  let buffer = leftover && leftover.length ? Buffer.from(leftover) : Buffer.alloc(0);

  function fail(code) {
    conn.closed = true;
    try {
      const payload = Buffer.alloc(2);
      payload.writeUInt16BE(code, 0);
      socket.write(encodeFrame(OP.CLOSE, payload));
    } catch {
      /* ignore */
    }
    socket.destroy();
    conn.emit('close');
  }

  function pump() {
    while (!conn.closed) {
      const r = decodeFrame(buffer);
      if (r.need) return;
      if (r.error) return fail(r.error);
      buffer = r.rest;

      const { fin, opcode, payload } = r.frame;

      // We don't reassemble fragmented messages; require single-frame.
      if (!fin || opcode === OP.CONTINUATION) return fail(1009);

      switch (opcode) {
        case OP.TEXT:
          conn.emit('message', payload.toString('utf8'), false);
          break;
        case OP.BINARY:
          conn.emit('message', payload, true);
          break;
        case OP.PING:
          if (!conn.closed) socket.write(encodeFrame(OP.PONG, payload));
          break;
        case OP.PONG:
          conn.emit('pong', payload);
          break;
        case OP.CLOSE: {
          // Echo a Close and end — a clean closing handshake.
          if (!conn.closed) {
            conn.closed = true;
            try {
              socket.write(encodeFrame(OP.CLOSE, payload));
            } catch {
              /* ignore */
            }
            socket.end();
          }
          conn.emit('close');
          return;
        }
        default:
          return fail(1002); // unknown opcode
      }
    }
  }

  socket.on('data', (chunk) => {
    if (conn.closed) return;
    buffer = Buffer.concat([buffer, chunk]);
    pump();
  });
  socket.on('close', () => {
    if (!conn.closed) {
      conn.closed = true;
      conn.emit('close');
    }
  });
  socket.on('error', () => {
    if (!conn.closed) {
      conn.closed = true;
      conn.emit('close');
    }
  });

  // Hand the connection to the user's handler, then drain any pipelined
  // first frame that rode in with the upgrade request.
  try {
    handler(conn);
  } catch (err) {
    return fail(1011); // internal error
  }
  if (buffer.length) pump();

  return conn;
}

module.exports = {
  acceptKey,
  isUpgrade,
  handshakeResponse,
  encodeFrame,
  decodeFrame,
  attach,
  WebSocketConnection,
  OP,
};
