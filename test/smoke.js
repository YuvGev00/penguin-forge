'use strict';

// End-to-end smoke for penguin-forge: the game runs over fs-forge's
// from-scratch WebSocket, identity lands in the store, and chat broadcasts.
// Uses ONLY the net module as the client, like fs-forge's own suite.

const net = require('net');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

// Isolate from any real data.json. Set BEFORE requiring the store.
const TEST_DB = path.join(__dirname, '.smoke-db.json');
process.env.FS_FORGE_DB = TEST_DB;
try { fs.unlinkSync(TEST_DB); } catch {}

const forge = require('../src');
const { acceptKey } = require('../src/websocket');

const PORT = 4399;
let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  console.log(`  ok  ${name}`);
  passed++;
}

// ---- raw WS client helpers ----------------------------------------------
function maskTextFrame(text) {
  const data = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i & 3];
  // Lengths in this test are < 126; if longer, use the 16-bit form.
  let header;
  if (data.length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | data.length;
  } else {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  }
  header[0] = 0x81;
  return Buffer.concat([header, mask, masked]);
}
// Decode one UNMASKED server->client text frame.
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

// A live WS client: connects to /world, collects decoded text frames.
function wsClient() {
  const key = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(PORT, '127.0.0.1');
  const state = { acceptOk: false, frames: [], sock, ready: false };
  let buf = Buffer.alloc(0);
  let phase = 'hs';
  sock.on('connect', () => {
    sock.write(
      `GET /world HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n` +
      `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
      `Sec-WebSocket-Version: 13\r\n\r\n`
    );
  });
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    if (phase === 'hs') {
      const i = buf.indexOf('\r\n\r\n');
      if (i === -1) return;
      const head = buf.slice(0, i).toString();
      const m = head.match(/sec-websocket-accept:\s*(.+)/i);
      state.acceptOk = head.startsWith('HTTP/1.1 101') && !!m && m[1].trim() === acceptKey(key);
      buf = buf.slice(i + 4);
      phase = 'ws';
      state.ready = true;
    }
    for (;;) {
      const f = decodeServerFrame(buf);
      if (!f) break;
      buf = f.rest;
      if (f.opcode === 0x1) state.frames.push(f.payload.toString('utf8'));
    }
  });
  state.send = (obj) => sock.write(maskTextFrame(JSON.stringify(obj)));
  return state;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(25); }
  return false;
}

(async () => {
  const app = forge({
    routesDir: path.join(__dirname, '..', 'routes'),
    staticDir: path.join(__dirname, '..', 'public'),
  });
  await new Promise((r) => app.listen(PORT, r));

  try {
    // 1. Handshake.
    const a = wsClient();
    await until(() => a.ready);
    check('WS /world handshake: 101 + correct Sec-WebSocket-Accept', a.acceptOk);

    // 2. Join → server replies {t:'hello',id} and a penguin row appears in the store.
    a.send({ t: 'join', name: 'Pingu' });
    check('join → WS replies hello with an id', await until(() => a.frames.some((f) => /"t":"hello"/.test(f))));
    const rowAppeared = await until(async () => {
      const res = await httpGet('/api/penguins');
      return /"name":\s*"Pingu"/.test(res);
    }, 5000);
    check('join → penguin row persisted (GET /api/penguins shows Pingu)', rowAppeared);

    // 3. Chat broadcasts: a second client in the same room sees the first's chat.
    const b = wsClient();
    await until(() => b.ready);
    b.send({ t: 'join', name: 'Tux' });
    await wait(150); // let both settle in the spawn room
    a.send({ t: 'chat', text: 'hello-world-test' });
    const bGotChat = await until(() => b.frames.some((f) => /hello-world-test/.test(f)));
    check('chat from one client broadcasts to another (via snapshot)', bGotChat);

    // 4. Disconnect → the roster row is removed.
    a.sock.end();
    const rowGone = await until(async () => {
      const res = await httpGet('/api/penguins');
      return !/"name":\s*"Pingu"/.test(res);
    }, 3000);
    check('disconnect → penguin row removed from roster', rowGone);

    // 5. REST POST → spawns a LIVE penguin (appears in a connected client's snapshot).
    const watcherObserver = wsClient();
    await until(() => watcherObserver.ready);
    watcherObserver.send({ t: 'join', name: 'Observer' });
    await wait(150);
    const postRes = await httpReq('POST', '/api/penguins', { name: 'RestRex' });
    check('POST /api/penguins → 201', postRes.status === 201);
    const restId = JSON.parse(postRes.body).id;
    const spawnSeen = await until(() => watcherObserver.frames.some((f) => /"n":"RestRex"/.test(f)));
    check('POST-spawned penguin appears in a live snapshot', spawnSeen);

    // 6. REST PUT → renames the live penguin (snapshot reflects the new name).
    const putRes = await httpReq('PUT', '/api/penguins/' + restId, { name: 'RestRexx' });
    check('PUT /api/penguins/:id → 200', putRes.status === 200);
    const renameSeen = await until(() => watcherObserver.frames.some((f) => /"n":"RestRexx"/.test(f)));
    check('PUT renamed the live penguin in snapshots', renameSeen);

    // 7. REST DELETE → kicks a CONNECTED penguin: it gets {t:'kicked'} and its row is gone.
    const victim = wsClient();
    await until(() => victim.ready);
    victim.send({ t: 'join', name: 'Victim' });
    let victimId = null;
    await until(async () => {
      const list = JSON.parse(await httpGet('/api/penguins') || '[]');
      const row = list.find((p) => p.name === 'Victim');
      if (row) { victimId = row.id; return true; }
      return false;
    });
    const delRes = await httpReq('DELETE', '/api/penguins/' + victimId);
    check('DELETE /api/penguins/:id → 204', delRes.status === 204);
    const gotKicked = await until(() => victim.frames.some((f) => /"t":"kicked"/.test(f)));
    check('DELETE pushes {t:"kicked"} to the kicked player', gotKicked);
    const victimGone = await until(async () => !/"name":\s*"Victim"/.test(await httpGet('/api/penguins')));
    check('DELETE removed the kicked penguin from the roster', victimGone);

    // 8. Watcher mode: a {t:'watch'} client receives {t:'chatlog'} on any chat.
    const watch = wsClient();
    await until(() => watch.ready);
    watch.send({ t: 'watch' });
    await wait(100);
    watcherObserver.send({ t: 'chat', text: 'chatlog-test-line' });
    const chatlogSeen = await until(() => watch.frames.some((f) => /"t":"chatlog".*chatlog-test-line/.test(f)));
    check('watcher receives {t:"chatlog"} when a player chats', chatlogSeen);

    // 9. Admin announce from a watcher pops up for in-world players AND echoes
    //    into the watcher feed (as an 'admin' chatlog).
    watch.send({ t: 'announce', text: 'announce-test-line' });
    const playerGotAnnounce = await until(() =>
      watcherObserver.frames.some((f) => /"t":"announce".*announce-test-line/.test(f)));
    check('admin {t:"announce"} pops up for in-world players', playerGotAnnounce);
    const watcherGotAdminLog = await until(() =>
      watch.frames.some((f) => /"t":"chatlog".*"name":"admin".*announce-test-line/.test(f)));
    check('admin announce echoes into the watcher chat feed', watcherGotAdminLog);

    // 10. Duplicate name: a second join with a taken name (case-insensitive) is
    //     rejected with {t:'nameTaken'} and adds no penguin.
    const dup = wsClient();
    await until(() => dup.ready);
    dup.send({ t: 'join', name: 'OBSERVER' }); // 'Observer' already joined above
    const dupRejected = await until(() => dup.frames.some((f) => /"t":"nameTaken"/.test(f)));
    check('duplicate name (case-insensitive) is rejected', dupRejected);

    watcherObserver.sock.end(); victim.sock.end(); watch.sock.end(); dup.sock.end();
    b.sock.end();
    console.log(`\n${passed} assertions passed`);
    app.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err && err.message);
    app.close();
    process.exit(1);
  }
})();

// Tiny HTTP GET over net (no http module — same spirit as fs-forge tests).
function httpGet(p) {
  return httpReq('GET', p).then((r) => r.body);
}

// Generic HTTP request over net; resolves { status, body }.
function httpReq(method, p, jsonBody) {
  return new Promise((resolve, reject) => {
    const s = net.connect(PORT, '127.0.0.1');
    let buf = '';
    const body = jsonBody != null ? JSON.stringify(jsonBody) : '';
    let head = `${method} ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n`;
    if (body) head += `Content-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n`;
    head += '\r\n';
    s.on('connect', () => s.write(head + body));
    s.on('data', (d) => (buf += d.toString()));
    s.on('end', () => {
      const status = parseInt((buf.split('\r\n')[0] || '').split(' ')[1], 10);
      resolve({ status, body: buf.split('\r\n\r\n').slice(1).join('\r\n\r\n') });
    });
    s.on('error', reject);
  });
}
