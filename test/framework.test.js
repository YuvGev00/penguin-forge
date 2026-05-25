'use strict';

// Framework-core test suite for penguin-forge.
//
// Adapted from fs-forge's test/smoke.js. penguin-forge vendored fs-forge's
// framework code under src/ but kept only a game-focused smoke test, so this
// file brings the framework-capability coverage across. It points the server
// at the prepared fixtures under test/fixtures/ and uses a DEDICATED isolated
// DB so it never touches any real data file.
//
// Like the source, the client is built on ONLY the `net` module (+ crypto for
// the WS handshake, fs/path/assert as plumbing). That is deliberate: the
// chunked-write test can split a request across two TCP packets — exactly the
// condition the from-scratch HTTP parser exists to handle.
//
// KEY ADAPTATION vs fs-forge: the isolated DB starts EMPTY (fs-forge seeds
// Alice/Bob/Carol + posts from data.seed.json). So this suite SEEDS via the
// API at the start and captures the returned ids, then uses those captured
// ids for the param-routing / CRUD assertions instead of hard-coded seed ids.

const net = require('net');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');

// Isolate this run from any real data file. Set the env var BEFORE requiring
// forge — the store reads it at module-load time. Reset the isolated file to
// empty every run so tests are deterministic.
const TEST_DB = path.join(__dirname, '.framework-db.json');
process.env.FS_FORGE_DB = TEST_DB;
try { fs.unlinkSync(TEST_DB); } catch {}

const forge = require('../src');

const PORT = 3519; // distinct from smoke.js (4399) and the live server (4300)
let passed = 0;

// Single-shot client: forces Connection: close so the server ends the socket
// and 'end' fires deterministically. The keep-alive/pipelining tests drive
// their own sockets and do NOT use this helper.
function request(raw, { chunk = false } = {}) {
  if (!/\r\nConnection:/i.test(raw)) {
    raw = raw.replace('\r\n\r\n', '\r\nConnection: close\r\n\r\n');
  }
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, '127.0.0.1');
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      if (chunk) {
        const mid = Math.floor(raw.length / 2);
        sock.write(raw.slice(0, mid));
        setTimeout(() => sock.write(raw.slice(mid)), 30);
      } else {
        sock.write(raw);
      }
    });
    sock.on('data', (d) => (buf = Buffer.concat([buf, d])));
    sock.on('end', () => {
      const text = buf.toString();
      const [head, ...rest] = text.split('\r\n\r\n');
      const statusLine = head.split('\r\n')[0];
      const status = parseInt(statusLine.split(' ')[1], 10);
      resolve({ status, head, body: rest.join('\r\n\r\n'), raw: text });
    });
    sock.on('error', reject);
  });
}

function GET(p, extra = '') {
  return request(`GET ${p} HTTP/1.1\r\nHost: x\r\n${extra}\r\n`);
}

// ---- WebSocket test client (raw net, like the rest of the suite) --------

// Mask a client text frame exactly as a browser would (RFC 6455 §5.3).
function maskTextFrame(text) {
  const data = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i & 3];
  const header = Buffer.alloc(2);
  header[0] = 0x81; // FIN + text
  header[1] = 0x80 | data.length; // mask bit + len (<126 in tests)
  return Buffer.concat([header, mask, masked]);
}

// Decode one UNMASKED server->client frame (the server never masks).
function decodeServerFrame(b) {
  if (b.length < 2) return null;
  const opcode = b[0] & 0x0f;
  let len = b[1] & 0x7f;
  let off = 2;
  if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (b.length < 10) return null; len = b.readUInt32BE(6); off = 10; }
  if (b.length < off + len) return null;
  return { opcode, payload: b.slice(off, off + len), rest: b.slice(off + len) };
}

