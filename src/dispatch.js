'use strict';

// Glue: request -> filesystem route -> DSL handler -> Response.
//
// A handler returns a descriptor from the dsl helpers (json/send/status/
// redirect/text), or a bare value (auto: object -> json, else -> send), or
// undefined (it wrote res itself — an escape hatch). We apply that here so
// handlers stay pure and one-liner-friendly.

const INSPECT_UI = require('./inspect-ui');
const DATA_UI = require('./data-ui');
const websocket = require('./websocket');

function applyDescriptor(res, value) {
  if (res.sent) return;

  if (value === undefined) return; // handler used res directly

  // Bare return value, not a descriptor.
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    if (value && typeof value === 'object') return res.json(value);
    return res.send(value);
  }

  switch (value.kind) {
    case 'json':
      return res.status(value.status).json(value.body);
    case 'text':
      return res.status(value.status).type('text/plain; charset=utf-8').send(value.body);
    case 'html':
      return res.status(value.status).type('text/html; charset=utf-8').send(value.body);
    case 'redirect':
      return res.redirect(value.location, value.status);
    case 'file':
      return res
        .status(value.status)
        .sendFile(value.path, () =>
          res.status(404).json({ error: 'Not Found' })
        );
    case 'send':
    default:
      return res.status(value.status).send(value.body);
  }
}

