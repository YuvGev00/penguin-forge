'use strict';

// Penguin World — authoritative multi-room world model.
//
// The server owns positions: clients send a *target* ("walk here") and the
// server moves each penguin toward it at a fixed speed every tick. Every
// client just renders server snapshots (interpolated), so nobody can desync
// or teleport. Rooms are isolated: you only see/he­ar penguins in YOUR room.
//
// Transport-agnostic on purpose (no socket code) so it is unit-testable.

const WORLD = { w: 1200, h: 720 };
const SPEED = 165; // px / second a penguin walks
const ARRIVE = 6; // px — close enough = arrived
const CHAT_MS = 6000; // how long a chat bubble lives

// Room layout. Room travel is now done with PORTALS: every door is a `soft`
// step-on zone (walk your penguin onto it and you travel — same feel as the
// arcade cabinets). Portal zones are positioned over the matching feature in
// each room's painted background (public/bg/<room>.png). Each room's `spawn`
// is kept clear of all its own portal zones so arriving never re-triggers a
// portal. Zones are given as top-left {x,y,w,h} on the 1200x720 world.
const ROOMS = {
  plaza: {
    name: 'Town Plaza',
    bg: '#1a2740',
    doors: [
      // On the gold star on the ARCADE facade.
      { x: 600, y: 300, w: 130, h: 130, to: 'arcade', label: '🕹 Arcade', soft: true },
      // The UNIVERSITY building doors (right).
      { x: 896, y: 295, w: 130, h: 130, to: 'university', label: '🎓 University', soft: true },
      // The TIMES/KARNAF café entrance (left, nudged right toward the seating).
      { x: 255, y: 326, w: 130, h: 130, to: 'cafe', label: '☕ Café', soft: true },
    ],
    spawn: { x: 600, y: 650 },
  },
  cafe: {
    name: 'Cozy Café',
    bg: '#2a1f2e',
    doors: [
      // The door directly under the green EXIT sign.
      { x: 492, y: 210, w: 120, h: 130, to: 'plaza', label: '← Plaza', soft: true },
    ],
    spawn: { x: 540, y: 560 },
  },
  // ---- The Gothic University: an entrance hall that branches into two
  // study rooms.
  university: {
    name: 'Gothic University — Great Hall',
    bg: '#1d1a2e',
    doors: [
      // The big central UNIVERSITY HALL doors → back to the plaza.
      { x: 540, y: 270, w: 120, h: 130, to: 'plaza', label: '↓ Plaza', soft: true },
      // The door under the graduation-cap emblem (right) → Lab.
      { x: 845, y: 240, w: 120, h: 130, to: 'lab', label: '🔬 Lab', soft: true },
      // The door under the open-book emblem (left) → Library.
      { x: 224, y: 240, w: 120, h: 130, to: 'library', label: '📚 Library', soft: true },
    ],
    spawn: { x: 560, y: 560 },
  },
  lab: {
    name: 'University — Lab & Classroom',
    bg: '#16201f',
    doors: [
      // The wooden door on the left → back to the Hall.
      { x: 45, y: 320, w: 120, h: 130, to: 'university', label: 'Hall →', soft: true },
    ],
    spawn: { x: 600, y: 540 },
    cabinets: [
      // Step onto the lab console (right side) to open the Python Code Lab.
      // Clear of the spawn (center-bottom) and the Hall door (left).
      { id: 'pc', game: 'class', label: '💻 Code Lab',
        zone: { x: 840, y: 300, w: 140, h: 140 } },
    ],
  },
  library: {
    name: 'University — Library',
    bg: '#221c14',
    doors: [
      // The silver door at the top of the staircase (top-right) → Hall.
      { x: 876, y: 110, w: 120, h: 120, to: 'university', label: '← Hall', soft: true },
    ],
    spawn: { x: 640, y: 600 },
    cabinets: [
      // The reading nook at the base of the ladder (left).
      { id: 'shelf', game: 'book', label: '📖 Bookshelf',
        zone: { x: 276, y: 430, w: 130, h: 130 } },
    ],
  },
  arcade: {
    name: 'Arcade',
    bg: '#0f1f2e',
    doors: [
      // The stairs by the right wall → back to the plaza.
      { x: 1055, y: 445, w: 130, h: 130, to: 'plaza', label: 'Plaza →', soft: true },
    ],
    spawn: { x: 600, y: 540 },
    // Cabinets: walk onto the chair in front of a machine to play.
    cabinets: [
      // The chair in front of the DRAWING GAME cabinet (left).
      { id: 'draw', game: 'draw', label: '🎨 Draw & Guess',
        zone: { x: 180, y: 358, w: 130, h: 130 } },
      // The black chair at the REACTION GAME / ASTRO-BARRIER machine (upper-right).
      { id: 'duel', game: 'duel', label: '⚡ Reaction Duel',
        zone: { x: 815, y: 265, w: 130, h: 130 } },
    ],
  },
};

const COLORS = [
  '#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b',
  '#cc5de8', '#ff922b', '#22d3ee', '#f783ac',
];

let _seq = 0;

class World {
  constructor() {
    this.players = new Map(); // id -> player
  }

  rooms() { return ROOMS; }

  // Look up a cabinet definition by id across all rooms.
  cabinet(cabId) {
    for (const r of Object.values(ROOMS)) {
      for (const c of r.cabinets || []) if (c.id === cabId) return c;
    }
    return null;
  }