// Open a WS connection, run `onReady(send, done)`; resolves with the array
// of decoded server text-frame strings once done() is called (or on timeout).
function wsSession(pathName, onReady, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(PORT, '127.0.0.1');
    let buf = Buffer.alloc(0);
    let phase = 'handshake';
    let acceptOk = false;
    const frames = [];
    const send = (text) => sock.write(maskTextFrame(text));
    const finish = () => { try { sock.end(); } catch {} resolve({ acceptOk, frames }); };
    const timer = setTimeout(finish, timeoutMs);

    sock.on('connect', () => {
      sock.write(
        `GET ${pathName} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n` +
        `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
        `Sec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (phase === 'handshake') {
        const i = buf.indexOf('\r\n\r\n');
        if (i === -1) return;
        const head = buf.slice(0, i).toString();
        const m = head.match(/sec-websocket-accept:\s*(.+)/i);
        const expected = require('../src/websocket').acceptKey(key);
        acceptOk = head.startsWith('HTTP/1.1 101') && !!m && m[1].trim() === expected;
        buf = buf.slice(i + 4);
        phase = 'ws';
        onReady(send, () => { clearTimeout(timer); finish(); });
      }
      for (;;) {
        const f = decodeServerFrame(buf);
        if (!f) break;
        buf = f.rest;
        if (f.opcode === 0x1) frames.push(f.payload.toString('utf8'));
      }
    });
    sock.on('error', reject);
  });
}

function check(name, cond) {
  assert.ok(cond, name);
  console.log(`  ok  ${name}`);
  passed++;
}

let app;
let symPath = null;     // static-escape symlink, tracked for cleanup
let builtSrcLink = null; // route-builder src symlink, tracked for cleanup

async function cleanup() {
  if (symPath) { try { fs.unlinkSync(symPath); } catch {} }
  if (builtSrcLink) { try { fs.unlinkSync(builtSrcLink); } catch {} }
  try { fs.unlinkSync(TEST_DB); } catch {}
}

