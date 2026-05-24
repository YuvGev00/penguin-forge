'use strict';

// The penguin world, as an fs-forge WebSocket route.
//
// This is the only transport-coupled file in the game (it replaces
// penguin-world's standalone server.js). The game logic — World, Arcade —
// is pure and unchanged in game/. This file:
//   1. runs the authoritative 20 Hz world loop and fans out per-room
//      snapshots over fs-forge WebSocket connections,
//   2. writes penguin IDENTITY (name / room) into fs-forge's store, so the
//      live roster shows up in the Data Explorer (/_data) — but NEVER the
//      20 Hz position stream (that stays in memory),
//   3. surfaces meaningful events (join / chat / room change / leave, and the
//      REST-driven spawn / rename / kick) into the Wire Inspector (/_inspect),
//   4. registers a control API on game/hub.js so the REST routes
//      (/api/penguins) can spawn / rename / kick LIVE penguins,
//   5. serves "watcher" clients (the /forge chat panel) a live chat feed.
//
// The route path is /world (routes/world.js → /world), which the client
// (public/app.js → new WebSocket('ws://'+host+'/world')) already targets.

const { ws } = require('../src');
const { collection } = require('../src/store');
const { getInspector } = require('../src/runtime');
const hub = require('../game/hub');
const { World } = require('../game/world');
const { Arcade } = require('../game/arcade');

// ---- Module-level singletons (this file is loaded once) ------------------
const penguins = collection('penguins');
const world = new World();
const clients = new Map(); // id -> { conn, storeId, lastRoom }  (conn may be null for REST-spawned)
const watchers = new Set(); // chat-only connections (the /forge panel)
let nextId = 1;

// Arcade delivers a message string to one player's socket.
const arcade = new Arcade((playerId, msg) => {
  const c = clients.get(playerId);
  if (c && c.conn) c.conn.send(msg);
});

// Walking into / out of a cabinet zone joins/leaves its mini-game.
world.onCabinet((playerId, newCab, oldCab) => {
  if (oldCab) arcade.leave(oldCab, playerId);
  if (newCab) {
    const cab = world.cabinet(newCab);
    if (cab) arcade.join(newCab, cab.game, playerId, world.playerName(playerId));
  }
});

// Surface a readable line into the Wire Inspector's live feed. connId is the
// penguin id (p1, p2, …); scope 'app' so it shows in the default view. The
// 20 Hz snapshot stream is NOT fed here — only discrete, meaningful events.
function wire(playerId, text) {
  const insp = getInspector();
  if (insp) insp.inbound(playerId, `GAME ${playerId} ${text}\r\n`, 'app');
}

// Broadcast a chat line to every watcher (the /forge chat panel). Dead
// sockets are pruned lazily on their own close handler.
function broadcastChat(name, room, text) {
  const line = JSON.stringify({ t: 'chatlog', name, room, text, ts: Date.now() });
  for (const w of watchers) {
    try { w.send(line); } catch { /* pruned on close */ }
  }
}

// Map a store row id (what /_data + the REST API expose) to the live game pid.
function pidForStoreId(storeId) {
  const sid = Number(storeId);
  for (const [pid, c] of clients) {
    if (c.storeId === sid) return pid;
  }
  return null;
}

// ---- The control API the REST routes call (via game/hub.js) --------------
hub.setApi({
  // Spawn a LIVE penguin with no socket. It exists in world.players (so it
  // walks and appears in everyone's snapshots) and in the roster, but we
  // never try to .send() to it (guarded below).
  spawn(name) {
    const clean = String(name || '').slice(0, 24).trim();
    if (!clean) return null;
    const id = 'p' + nextId++;
    world.addPlayer(id, clean);
    const room = world.roomOf(id);
    const row = penguins.insert({ pid: id, name: clean, room, joinedAt: Date.now() });
    clients.set(id, { conn: null, storeId: row.id, lastRoom: room });
    wire(id, `spawned via REST as "${clean}" in ${room}`);
    return { id: row.id, pid: id, name: clean, room };
  },

  rename(storeId, name) {
    const pid = pidForStoreId(storeId);
    if (!pid) return null;
    const clean = String(name || '').slice(0, 24).trim();
    if (!clean) return null;
    const p = world.players.get(pid);
    if (p) p.name = clean;
    const row = penguins.update(Number(storeId), { name: clean });
    wire(pid, `renamed via REST to "${clean}"`);
    return row;
  },

  kick(storeId, reason) {
    const pid = pidForStoreId(storeId);
    if (!pid) return false;
    const c = clients.get(pid);
    const msg = String(reason || 'You were kicked from the world.');
    if (c && c.conn) {
      try { c.conn.send(JSON.stringify({ t: 'kicked', reason: msg })); } catch { /* */ }
      try { c.conn.close(); } catch { /* */ }
    }
    if (c && c.storeId != null) penguins.remove(c.storeId);
    clients.delete(pid);
    world.removePlayer(pid);
    wire(pid, `kicked via REST (${msg})`);
    return true;
  },

  list() {
    return penguins.all();
  },
});