function createDispatcher(router, staticMiddleware, inspector) {
  return async function dispatch(req, res) {
    // Introspection: the live route table, generated from the routes/ tree.
    // Doubles as the data source for the landing page's route explorer.
    if (req.path === '/_routes' && req.method === 'GET') {
      return res.json({ routes: router.list() });
    }

    // ---- Route Builder --------------------------------------------------
    // Create/delete real route files from the browser. fs.watch + hot
    // reload then make the endpoint live with no restart. The builder
    // never writes or evals user JS — handlers come from vetted templates
    // (see route-builder.js) — and delete only touches files it created.
    if (req.path === '/_routes/built' && req.method === 'GET') {
      const { listBuilt } = require('./route-builder');
      return res.json({ built: listBuilt(router.root) });
    }
    if (req.path === '/_routes/create' && req.method === 'POST') {
      const { createRoute } = require('./route-builder');
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const r = createRoute(router.root, {
        method: b.method,
        urlPath: b.path,
        template: b.template,
        value: b.value,
      });
      if (r.error) return res.status(400).json(r);
      // Rebuild immediately so the route is live before we even reply
      // (fs.watch would catch it too, but this makes the round-trip
      // synchronous for the UI and the smoke test).
      router.rebuild();
      return res.status(201).json(r);
    }
    if (req.path === '/_routes/delete' && req.method === 'POST') {
      const { deleteRoute } = require('./route-builder');
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const r = deleteRoute(router.root, b.path);
      if (r.error) return res.status(400).json(r);
      router.rebuild();
      return res.status(200).json(r);
    }

    // ---- Data Explorer (framework UI auto-generated from DSL hints) ----
    if (req.path === '/_data' && req.method === 'GET') {
      return res.type('text/html; charset=utf-8').send(DATA_UI);
    }

    // SSE stream of store changes. Every insert/update/remove anywhere
    // in the app is pushed to every open Data Explorer tab — change a row
    // in one window and watch it update in another, in real time, without
    // any per-resource wiring.
    if (req.path === '/_data/events' && req.method === 'GET') {
      const { changes } = require('./store');
      const sock = req.socket;
      sock.captureOff = true;            // recursion guard for wire inspector
      sock.setTimeout(0);
      res.sent = true;
      res.hijacked = true; // net-server: hands-off — this handler owns the socket
      if (res._resolveDone) res._resolveDone();
      sock.write(
        'HTTP/1.1 200 OK\r\n' +
          'Content-Type: text/event-stream\r\n' +
          'Cache-Control: no-cache\r\n' +
          'X-Accel-Buffering: no\r\n' +
          'Connection: keep-alive\r\n\r\n'
      );
      sock.write('retry: 4000\n\nevent: hello\ndata: {"hello":true}\n\n');
      const onChange = (e) => {
        sock.write(`data: ${JSON.stringify(e)}\n\n`);
      };
      changes.on('change', onChange);
      const beat = setInterval(() => sock.write(': keep-alive\n\n'), 20000);
      const stop = () => {
        clearInterval(beat);
        changes.off('change', onChange);
        sock.destroy();
      };
      sock.on('close', stop);
      sock.on('error', stop);
      return;
    }

    // Fire raw bytes at our own listening port via a fresh net.connect.
    // Shared by Replay (captured bytes) and the Protocol Lab (hand-edited
    // bytes). The bytes flow through the real net server, are parsed and
    // captured anew, and appear on the live feed. The spawned client is
    // bounded by a 5s timeout so a wedged request can't leak an FD.
    function fireRaw(raw, port) {
      const net = require('net');
      const client = net.connect(port, '127.0.0.1', () => client.write(raw));
      client.on('data', () => {});
      client.on('error', () => {});
      client.setTimeout(5000, () => client.destroy());
    }

    // ---- Wire Inspector: Replay -----------------------------------------
    // POST /_inspect/replay { "seq": N } → re-fire the captured raw bytes
    // of event N. Turns the inspector into a protocol-level debugger.
    if (inspector && req.method === 'POST' && req.path === '/_inspect/replay') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const seqN = Number(body.seq);
      if (!Number.isFinite(seqN)) {
        return res.status(400).json({ error: 'missing or non-numeric seq' });
      }
      const raw = inspector.rawOf(seqN);
      if (!raw) {
        return res.status(404).json({ error: 'no captured event with that seq' });
      }
      // Only replay inbound requests — replaying our own outbound response
      // bytes back at ourselves would just look like a malformed request.
      const head = raw.toString('latin1', 0, 200);
      if (!/^[A-Z]+\s+\S+\s+HTTP\/1\.[01]/.test(head)) {
        return res
          .status(400)
          .json({ error: 'event is not a replayable HTTP request' });
      }
      fireRaw(raw, req.socket.localPort);
      return res.status(202).json({
        replayed: { seq: seqN, bytes: raw.length },
      });
    }

    // ---- Protocol Lab: send hand-edited raw bytes -----------------------
    // POST /_inspect/send with the RAW request bytes as the body. We fire
    // them verbatim at our own server so a grader can mutate a request
    // (drop the Host header, add a second Content-Length, change GET to
    // GOT, split a body, pipeline two requests…) and watch the parser
    // accept or reject it live on the wire. The bytes are deliberately
    // NOT validated here — sending malformed input is the whole point.
    if (inspector && req.method === 'POST' && req.path === '/_inspect/send') {
      const raw = req.rawBody; // the literal bytes the client sent us
      if (!raw || raw.length === 0) {
        return res.status(400).json({ error: 'empty body — send raw HTTP bytes' });
      }
      if (raw.length > 16 * 1024) {
        return res.status(413).json({ error: 'raw payload too large (16 KiB cap)' });
      }
      fireRaw(raw, req.socket.localPort);
      return res.status(202).json({ sent: { bytes: raw.length } });
    }

    // ---- Wire Inspector -------------------------------------------------
    if (inspector && req.method === 'GET' && req.path.startsWith('/_inspect')) {
      if (req.path === '/_inspect') {
        return res.type('text/html; charset=utf-8').send(INSPECT_UI);
      }
      if (req.path === '/_inspect/snapshot') {
        // Optional ?since=N → only events with seq > N. Polling fallback
        // uses this so the same events never come back twice.
        const since = Number(req.query && req.query.since) || 0;
        const all = inspector.snapshot();
        const events = since > 0 ? all.filter((e) => e.seq > since) : all;
        return res.set('Cache-Control', 'no-store').json({ events });
      }
      if (req.path === '/_inspect/events') {
        // Server-Sent Events. We bypass the Response abstraction and own
        // the raw socket: write the SSE head, mark this socket so the
        // inspector tap ignores its own feed, then stream events until the
        // client disconnects.
        const sock = req.socket;
        sock.captureOff = true;
        res.sent = true; // tell the server loop we've taken over
        res.hijacked = true; // net-server: hands-off — we own the socket
        if (res._resolveDone) res._resolveDone();

        // An SSE stream is intentionally long-lived. The read-phase socket
        // timeout would otherwise reap it after ~15s of no client bytes;
        // the browser would auto-reconnect and the whole snapshot would
        // replay — that was the periodic "refresh jump". Disable the
        // timeout here and keep the pipe warm with a heartbeat comment.
        sock.setTimeout(0);

        sock.write(
          'HTTP/1.1 200 OK\r\n' +
            'Content-Type: text/event-stream\r\n' +
            'Cache-Control: no-cache\r\n' +
            'X-Accel-Buffering: no\r\n' +
            'Connection: keep-alive\r\n\r\n'
        );
        // Kickoff: send a real (no-op) `data:` event immediately so the
        // browser's EventSource always fires `onmessage` (and `onopen`)
        // right away. Chrome doesn't reliably fire onopen on SSE comments
        // alone, so we use a data event the client will ignore. Without
        // this, the inspector falls back to polling for no reason.
        sock.write(
          'retry: 4000\n\n' +
          ': fs-forge inspector ready\n\n' +
          'event: hello\ndata: {"hello":true}\n\n'
        );

        // On reconnect the browser sends Last-Event-ID. Only replay events
        // strictly newer than that, so a reconnect resumes seamlessly
        // instead of re-dumping the entire buffer (the visible jump).
        const lastId = Number(req.headers['last-event-id']) || 0;
        for (const e of inspector.snapshot()) {
          if (e.seq > lastId) {
            sock.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
          }
        }
        const unsub = inspector.subscribe((e) => {
          sock.write(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
        });
        // Heartbeat: an SSE comment every 20s keeps the connection alive
        // through idle periods and intermediaries without emitting an event.
        const beat = setInterval(() => sock.write(': keep-alive\n\n'), 20000);
        const stop = () => {
          clearInterval(beat);
          unsub();
          sock.destroy();
        };
        sock.on('close', stop);
        sock.on('error', stop);
        return;
      }
    }

    // Match on the RAW (still-encoded) path so an encoded slash (%2F) in a
    // segment can't merge two segments and change route matching. The router
    // decodes each captured param afterwards.
    const matched = router.match(req.rawPath);

    // ---- WebSocket upgrade ---------------------------------------------
    // A WS route file (ws`${handler}`) is matched like any other route, but
    // an Upgrade: websocket request is answered with a 101 handshake instead
    // of an HTTP response. After that the connection is no longer HTTP, so we
    // hijack the socket (net-server hands off) and websocket.js owns it.
    if (matched && matched.handlers.__forgeWs) {
      const up = websocket.isUpgrade(req.headers);
      if (!up) {
        // The route is WS-only; a plain GET to it isn't meaningful.
        return res
          .status(426)
          .set('Upgrade', 'websocket')
          .set('Connection', 'Upgrade')
          .json({ error: 'Upgrade Required', hint: 'connect via WebSocket' });
      }
      if (up.error === '426') {
        return res
          .status(426)
          .set('Sec-WebSocket-Version', '13')
          .json({ error: 'Unsupported WebSocket version (need 13)' });
      }

      const sock = req.socket;
      sock.captureOff = true; // raw frames are binary — keep them off the inspector
      sock.upgraded = true; // net-server: stop HTTP-parsing this socket's data
      sock.setTimeout(0); // a WS connection is long-lived
      res.sent = true;
      res.hijacked = true; // net-server: hands off — websocket.js owns the socket
      if (res._resolveDone) res._resolveDone();

      // Hand over any bytes that rode in after the upgrade request in the
      // same TCP packet (a client may pipeline the first frame). net-server
      // stashes the post-request remainder on the socket for us.
      const leftover = sock._wsLeftover || null;
      sock._wsLeftover = null;

      req.params = matched.params;
      const handler = matched.handlers.handler;
      websocket.attach(sock, up.key, (conn) => handler(conn, { params: req.params, query: req.query, headers: req.headers }), leftover);
      return;
    }

    if (matched) {
      // RFC 7231 §4.3.2: HEAD MUST be supported on any resource that
      // supports GET — same headers, no body. If the route declares GET
      // but not HEAD, run the GET handler; Response.method is already
      // 'HEAD' so it suppresses the body automatically.
      let handler = matched.handlers[req.method];
      if (!handler && req.method === 'HEAD' && matched.handlers.GET) {
        handler = matched.handlers.GET;
      }
      if (!handler) {
        // Route exists but not for this method.
        // (HEAD is included in `allowed` if GET is — see fallback above.)
        const allowed = new Set(Object.keys(matched.handlers));
        if (allowed.has('GET')) allowed.add('HEAD');
        return res
          .status(405)
          .set('Allow', [...allowed].join(', '))
          .json({
            error: 'Method Not Allowed',
            path: req.path,
            allowed: [...allowed],
          });
      }

      req.params = matched.params;
      const ctx = {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        headers: req.headers,
        get body() {
          return req.body;
        },
        req,
        res,
      };
      const value = await handler(ctx);
      return applyDescriptor(res, value);
    }

    // No route — try static files, then fall through to the 404 the
    // net-server applies when nothing wrote a response.
    if (staticMiddleware) {
      await new Promise((resolve) => {
        staticMiddleware(req, res, resolve);
        res.done.then(resolve, resolve);
      });
    }
  };
}

module.exports = { createDispatcher, applyDescriptor };