(async () => {
  app = forge({
    routesDir: path.join(__dirname, 'fixtures', 'routes'),
    staticDir: path.join(__dirname, 'fixtures', 'public'),
  });
  await new Promise((r) => app.listen(PORT, r));

  try {
    // ===== SEED (adaptation: empty DB, so create the baseline users) =====
    // fs-forge seeds Alice/Bob/Carol from data.seed.json; we POST them and
    // capture their real ids. Every assertion that fs-forge expressed against
    // "seeded user 1 = Alice" is rewritten against a captured id.
    let res = await request('POST /api/users?name=Alice&role=admin HTTP/1.1\r\nHost: x\r\n\r\n');
    check('seed: POST /api/users (Alice) -> 201', res.status === 201);
    const alice = JSON.parse(res.body);
    res = await request('POST /api/users?name=Bob&role=member HTTP/1.1\r\nHost: x\r\n\r\n');
    const bob = JSON.parse(res.body);
    res = await request('POST /api/users?name=Carol&role=member HTTP/1.1\r\nHost: x\r\n\r\n');
    const carol = JSON.parse(res.body);
    check('seed: three users created with ids', Number.isInteger(alice.id) && Number.isInteger(bob.id) && Number.isInteger(carol.id));

    // 1. filesystem GET route + query echo
    res = await GET('/api/hello?name=tester');
    check('GET /api/hello -> 200', res.status === 200);
    check('hello echoes query', JSON.parse(res.body).you === 'tester');

    // 2. index route (routes/index.js -> /)
    res = await GET('/');
    check('GET / -> 200 (index.js)', res.status === 200);

    // 3. param route [id].js — a freshly-created user exists, 999 does not
    res = await GET('/api/users/' + alice.id);
    check('GET /api/users/:id -> 200 (created user)', res.status === 200);
    check('param id extracted', JSON.parse(res.body).id === alice.id);
    res = await GET('/api/users/999');
    check('GET /api/users/999 -> 404 (real store)', res.status === 404);

    // 4. real DELETE: create one, delete it, confirm it's gone
    res = await request('POST /api/users?name=ToDelete HTTP/1.1\r\nHost: x\r\n\r\n');
    const delId = JSON.parse(res.body).id;
    res = await request(`DELETE /api/users/${delId} HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('DELETE existing user -> 204', res.status === 204);
    res = await GET('/api/users/' + delId);
    check('deleted user is gone -> 404', res.status === 404);

    // 5. POST with JSON body persists into the real store
    const body = JSON.stringify({ name: 'Dave' });
    res = await request(
      `POST /api/users HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    );
    check('POST /api/users (json body) -> 201', res.status === 201);
    check('POST body parsed + stored', JSON.parse(res.body).name === 'Dave');

    // 6. 405 with Allow header — POST isn't supported on /api/users/:id
    res = await request(`POST /api/users/${alice.id} HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('POST /api/users/:id -> 405', res.status === 405);
    check('405 sets Allow header', /Allow: .*GET/i.test(res.head));

    // 7. unknown route -> 404
    res = await GET('/nope/nope');
    check('GET /nope/nope -> 404', res.status === 404);

    // 8. static file served
    res = await GET('/index.html');
    check('GET /index.html -> 200', res.status === 200);
    check('static sets text/html', /Content-Type: text\/html/i.test(res.head));
    check('static sets Cache-Control', /Cache-Control:\s*max-age=\d+/i.test(res.head));

    // 9. directory traversal blocked
    res = await GET('/../../../../etc/passwd');
    check('traversal -> 403/404', res.status === 403 || res.status === 404);
    check('traversal did not leak root', !/root:.*:0:0:/.test(res.body));

    // 10. chunked TCP write reassembled by parser
    const b2 = JSON.stringify({ name: 'Split' });
    res = await request(
      `POST /api/users HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(b2)}\r\n\r\n${b2}`,
      { chunk: true }
    );
    check('split-TCP POST -> 201', res.status === 201);
    check('split-TCP body intact', JSON.parse(res.body).name === 'Split');

    // 11. lenient request line: extra/multiple spaces tolerated
    res = await request('GET   /api/hello   HTTP/1.1\r\nHost: x\r\n\r\n');
    check('messy-whitespace request line -> 200', res.status === 200);

    // 12. unsupported HTTP version rejected
    res = await request('GET /api/hello HTTP/2.0\r\nHost: x\r\n\r\n');
    check('HTTP/2.0 -> 400', res.status === 400);

    // 13. encoded slash in a param does NOT merge path segments.
    //     /api/users/a%2Fb must hit [id] with id="a/b" (not /a/b as 404).
    res = await GET('/api/users/a%2Fb');
    check(
      'encoded-slash routed to [id] handler',
      res.status === 404 && /"id":\s*"a\/b"/.test(res.body)
    );

    // 14. DSL helpers: created() and noContent() against the real store.
    res = await request('POST /api/users?name=Helper HTTP/1.1\r\nHost: x\r\n\r\n');
    check('created() -> 201', res.status === 201);
    const helperId = JSON.parse(res.body).id;
    res = await request(`DELETE /api/users/${helperId} HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('noContent() -> 204', res.status === 204);

    // 15. HTTP/1.1 keep-alive: two requests on ONE socket.
    await new Promise((resolve, reject) => {
      const sock = net.connect(PORT, '127.0.0.1');
      let buf = Buffer.alloc(0);
      let seen = 0;
      const want = 'GET /api/hello HTTP/1.1\r\nHost: x\r\nConnection: keep-alive\r\n\r\n';
      sock.on('connect', () => sock.write(want));
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        const text = buf.toString();
        const responses = text.split('HTTP/1.1 ').filter(Boolean);
        if (responses.length > seen && /}\s*$/.test(text)) {
          seen = responses.length;
          if (seen === 1) {
            check('keep-alive: 1st response on shared socket', true);
            sock.write(want); // reuse the SAME connection
          } else if (seen === 2) {
            check('keep-alive: 2nd response on SAME socket', true);
            sock.end();
            resolve();
          }
        }
      });
      sock.on('error', reject);
      setTimeout(() => {
        if (seen < 2) reject(new Error('keep-alive: socket closed too early'));
      }, 3000);
    });

    // 16. Wire Inspector: UI page + snapshot captures real bytes.
    res = await GET('/_inspect');
    check('GET /_inspect -> 200', res.status === 200);
    check('inspector UI is html', /Wire Inspector/i.test(res.body));

    await GET('/api/hello?name=wiretest'); // generate traffic to capture
    res = await GET('/_inspect/snapshot');
    check('GET /_inspect/snapshot -> 200', res.status === 200);
    const snap = JSON.parse(res.body);
    const texts = snap.events.map((e) => e.text).join('\n');
    check('snapshot captured an inbound request line', /GET \/api\/hello/.test(texts));
    check('snapshot captured an outbound response', /HTTP\/1\.1 200 OK/.test(texts));
    const hello = snap.events.find((e) => /GET \/api\/hello/.test(e.text));
    check('app traffic is tagged scope=app', hello && hello.scope === 'app');
    const fw = snap.events.find((e) => /GET \/_routes/.test(e.text));
    check('framework traffic is tagged scope=framework', !fw || fw.scope === 'framework');

    // 17. Data Explorer: UI page + /_routes carries DSL hints + real CRUD
    res = await GET('/_data');
    check('GET /_data -> 200', res.status === 200);
    check('data UI is html', /Data Explorer/i.test(res.body));

    res = await GET('/_routes');
    const list = JSON.parse(res.body).routes.find((r) => r.path === '/api/users');
    check('/_routes exposes GET[list] hint', list && list.hints && list.hints.GET === 'list');
    check('/_routes exposes POST[create] hint', list && list.hints.POST === 'create');

    // Roundtrip: create -> list contains it -> update -> coercions -> delete
    res = await request('POST /api/users?name=Round HTTP/1.1\r\nHost: x\r\n\r\n');
    const sId = JSON.parse(res.body).id;
    res = await GET('/api/users');
    check('created row appears in collection',
      JSON.parse(res.body).some((u) => u.id === sId && u.name === 'Round'));
    res = await request(`PUT /api/users/${sId}?name=Rounded HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('PUT updated the row', JSON.parse(res.body).name === 'Rounded');
    res = await request(`PUT /api/users/${sId}?role=editor HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('PUT updates arbitrary field (role)', JSON.parse(res.body).role === 'editor');
    res = await request(`PUT /api/users/${sId}?age=32 HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('numeric field coerced to a number', JSON.parse(res.body).age === 32);
    res = await request(`PUT /api/users/${sId}?active=true HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('boolean field coerced to a boolean', JSON.parse(res.body).active === true);
    res = await request(`PUT /api/users/${sId}?name=Rounded007 HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('non-numeric value stays a string', JSON.parse(res.body).name === 'Rounded007');
    res = await request(`PATCH /api/users/${sId}?role=lead HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('PATCH /api/users/:id updates -> 200', res.status === 200 && JSON.parse(res.body).role === 'lead');
    res = await request(`DELETE /api/users/${sId} HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('DELETE returns 204', res.status === 204);
    res = await GET('/api/users/' + sId);
    check('row is gone after delete', res.status === 404);

    // 18. Wire Inspector replay
    await GET('/api/hello?name=replaytest');
    const snap2 = JSON.parse((await GET('/_inspect/snapshot')).body);
    const target = snap2.events.find(
      (e) => e.direction === 'in' && /GET \/api\/hello\?name=replaytest/.test(e.text)
    );
    check('captured request available for replay', !!target);
    const replayBody = JSON.stringify({ seq: target && target.seq });
    res = await request(
      `POST /_inspect/replay HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(replayBody)}\r\n\r\n${replayBody}`
    );
    check('POST /_inspect/replay -> 202', res.status === 202);
    await new Promise((r) => setTimeout(r, 250));
    const snap3 = JSON.parse((await GET('/_inspect/snapshot')).body);
    const after = snap3.events.filter(
      (e) => e.direction === 'in' && /GET \/api\/hello\?name=replaytest/.test(e.text)
    );
    check('replay produced a fresh capture', after.length >= 2);

    const unknownBody = '{"seq":99999}';
    res = await request(
      `POST /_inspect/replay HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(unknownBody)}\r\n\r\n${unknownBody}`
    );
    check('replay of unknown seq -> 404', res.status === 404);

    // Protocol Lab: POST /_inspect/send fires hand-edited raw bytes.
    async function labSend(rawBytes) {
      return request(
        `POST /_inspect/send HTTP/1.1\r\nHost: x\r\nContent-Type: application/octet-stream\r\nContent-Length: ${Buffer.byteLength(rawBytes)}\r\n\r\n${rawBytes}`
      );
    }
    res = await labSend('GET /api/users HTTP/1.1\r\nHost: localhost\r\n\r\n');
    check('lab send (valid) -> 202', res.status === 202);
    res = await labSend('GET /api/users HTTP/1.1\r\n\r\n'); // no Host
    check('lab send (no Host) -> 202 ack', res.status === 202);
    res = await labSend('');
    check('lab send (empty) -> 400', res.status === 400);
    await new Promise((r) => setTimeout(r, 250));
    const labSnap = JSON.parse((await GET('/_inspect/snapshot')).body);
    const outTexts = labSnap.events
      .filter((e) => e.direction === 'out')
      .map((e) => e.text)
      .join('\n');
    check('lab: valid bytes produced a 200 on the wire', /HTTP\/1\.1 200/.test(outTexts));
    check('lab: malformed bytes produced a 400 on the wire', /HTTP\/1\.1 400/.test(outTexts));

    // Route Builder: create a real route file from the API, call it, list it,
    // refuse to delete a hand-written route, then delete the built one.
    //
    // Adaptation: the builder writes a `require('../../src')` into the generated
    // file, a path computed RELATIVE to the routes dir being at the project root
    // (as in fs-forge). Here the routes dir is test/fixtures/routes, so from a
    // built file under .../routes/api/, `../../src` resolves to
    // test/fixtures/src. We bridge that with a temporary symlink to the real
    // src/, created just for this section and cleaned up after (and in cleanup()).
    builtSrcLink = path.join(__dirname, 'fixtures', 'src');
    try { fs.unlinkSync(builtSrcLink); } catch {}
    fs.symlinkSync(path.join(__dirname, '..', 'src'), builtSrcLink);
    const createBody = JSON.stringify({
      method: 'GET',
      path: '/api/_fw_built',
      template: 'json',
      value: '{"built":true}',
    });
    res = await request(
      `POST /_routes/create HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(createBody)}\r\n\r\n${createBody}`
    );
    check('route builder: create -> 201', res.status === 201);
    res = await GET('/api/_fw_built');
    check('built route is callable', res.status === 200 && /"built":\s*true/.test(res.body));
    res = await GET('/_routes');
    check('built route appears in /_routes', /\/api\/_fw_built/.test(res.body));
    res = await GET('/_routes/built');
    check('built route in the built list', /\/api\/_fw_built/.test(res.body));
    const delHand = JSON.stringify({ path: '/api/hello' });
    res = await request(
      `POST /_routes/delete HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(delHand)}\r\n\r\n${delHand}`
    );
    check('builder refuses to delete a hand-written route', res.status === 400);
    const delBody = JSON.stringify({ path: '/api/_fw_built' });
    res = await request(
      `POST /_routes/delete HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(delBody)}\r\n\r\n${delBody}`
    );
    check('route builder: delete -> 200', res.status === 200);
    res = await GET('/api/_fw_built');
    check('deleted built route is gone (404)', res.status === 404);
    check(
      'built route file removed from routes/',
      !fs.existsSync(path.join(__dirname, 'fixtures', 'routes', 'api', '_fw_built.js'))
    );
    try { fs.unlinkSync(builtSrcLink); } catch {}
    builtSrcLink = null;

    // ====== Spec-compliance hardening ===================================

    // HEAD fallback: HEAD on a GET-only route reuses GET, no body.
    res = await request('HEAD /api/hello HTTP/1.1\r\nHost: x\r\n\r\n');
    check('HEAD /api/hello -> 200', res.status === 200);
    check('HEAD has no body', res.body === '');
    check('HEAD sets Content-Length', /Content-Length:\s*\d+/i.test(res.head));

    // 204 No Content: body suppressed, no Content-Length per RFC 7230.
    res = await request('POST /api/users?name=TempDel HTTP/1.1\r\nHost: x\r\n\r\n');
    const tmpId = JSON.parse(res.body).id;
    res = await request(`DELETE /api/users/${tmpId} HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('DELETE -> 204', res.status === 204);
    check('204 has no body', res.body === '');
    check('204 has no Content-Length', !/Content-Length:/i.test(res.head));

    // Conflicting Content-Length headers -> 400 (request-smuggling guard).
    res = await request('POST /api/hello HTTP/1.1\r\nHost: x\r\nContent-Length: 3\r\nContent-Length: 5\r\n\r\nhello');
    check('conflicting Content-Length -> 400', res.status === 400);

    // Invalid Content-Length (non-numeric) -> 400.
    res = await request('POST /api/hello HTTP/1.1\r\nHost: x\r\nContent-Length: 5junk\r\n\r\nhello');
    check('non-numeric Content-Length -> 400', res.status === 400);

    // Transfer-Encoding: chunked -> rejected (we don't decode chunked).
    res = await request('POST /api/hello HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n');
    check('chunked transfer-encoding -> 400', res.status === 400);

    // Huge declared Content-Length -> 413 before buffering.
    const huge = (1024 * 1024 * 4).toString(); // 4 MiB > 1 MiB cap
    res = await request(`POST /api/hello HTTP/1.1\r\nHost: x\r\nContent-Length: ${huge}\r\n\r\n`);
    check('oversized Content-Length -> 413', res.status === 413);

    // Invalid JSON: body must be undefined (no fake {_raw,_error}), and a POST
    // that reads `body.name` falls back to `query.name` cleanly.
    const badJson = '{not valid json';
    res = await request(
      `POST /api/users?name=FromQuery HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(badJson)}\r\n\r\n${badJson}`
    );
    check('invalid JSON falls back to query -> 201', res.status === 201);
    const createdRow = JSON.parse(res.body);
    check(
      'invalid JSON did not contaminate row',
      !('_raw' in createdRow) && !('_error' in createdRow) && createdRow.name === 'FromQuery'
    );

    // Static-handler symlink escape: a symlink inside public/ pointing outside
    // the static root must be served as 403. Created at runtime, cleaned up.
    symPath = path.join(__dirname, 'fixtures', 'public', '__esc');
    try { fs.unlinkSync(symPath); } catch {}
    fs.symlinkSync('/etc/passwd', symPath);
    res = await GET('/__esc');
    try { fs.unlinkSync(symPath); } catch {}
    symPath = null;
    check('symlink escape -> 403', res.status === 403);
    check('symlink response did not leak /etc/passwd', !/root:.*:0:0:/.test(res.body));

    // Pipelining + async race: TWO complete requests in ONE chunk on ONE
    // keep-alive socket. The drain serializer must dispatch them in order.
    // (Adaptation: use two known existing user ids — alice & bob.)
    await new Promise((resolve, reject) => {
      const sock = net.connect(PORT, '127.0.0.1');
      let buf = '';
      sock.on('connect', () => {
        sock.write(
          `GET /api/users/${alice.id} HTTP/1.1\r\nHost: x\r\n\r\n` +
          `GET /api/users/${bob.id} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`
        );
      });
      sock.on('data', (d) => (buf += d.toString()));
      sock.on('end', () => {
        const i1 = buf.search(new RegExp(`"id":\\s*${alice.id}\\b`));
        const i2 = buf.search(new RegExp(`"id":\\s*${bob.id}\\b`));
        check('pipelined: both responses received', i1 >= 0 && i2 >= 0);
        check('pipelined: in-order response framing', i1 < i2);
        resolve();
      });
      sock.on('error', reject);
      setTimeout(() => reject(new Error('pipelined timeout')), 2500);
    });

    // 19. Reactive Data Explorer: SSE pushes store change events.
    await new Promise((resolve, reject) => {
      const sock = net.connect(PORT, '127.0.0.1');
      let buf = '';
      let helloSeen = false;
      sock.on('connect', () => {
        sock.write('GET /_data/events HTTP/1.1\r\nHost: x\r\nAccept: text/event-stream\r\n\r\n');
      });
      sock.on('data', (d) => {
        buf += d.toString();
        if (!helloSeen && /event: hello/.test(buf)) {
          helloSeen = true;
          check('/_data/events sends hello', true);
          const sock2 = net.connect(PORT, '127.0.0.1');
          sock2.on('connect', () =>
            sock2.write('POST /api/users?name=Reactive HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')
          );
          sock2.on('data', () => {});
          sock2.on('end', () => {});
        }
        if (helloSeen && /"kind":"insert"/.test(buf) && /"collection":"users"/.test(buf)) {
          check('/_data/events pushes insert change', true);
          sock.destroy();
          resolve();
        }
      });
      sock.on('error', reject);
      setTimeout(() => reject(new Error('reactive timeout')), 3000);
    });

    // The Wall: posts may only be created by an author that already exists in
    // the users collection (no-passwords identity gate). Alice was seeded.
    res = await request('POST /api/posts?author=Alice&title=hello HTTP/1.1\r\nHost: x\r\n\r\n');
    check('post by known author -> 201', res.status === 201);
    res = await request('POST /api/posts?author=alice&title=case HTTP/1.1\r\nHost: x\r\n\r\n');
    check('post author lookup is case-insensitive', res.status === 201);
    res = await request('POST /api/posts?author=Nobody&title=hi HTTP/1.1\r\nHost: x\r\n\r\n');
    check('unknown author -> 403', res.status === 403);
    check('403 body names the unknown author', /unknown author/i.test(res.body));
    res = await request('POST /api/posts?title=anon HTTP/1.1\r\nHost: x\r\n\r\n');
    check('missing author -> 400', res.status === 400);

    // Author gate at update: PUT cannot re-assign a post to an unknown user.
    // Create a real post first (capture its id) so the gate runs on a row.
    res = await request('POST /api/posts?author=Bob&title=gate HTTP/1.1\r\nHost: x\r\n\r\n');
    const postId = JSON.parse(res.body).id;
    res = await request(`PUT /api/posts/${postId}?author=GhostUser HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('PUT post with unknown author -> 403', res.status === 403);
    res = await request(`PUT /api/posts/${postId}?author=Carol HTTP/1.1\r\nHost: x\r\n\r\n`);
    check('PUT post with known author -> 200', res.status === 200 && JSON.parse(res.body).author === 'Carol');

    // Audit regression: RFC 7230 §5.4 Host rules.
    res = await request('GET /api/hello HTTP/1.1\r\n\r\n');
    check('HTTP/1.1 without Host -> 400', res.status === 400);
    res = await request('GET /api/hello HTTP/1.1\r\nHost: a\r\nHost: b\r\n\r\n');
    check('duplicate Host -> 400', res.status === 400);
    res = await request('GET /api/hello HTTP/1.0\r\n\r\n');
    check('HTTP/1.0 without Host -> 200 (Host optional in 1.0)', res.status === 200);

    // Connection parsed as comma-token list, not raw string.
    res = await request('GET /api/hello HTTP/1.1\r\nHost: x\r\nConnection: close, foo\r\n\r\n');
    check('Connection: "close, foo" honored as close', /Connection:\s*close/i.test(res.head));

    // User creation rejects empty names (would otherwise break the author gate).
    res = await request('POST /api/users?name= HTTP/1.1\r\nHost: x\r\n\r\n');
    check('user create with empty name -> 400', res.status === 400);

    // ---- WebSockets (from scratch, RFC 6455) -------------------------
    // A non-upgrade GET to a ws-only route is 426 Upgrade Required.
    res = await GET('/ws/echo');
    check('GET ws route without upgrade -> 426', res.status === 426);

    // Full handshake + echo round-trip over a raw socket.
    {
      const session = await wsSession('/ws/echo', (send, done) => {
        setTimeout(() => { send('hello penguin-forge'); setTimeout(done, 300); }, 150);
      });
      check('ws handshake: 101 + correct Sec-WebSocket-Accept', session.acceptOk);
      const t = session.frames.join('\n');
      // Adaptation: assert on type, not exact welcome text (fixture text differs).
      check('ws sends a welcome frame', /"type":"welcome"/.test(t));
      check('ws echoes a sent message', /"type":"echo".*hello penguin-forge/.test(t));
    }

    // The reactive store broadcasts over WS: a POST that mutates the store is
    // pushed to a live WS client as a `store` event.
    {
      const session = await wsSession('/ws/echo', (send, done) => {
        const wbody = JSON.stringify({ name: 'WsLive' });
        const c = net.connect(PORT, '127.0.0.1', () =>
          c.write(
            'POST /api/users HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\n' +
            `Content-Length: ${Buffer.byteLength(wbody)}\r\nConnection: close\r\n\r\n${wbody}`
          )
        );
        c.on('data', () => {});
        c.on('error', () => {});
        setTimeout(done, 500);
      });
      const t = session.frames.join('\n');
      check('ws receives live store change on POST', /"type":"store".*"collection":"users".*"kind":"insert"/.test(t));
    }

    console.log(`\n${passed} assertions passed`);
    await cleanup();
    app.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err && err.stack ? err.stack : err);
    await cleanup();
    try { app.close(); } catch {}
    process.exit(1);
  }
})();