  playerName(id) {
    const p = this.players.get(id);
    return p ? p.name : 'penguin';
  }

  addPlayer(id, name) {
    const color = COLORS[_seq++ % COLORS.length];
    const room = 'plaza';
    const sp = ROOMS[room].spawn;
    const p = {
      id,
      name: String(name || 'penguin').slice(0, 14).trim() || 'penguin',
      color,
      room,
      x: sp.x + (Math.random() * 60 - 30),
      y: sp.y + (Math.random() * 40 - 20),
      tx: sp.x, ty: sp.y, // movement target
      facing: 1, // 1 = right, -1 = left
      chat: null, chatUntil: 0,
      cabinet: null, // arcade cabinet id the penguin is standing in
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (p && p.cabinet && this._onCabinet) {
      this._onCabinet(id, null, p.cabinet); // leave any cabinet game
    }
    this.players.delete(id);
  }

  // Client asked to walk somewhere (clamped to the room).
  setTarget(id, x, y) {
    const p = this.players.get(id);
    if (!p) return;
    p.tx = clamp(+x || 0, 24, WORLD.w - 24);
    p.ty = clamp(+y || 0, 70, WORLD.h - 24);
  }

  // "Leave game": snap the penguin back to ITS CURRENT room's spawn
  // (authoritative — always clear of that room's cabinet zones, unlike a
  // hardcoded client coordinate which could land back inside a zone).
  sendToSpawn(id) {
    const p = this.players.get(id);
    if (!p) return;
    const sp = (ROOMS[p.room] && ROOMS[p.room].spawn) || { x: 600, y: 560 };
    p.x = sp.x; p.y = sp.y;
    p.tx = sp.x; p.ty = sp.y;
  }

  chat(id, text) {
    const p = this.players.get(id);
    if (!p) return null;
    const msg = String(text || '').slice(0, 120).trim();
    if (!msg) return null;
    p.chat = msg;
    p.chatUntil = Date.now() + CHAT_MS;
    return { id, name: p.name, room: p.room, text: msg };
  }

  // Move everyone toward their target; handle door transitions.
  step(dt) {
    for (const p of this.players.values()) {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > ARRIVE) {
        const step = Math.min(dist, SPEED * dt);
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        if (Math.abs(dx) > 2) p.facing = dx < 0 ? -1 : 1;
      }
      if (p.chat && Date.now() > p.chatUntil) p.chat = null;

      // Door check. A door only triggers when the player deliberately
      // walked INTO it — i.e. both their position AND their chosen target
      // are inside the door zone. This makes doors intentional ("click the
      // door to enter") instead of accidental trip-wires you cross while
      // walking past.
      for (const d of ROOMS[p.room].doors) {
        const inDoor = (px, py) =>
          px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h;
        // `soft` doors (building entrances): just stepping into the pad
        // takes you in. Normal edge doors require BOTH position and the
        // chosen target inside, so you don't get yanked walking past.
        const trip = d.soft
          ? inDoor(p.x, p.y)
          : inDoor(p.x, p.y) && inDoor(p.tx, p.ty);
        if (trip) {
          this._enterRoom(p, d.to);
          break;
        }
      }

      // Cabinet membership: which arcade cabinet (if any) is this penguin
      // standing in? Transitions fire onCabinet(playerId, cabId|null).
      let nowCab = null;
      const cabs = (ROOMS[p.room].cabinets) || [];
      for (const cab of cabs) {
        const z = cab.zone;
        if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) {
          nowCab = cab.id;
          break;
        }
      }
      if (nowCab !== p.cabinet) {
        const oldCab = p.cabinet;
        p.cabinet = nowCab;
        if (this._onCabinet) this._onCabinet(p.id, nowCab, oldCab);
      }
    }
  }

  onCabinet(fn) { this._onCabinet = fn; }

  _enterRoom(p, room) {
    if (p.cabinet && this._onCabinet) {
      this._onCabinet(p.id, null, p.cabinet);
    }
    p.cabinet = null;
    p.room = room;
    const sp = ROOMS[room].spawn;
    p.x = sp.x; p.y = sp.y;
    p.tx = sp.x; p.ty = sp.y;
    p.chat = null;
  }

  // Snapshot of just one room (players only see their own room).
  snapshotFor(room) {
    const here = [];
    for (const p of this.players.values()) {
      if (p.room !== room) continue;
      here.push({
        id: p.id, n: p.name, c: p.color,
        x: Math.round(p.x), y: Math.round(p.y),
        f: p.facing,
        m: p.chat || null,
        cab: p.cabinet || null,
      });
    }
    return {
      t: 'snap',
      room,
      roomName: ROOMS[room].name,
      bg: ROOMS[room].bg,
      doors: ROOMS[room].doors,
      cabinets: ROOMS[room].cabinets || [],
      world: WORLD,
      players: here,
    };
  }

  // Set of rooms that currently have someone in them (for tick efficiency).
  activeRooms() {
    const s = new Set();
    for (const p of this.players.values()) s.add(p.room);
    return s;
  }

  roomOf(id) {
    const p = this.players.get(id);
    return p ? p.room : null;
  }

  countByRoom() {
    const c = {};
    for (const r of Object.keys(ROOMS)) c[r] = 0;
    for (const p of this.players.values()) c[p.room]++;
    return c;
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

module.exports = { World, ROOMS, WORLD };
