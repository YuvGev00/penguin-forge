'use strict';

const net = require('net');
const { extractRequest } = require('./http-parser');
const Request = require('./request');
const { Response } = require('./response');

// The raw TCP layer. Built only on `net`. Reassembles HTTP/1.1 requests from
// arbitrary TCP chunks, then hands a (req, res) pair to an injected
// `dispatch(req, res)` — it knows nothing about routing.

const SOCKET_TIMEOUT_MS = 15000;
const HANDLER_GRACE_MS = 30000; // a handler exceeding this is reaped
const MAX_REQUEST_BYTES = 1024 * 1024; // 1 MiB

function createNetServer(dispatch, { inspector } = {}) {
  let nextConnId = 0;
  // Track every open socket so a clean shutdown can tear down long-lived
  // connections (SSE / WebSocket) that have disabled their own timeouts and
  // would otherwise keep the process alive after server.close().
  const openSockets = new Set();
  const server = net.createServer((socket) => {
    openSockets.add(socket);
    socket.once('close', () => openSockets.delete(socket));
    let buffer = Buffer.alloc(0);
    let closed = false;
    let dispatching = false;
    const connId = ++nextConnId;

    // Tap outbound bytes. `socket.captureOff` is set true by the inspector's
    // own SSE stream so the live feed doesn't record (and recursively
    // re-emit) itself.
    if (inspector) {
      const rawWrite = socket.write.bind(socket);
      const rawEnd = socket.end.bind(socket);
      socket.write = (chunk, ...rest) => {
        if (chunk && !socket.captureOff)
          inspector.outbound(connId, chunk, socket._scope || 'app');
        return rawWrite(chunk, ...rest);
      };
      socket.end = (chunk, ...rest) => {
        if (chunk && !socket.captureOff)
          inspector.outbound(connId, chunk, socket._scope || 'app');
        return rawEnd(chunk, ...rest);
      };
    }

    // Read phase: guards slow-loris / trickled or never-finished requests.
    // Once a full request is parsed the timeout is widened to HANDLER_GRACE
    // (not disabled) so a wedged handler can't pin a file descriptor open
    // forever — it is reaped after the grace period instead.
    socket.setTimeout(SOCKET_TIMEOUT_MS);
    socket.on('timeout', () => {
      if (closed) return;
      closed = true;
      if (!dispatching) {
        socket.end(
          'HTTP/1.1 408 Request Timeout\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
        );
      }
      socket.destroy();
    });

    socket.on('error', () => {
      closed = true;
    });

    // Per-socket drain serializer. The 'data' event fires on every TCP
    // chunk; if the handler is async (it is — dispatch may await), a
    // second chunk arriving during an await would spawn a parallel handler
    // entering the same drain loop on a shared buffer. Two requests would
    // dispatch concurrently with interleaved writes.
    //
    // Fix: data only appends to the buffer and kicks the drain. The drain
    // is a single loop guarded by `draining`; if it's already running,
    // the new bytes will be picked up on the next iteration (which checks
    // `buffer` after each await).
    let draining = false;

    async function drain() {
      if (draining) return;
      draining = true;
      try {
        while (!closed) {
          const result = extractRequest(buffer, MAX_REQUEST_BYTES);

          if (result.error) {
            const status = result.tooLarge
              ? '413 Payload Too Large'
              : '400 Bad Request';
            socket.end(
              `HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
            );
            closed = true;
            return;
          }
          if (!result.complete) break; // need more bytes

          buffer = buffer.slice(result.bytesConsumed);

          // If this request turns out to be a WebSocket upgrade, the
          // dispatcher hijacks the socket and websocket.js takes over frame
          // decoding. A client may pipeline its first frame in the same TCP
          // packet as the upgrade request — those bytes are sitting in
          // `buffer` right now. Expose them so the upgrade branch can hand
          // them to websocket.js instead of dropping them. (Harmless for a
          // normal request: the dispatcher clears it.)
          socket._wsLeftover = buffer.length ? Buffer.from(buffer) : null;

          dispatching = true;
          socket.setTimeout(HANDLER_GRACE_MS); // reap a wedged handler

          const req = new Request(result.request, socket);
          const res = new Response(socket, req.method);

          // HTTP/1.1 keep-alive: persistent by default, unless the client
          // (or we) ask to close. HTTP/1.0 is close-by-default unless the
          // client opts in with `Connection: keep-alive`.
          //
          // Per RFC 7230 §6.1 the Connection header is a comma-separated
          // list of tokens — "close, foo" must still mean "close". Split
          // and check each token rather than the raw string.
          const connTokens = String(req.headers['connection'] || '')
            .toLowerCase()
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const wantsClose = connTokens.includes('close');
          const wantsKeepAlive = connTokens.includes('keep-alive');
          res.keepAlive =
            req.version === 'HTTP/1.1' ? !wantsClose : wantsKeepAlive;

          try {
            await dispatch(req, res);
            if (!res.sent) {
              res.status(404).json({ error: 'Not Found', path: req.path });
            }
          } catch (err) {
            if (!res.sent) {
              res.status(500).json({
                error: 'Internal Server Error',
                message: err && err.message,
              });
            }
          }

          // A handler that hijacked the socket for a long-lived stream
          // (SSE) owns its lifecycle now. Don't touch the timeout, don't
          // try to drain more requests — just stop. Re-arming the read
          // timeout here is what used to reap idle SSE tabs at 15s.
          if (res.hijacked) {
            closed = true;
            break;
          }
          if (!res.keepAlive || socket.writableEnded) {
            closed = true;
            break;
          }
          dispatching = false;
          socket.setTimeout(SOCKET_TIMEOUT_MS);
          // Continue loop — picks up the NEXT pipelined request from the
          // buffer (which may have grown during the await above).
        }
      } finally {
        draining = false;
      }
    }

    socket.on('data', (chunk) => {
      // Once the socket has been upgraded to WebSocket, it is no longer
      // speaking HTTP. websocket.js attached its own 'data' listener for
      // frame decoding — this HTTP handler must not parse, capture, or
      // buffer those binary frames.
      if (socket.upgraded) return;
      if (closed) return;
      // Re-classify the scope on EVERY new request — keep-alive means one
      // TCP connection can carry many requests with different scopes
      // (e.g. the /_data page load is "framework" but its /api/users
      // fetch on the same socket is "app"). Detect a request line at the
      // start of this chunk; if found, update _scope.
      //
      // The SSE feed (/_inspect/events) is special: once a socket is
      // serving SSE we mark captureOff = true permanently so the live
      // feed bytes never get re-captured (recursion guard).
      if (inspector && !socket.captureOff) {
        const head = chunk.toString('latin1', 0, 200);
        const m = head.match(/^([A-Z]+)\s+(\S+)\s+HTTP\/1/);
        if (m) {
          const p = m[2].split('?')[0];
          if (p === '/_inspect/events') {
            socket.captureOff = true;
            socket._scope = 'framework';
          } else if (
            p === '/' || p === '/favicon.ico' ||
            p.startsWith('/_routes') ||  // /_routes, /create, /delete, /built
            p.startsWith('/_data') ||    // /_data, /_data/events
            p.startsWith('/_inspect') || // /_inspect, /snapshot, /replay
            /\.(css|js|mjs|png|jpe?g|svg|ico|woff2?|map)$/.test(p)
          ) {
            socket._scope = 'framework';
          } else {
            socket._scope = 'app';
          }
        }
      }
      // Record the raw inbound bytes BEFORE parsing — so even a malformed
      // request that the parser rejects with 400 is still visible.
      if (inspector && !socket.captureOff) {
        inspector.inbound(connId, chunk, socket._scope || 'app');
      }
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length > MAX_REQUEST_BYTES) {
        socket.end(
          'HTTP/1.1 413 Payload Too Large\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
        );
        closed = true;
        return;
      }

      // Kick the drain. If it's already running, this is a no-op — the
      // loop will see the appended bytes when it checks the buffer next.
      drain();
    });
  });

  // Destroy every still-open connection. Called by forge().close() so a
  // shutdown isn't held open by long-lived SSE / WebSocket sockets.
  server.destroyOpenSockets = () => {
    for (const s of openSockets) s.destroy();
    openSockets.clear();
  };
  return server;
}

module.exports = { createNetServer, MAX_REQUEST_BYTES };