// ---- The authoritative loop (20 Hz) --------------------------------------
// Guarded against double-firing if fs.watch hot-reloads this route file.
const HZ = 20;
if (globalThis.__pfWorldLoop) clearInterval(globalThis.__pfWorldLoop);
let last = Date.now();
globalThis.__pfWorldLoop = setInterval(() => {
  try {
    const now = Date.now();
    const dt = Math.min(0.1, (now - last) / 1000) || 1 / HZ;
    last = now;
    world.step(dt);
    arcade.tick();

    // Persist room changes (identity-level, low-frequency) — never per-tick
    // positions. Diff each client's room against the last one we recorded.
    for (const [pid, c] of clients) {
      const room = world.roomOf(pid);
      if (room && room !== c.lastRoom) {
        c.lastRoom = room;
        if (c.storeId != null) penguins.update(c.storeId, { room });
        wire(pid, `→ entered ${room}`);
      }
    }

    if (!clients.size) return;
    // Build each active room's snapshot once; send to that room's members.
    const active = world.activeRooms();
    const snaps = {};
    for (const r of active) {
      const s = world.snapshotFor(r);
      s.population = world.countByRoom();
      snaps[r] = JSON.stringify(s);
    }
    for (const [pid, c] of clients) {
      // Conn-less (REST-spawned) penguins are rendered by everyone else but
      // have no socket to receive on — skip delivery, don't crash.
      if (!c.conn) continue;
      const room = world.roomOf(pid);
      if (room && snaps[room]) c.conn.send(snaps[room]);
    }
  } catch (err) {
    console.error('[penguin-forge tick] uncaught', err);
  }
}, 1000 / HZ);

// ---- Per-connection handler ----------------------------------------------
module.exports = ws`${(conn) => {
  // A connection announces itself with its first message: {t:'join'} makes a
  // real penguin; {t:'watch'} is a chat-only watcher (the /forge panel). We
  // don't know which yet, so reserve an id lazily on join.
  let id = null;
  let isWatcher = false;

  conn.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'watch') {
      isWatcher = true;
      watchers.add(conn);
      conn.send(JSON.stringify({ t: 'watching' }));
      return;
    }

    if (m.t === 'say') {
      // A watcher posting into the chat (no avatar). Broadcast to watchers and
      // surface on the wire. (Not attached to a world penguin, so no bubble.)
      const name = String(m.name || 'guest').slice(0, 24).trim() || 'guest';
      const text = String(m.text || '').slice(0, 120).trim();
      if (!text) return;
      broadcastChat(name, 'forge', text);
      wire('forge', `say "${name}": ${text}`);
      return;
    }

    if (m.t === 'join') {
      if (id) return; // already joined on this socket
      id = 'p' + nextId++;
      clients.set(id, { conn, storeId: null, lastRoom: null });
      conn.send(JSON.stringify({ t: 'hello', id }));
      const name = String(m.name || 'penguin').slice(0, 24);
      world.addPlayer(id, name);
      const room = world.roomOf(id);
      const row = penguins.insert({ pid: id, name, room, joinedAt: Date.now() });
      const c = clients.get(id);
      if (c) { c.storeId = row.id; c.lastRoom = room; }
      wire(id, `joined as "${name}" in ${room}`);
      return;
    }

    if (!id) return; // the rest require a joined penguin

    if (m.t === 'move') {
      world.setTarget(id, m.x, m.y); // positions stay in memory only
    } else if (m.t === 'chat') {
      world.chat(id, m.text); // bubble shows via the next snapshot
      const text = String(m.text || '').slice(0, 80);
      broadcastChat(world.playerName(id), world.roomOf(id), text);
      wire(id, `chat: ${text}`);
    } else if (m.t === 'leave') {
      world.sendToSpawn(id);
    } else if (m.t === 'cab') {
      const p = world.players.get(id);
      if (p && p.cabinet) arcade.input(p.cabinet, id, m);
    }
  });

  conn.on('close', () => {
    if (isWatcher) { watchers.delete(conn); return; }
    if (!id) return; // connected but never joined
    const c = clients.get(id);
    if (c && c.storeId != null) penguins.remove(c.storeId); // roster row gone
    wire(id, 'left');
    clients.delete(id);
    world.removePlayer(id); // also fires onCabinet leave if seated
  });
}}`;
