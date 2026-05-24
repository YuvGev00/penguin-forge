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

// Room layout. Doors are rectangles; stepping into one moves you to the
// linked room, arriving at that room's matching entry point.
const ROOMS = {
  plaza: {
    name: 'Town Plaza',
    bg: '#1a2740',
    // Side doors hug the screen edges (outer 64px). The University stands
    // in the plaza; its entrance is a wide doorway at the BASE of the
    // building (on the snow, where penguins actually walk) so you can
    // waddle straight up into it.
    doors: [
      { x: 1136, y: 290, w: 64, h: 150, to: 'cafe', label: '☕ Café' },
      { x: 0, y: 290, w: 64, h: 150, to: 'arcade', label: '🕹 Arcade' },
      // Entrance threshold right under the arch — `soft` so simply
      // stepping onto it enters (no precise click needed), but kept
      // narrow & high so diagonal paths to the side doors don't cross
      // it. Centred on the building (x=600).
      { x: 552, y: 392, w: 96, h: 150, to: 'university',
        label: '🎓 University', soft: true },
    ],
    // Spawn well below & away from the entrance threshold so returning
    // from the university never re-triggers it.
    spawn: { x: 600, y: 660 },
  },
  cafe: {
    name: 'Cozy Café',
    bg: '#2a1f2e',
    doors: [
      { x: 0, y: 290, w: 64, h: 150, to: 'plaza', label: '← Plaza' },
    ],
    spawn: { x: 260, y: 420 },
  },
  // ---- The Gothic University: an entrance hall that branches into two
  // study rooms. Mirrors the arcade/cafe pattern; props/activities for
  // the sub-rooms come later.
  university: {
    name: 'Gothic University — Great Hall',
    bg: '#1d1a2e',
    doors: [
      { x: 528, y: 624, w: 144, h: 96, to: 'plaza', label: '↓ Plaza' },
      { x: 0, y: 290, w: 64, h: 150, to: 'lab', label: '🔬 Lab' },
      { x: 1136, y: 290, w: 64, h: 150, to: 'library', label: '📚 Library' },
    ],
    spawn: { x: 600, y: 480 },
  },
  lab: {
    name: 'University — Lab & Classroom',
    bg: '#16201f',
    doors: [
      { x: 1136, y: 290, w: 64, h: 150, to: 'university',
        label: 'Hall →' },
    ],
    spawn: { x: 300, y: 460 },
    // The Python "Class Console" cabinet was removed in penguin-forge to keep
    // the project pure-Node (no python3 dependency); the lab remains as an
    // explorable study room.
    cabinets: [],
  },
  library: {
    name: 'University — Library',
    bg: '#221c14',
    doors: [
      { x: 0, y: 290, w: 64, h: 150, to: 'university', label: '← Hall' },
    ],
    spawn: { x: 900, y: 460 },
    cabinets: [
      { id: 'shelf', game: 'book', label: '📖 Bookshelf',
        zone: { x: 520, y: 470, w: 160, h: 120 } },
    ],
  },
  arcade: {
    name: 'Arcade',
    bg: '#0f1f2e',
    doors: [
      { x: 1136, y: 290, w: 64, h: 150, to: 'plaza', label: 'Plaza →' },
    ],
    spawn: { x: 600, y: 560 },
    // Cabinets: walk a penguin into the zone to play that game. The
    // players of a cabinet's game are exactly the penguins standing in it.
    cabinets: [
      { id: 'draw', game: 'draw', label: '🎨 Draw & Guess',
        zone: { x: 175, y: 360, w: 130, h: 150 } },
      { id: 'duel', game: 'duel', label: '⚡ Reaction Duel',
        zone: { x: 895, y: 360, w: 130, h: 150 } },
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
