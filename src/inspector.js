'use strict';

const { EventEmitter } = require('events');

// The Wire Inspector — a built-in tap on the raw socket.
//
// net-server records every inbound chunk (before parsing, so even a 400 is
// captured) and every outbound write. Each event keeps a bounded text + hex
// preview so memory can't grow without limit. Live subscribers (the SSE
// stream behind /_inspect) get pushed each event; a ring buffer holds the
// most recent N so a freshly-opened inspector shows recent history too.

const MAX_EVENTS = 100;
const MAX_PREVIEW_BYTES = 2048;
// Cap the raw bytes we keep for replay so an attacker (or curl --upload) can
// not pin memory by sending a huge body. 16 KiB is plenty for an HTTP/1.1
// request line + headers + a small body, which is what gets replayed.
const MAX_RAW_BYTES = 16 * 1024;

function makePreview(buf) {
  const slice = buf.subarray(0, MAX_PREVIEW_BYTES);
  return {
    bytes: buf.length,
    truncated: buf.length > MAX_PREVIEW_BYTES,
    // latin1 keeps every byte 1:1 and printable-ish for the header text.
    text: slice.toString('latin1'),
    hex: slice.toString('hex').replace(/(..)/g, '$1 ').trim(),
  };
}

function createInspector() {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  const ring = [];
  let seq = 0;

  function record(direction, connId, buf, scope) {
    const real = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf));
    // The full raw bytes are kept on the event so the inspector can REPLAY
    // it byte-for-byte. We slice() to MAX_RAW_BYTES so an oversized chunk
    // can't grow the ring beyond a known bound. Hidden from snapshot() so
    // the SSE payload stays small.
    const event = {
      seq: ++seq,
      ts: Date.now(),
      direction, // 'in' | 'out'
      connId,
      scope: scope === 'framework' ? 'framework' : 'app',
      ...makePreview(real),
    };
    Object.defineProperty(event, 'raw', {
      value: real.subarray(0, MAX_RAW_BYTES),
      enumerable: false,
    });
    ring.push(event);
    if (ring.length > MAX_EVENTS) ring.shift();
    bus.emit('event', event);
  }

  return {
    inbound: (connId, buf, scope) => record('in', connId, buf, scope),
    outbound: (connId, buf, scope) => record('out', connId, buf, scope),
    snapshot: () => ring.slice(),
    // Look up the raw bytes of a captured event by sequence number.
    rawOf: (seqN) => {
      const e = ring.find((x) => x.seq === Number(seqN));
      return e ? e.raw : null;
    },
    subscribe: (fn) => {
      bus.on('event', fn);
      return () => bus.off('event', fn);
    },
  };
}

module.exports = { createInspector };
