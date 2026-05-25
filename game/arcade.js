'use strict';

// Arcade — the two playable cabinets. Each cabinet runs an isolated game
// whose players are exactly the penguins currently standing in its zone
// (managed by world.onCabinet). Transport-agnostic: games emit events via
// a single broadcast callback; the server relays them to that cabinet's
// members only.

// ---------------- Draw & Guess ----------------
const WORDS = [
  'fish', 'igloo', 'snowball', 'pizza', 'rocket', 'guitar', 'cat',
  'house', 'star', 'boat', 'tree', 'crown', 'robot', 'ghost', 'sun',
];
const DRAW_ROUND_MS = 60000;

class DrawGame {
  constructor(emit) {
    this.emit = emit; // (event) -> broadcast to this cabinet's members
    this.players = new Map(); // id -> {id,name,score}
    this.order = [];
    this.drawerIdx = -1;
    this.word = null;
    this.active = false;
    this.endsAt = 0;
    this.guessed = new Set();
    this.ops = [];
  }
  add(id, name) {
    this.players.set(id, { id, name, score: 0 });
    this.order.push(id);
    this.emit({ t: 'players', players: this.pub() });
    if (!this.active && this.players.size >= 2) this.start();
    else this.emit({ t: 'state', ...this.state(id), _to: id });
  }
  remove(id) {
    this.players.delete(id);
    const was = this.drawerId() === id;
    this.order = this.order.filter((x) => x !== id);
    if (this.drawerIdx >= this.order.length) this.drawerIdx = 0;
    this.emit({ t: 'players', players: this.pub() });
    if (this.players.size < 2) { this.active = false; this.word = null; }
    else if (was && this.active) this.start();
  }
  drawerId() { return this.order[this.drawerIdx] || null; }
  pub() {
    return [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, score: p.score,
      drawing: p.id === this.drawerId(),
    }));
  }
  state(id) {
    return {
      active: this.active, drawerId: this.drawerId(),
      drawerName: (this.players.get(this.drawerId()) || {}).name || null,
      youDraw: id === this.drawerId(),
      word: id === this.drawerId() ? this.word : null,
      wordLen: this.word ? this.word.length : 0,
      endsAt: this.endsAt, players: this.pub(),
    };
  }
  start() {
    if (this.players.size < 2) return;
    this.drawerIdx = (this.drawerIdx + 1) % this.order.length;
    this.word = WORDS[(Math.random() * WORDS.length) | 0];
    this.active = true;
    this.endsAt = Date.now() + DRAW_ROUND_MS;
    this.guessed = new Set();
    this.ops = [];
    this.emit({ t: 'clear' });
    this.emit({ t: 'sys', text: `New round — ${(this.players.get(this.drawerId()) || {}).name} draws!` });
    for (const pid of this.players.keys())
      this.emit({ t: 'state', ...this.state(pid), _to: pid });
  }
  // Full op set (ported from the standalone game): stroke (with brush
  // width + eraser), flood fill, undo (rebroadcasts the whole log so every
  // client rebuilds exactly), and clear. Drawer-only, mid-round only.
  op(id, op) {
    if (id !== this.drawerId() || !this.active) return;
    if (!op || typeof op !== 'object') return;
    if (op.t === 'stroke') {
      const s = op.s || op; // accept {t:'stroke',s:{…}} or a flat stroke
      const clean = {
        t: 'stroke',
        x0: +s.x0, y0: +s.y0, x1: +s.x1, y1: +s.y1,
        c: typeof s.c === 'string' ? s.c.slice(0, 9) : '#111',
        w: Math.min(60, Math.max(1, +s.w || 4)),
        erase: !!s.erase,
      };
      if ([clean.x0, clean.y0, clean.x1, clean.y1].some(Number.isNaN)) return;
      this.ops.push(clean);
      if (this.ops.length > 4000) this.ops.shift();
      this.emit({ t: 'op', op: clean });
    } else if (op.t === 'fill') {
      const clean = { t: 'fill', c: typeof op.c === 'string' ? op.c.slice(0, 9) : '#111' };
      this.ops.push(clean);
      this.emit({ t: 'op', op: clean });
    } else if (op.t === 'undo') {
      if (this.ops.length) {
        this.ops.pop();
        this.emit({ t: 'replace', ops: this.ops });
      }
    } else if (op.t === 'clear') {
      this.ops = [];
      this.emit({ t: 'clear' });
    }
  }
  guess(id, text) {
    const p = this.players.get(id);
    if (!p) return;
    const g = String(text || '').trim();
    if (!g) return;
    if (this.active && this.word && id !== this.drawerId() && !this.guessed.has(id) &&
        g.toLowerCase() === this.word.toLowerCase()) {
      this.guessed.add(id);
      const pts = 100 + Math.max(0, Math.round((this.endsAt - Date.now()) / 600));
      p.score += pts;
      const d = this.players.get(this.drawerId());
      if (d) d.score += 30;
      this.emit({ t: 'sys', text: `🎉 ${p.name} guessed it! (+${pts})` });
      this.emit({ t: 'players', players: this.pub() });
      if (this.guessed.size >= this.players.size - 1) {
        this.active = false;
        this.emit({ t: 'sys', text: `Word was "${this.word}"` });
        clearTimeout(this._roundTimer);
        this._roundTimer = setTimeout(() => this.start(), 3000);
      }
      return;
    }
    this.emit({ t: 'chat', name: p.name, text: g });
  }
  tick() {
    if (this.active && Date.now() >= this.endsAt) {
      this.active = false;
      this.emit({ t: 'sys', text: `Time! Word was "${this.word}"` });
      clearTimeout(this._roundTimer);
      this._roundTimer = setTimeout(() => this.start(), 3000);
    }
  }
  // Clear any pending round timer so an emptied cabinet leaves nothing behind.
  destroy() {
    clearTimeout(this._roundTimer);
    this._roundTimer = null;
  }
  snapshotFor(id) {
    return { t: 'state', ...this.state(id), replay: this.ops };
  }
}

// ---------------- Reaction Duel ----------------
// Everyone waits; after a random delay the screen flashes GO — first to
// press wins the round. False-starts are penalised. First to 3 wins.
class DuelGame {
  constructor(emit) {
    this.emit = emit;
    this.players = new Map(); // id -> {id,name,wins}
    this.phase = 'idle'; // idle | arming | go | done
    this.goAt = 0;
    this.winnerThisRound = null;
  }
  add(id, name) {
    this.players.set(id, { id, name, wins: 0 });
    this.emit({ t: 'duel', ...this.state() });
    if (this.phase === 'idle' && this.players.size >= 2) this.arm();
  }
  remove(id) {
    this.players.delete(id);
    if (this.players.size < 2) {
      this.phase = 'idle';
      // Drop below two players mid-round: cancel any pending GO / next-round
      // timer so it can't fire into an empty (or stale) cabinet later.
      clearTimeout(this._goTimer);
      clearTimeout(this._nextTimer);
      this._goTimer = this._nextTimer = null;
    }
    this.emit({ t: 'duel', ...this.state() });
  }
  state() {
    return {
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, wins: p.wins,
      })),
      winner: this.winnerThisRound,
    };
  }
  arm() {
    this.phase = 'arming';
    this.winnerThisRound = null;
    this.emit({ t: 'duel', ...this.state() });
    this._goTimer = setTimeout(() => {
      this.phase = 'go';
      this.goAt = Date.now();
      this.emit({ t: 'duel', ...this.state() });
    }, 1500 + Math.random() * 3500);
  }
  press(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === 'arming') {
      // false start — that player loses the round
      clearTimeout(this._goTimer);
      this.phase = 'done';
      this.winnerThisRound = { name: p.name, false: true };
      this.emit({ t: 'sys', text: `🚫 ${p.name} jumped early!` });
      this.emit({ t: 'duel', ...this.state() });
      this._next();
    } else if (this.phase === 'go' && !this.winnerThisRound) {
      const ms = Date.now() - this.goAt;
      p.wins++;
      this.phase = 'done';
      this.winnerThisRound = { name: p.name, ms };
      this.emit({ t: 'sys', text: `⚡ ${p.name} won in ${ms}ms!` });
      this.emit({ t: 'duel', ...this.state() });
      if (p.wins >= 3) {
        this.emit({ t: 'sys', text: `🏆 ${p.name} wins the match!` });
        for (const q of this.players.values()) q.wins = 0;
      }
      this._next();
    }
  }
  _next() {
    clearTimeout(this._nextTimer);
    this._nextTimer = setTimeout(() => {
      if (this.players.size >= 2) this.arm();
      else { this.phase = 'idle'; this.emit({ t: 'duel', ...this.state() }); }
    }, 2500);
  }
  tick() {}
  // Cancel both timers so an emptied cabinet leaves nothing scheduled.
  destroy() {
    clearTimeout(this._goTimer);
    clearTimeout(this._nextTimer);
    this._goTimer = this._nextTimer = null;
  }
  snapshotFor() { return { t: 'duel', ...this.state() }; }
}

// ---------------- Book Room (shared reading + marginalia) ----------------
// Upper bound on distinct book#page note keys held in memory at once.
const BOOK_MAX_KEYS = 500;
class BookRoom {
  constructor(emit) {
    this.emit = emit;
    this.members = new Map(); // id -> name
    this.notes = {};          // 'bookId#pageIndex' -> [{name,text}]
  }
  add(id, name) {
    this.members.set(id, name);
    this.emit({ t: 'bookstate', members: [...this.members.values()], _to: id });
  }
  remove(id) {
    this.members.delete(id);
    this.emit({ t: 'bookstate', members: [...this.members.values()] });
  }
  note(id, m) {
    const name = this.members.get(id) || 'penguin';
    const book = String(m.book || '').slice(0, 40);
    const page = parseInt(m.page, 10);
    if (!book || isNaN(page) || page < 0) return;
    const text = String(m.text || '').replace(/[\r\n]/g, ' ').slice(0, 140).trim();
    if (!text) return;
    const key = `${book}#${page}`;
    if (!this.notes[key]) {
      // Cap the number of distinct note keys so a client can't grow the map
      // without bound by posting to endless fabricated book#page combos.
      // Evict the oldest key (insertion order) once we'd exceed the limit.
      const keys = Object.keys(this.notes);
      if (keys.length >= BOOK_MAX_KEYS) delete this.notes[keys[0]];
      this.notes[key] = [];
    }
    if (this.notes[key].length >= 30) this.notes[key].shift();
    this.notes[key].push({ name, text });
    this.emit({ t: 'notes', key, notes: this.notes[key].slice() });
  }
  peek(id, m) {
    const book = String(m.book || '').slice(0, 40);
    const page = parseInt(m.page, 10);
    if (!book || isNaN(page) || page < 0) return;
    const key = `${book}#${page}`;
    this.emit({ t: 'notes', key, notes: (this.notes[key] || []).slice(), _to: id });
  }
  tick() {}
  destroy() {} // no timers to clear
  snapshotFor(id) {
    return { t: 'bookstate', members: [...this.members.values()], _to: id };
  }
}


const GAMES = { draw: DrawGame, duel: DuelGame, book: BookRoom };

// One Arcade instance manages every cabinet's game.
class Arcade {
  constructor(send) {
    this.send = send; // (playerId, msgString) -> deliver to that client
    this.cabs = new Map(); // cabId -> { game, members:Set }
  }
  _cab(cabId, gameKey) {
    if (this.cabs.has(cabId)) return this.cabs.get(cabId);
    const entry = { members: new Set(), game: null };
    const emit = (ev) => {
      const { _to, ...payload } = ev;
      const msg = JSON.stringify({ t: 'cab', cab: cabId, ev: payload });
      if (_to) { if (entry.members.has(_to)) this.send(_to, msg); }
      else for (const m of entry.members) this.send(m, msg);
    };
    entry.game = new GAMES[gameKey](emit);
    this.cabs.set(cabId, entry);
    return entry;
  }
  // Penguin entered a cabinet zone.
  join(cabId, gameKey, id, name) {
    const c = this._cab(cabId, gameKey);
    c.members.add(id);
    c.game.add(id, name);
    // hand the joiner an immediate snapshot of the game
    this.send(id, JSON.stringify({
      t: 'cab', cab: cabId, ev: c.game.snapshotFor(id),
    }));
  }
  leave(cabId, id) {
    const c = this.cabs.get(cabId);
    if (!c) return;
    c.members.delete(id);
    c.game.remove(id);
    // When the last penguin leaves a cabinet, tear the game down: clear its
    // pending timers and drop the entry so `cabs` doesn't accumulate dead
    // games (and tick() doesn't keep stepping them). BookRoom is exempt — its
    // margin notes are shared marginalia meant to persist between visitors.
    if (c.members.size === 0 && !(c.game instanceof BookRoom)) {
      c.game.destroy();
      this.cabs.delete(cabId);
    }
  }
  input(cabId, id, m) {
    const c = this.cabs.get(cabId);
    if (!c) return;
    const g = c.game;
    if (m.kind === 'op') g.op && g.op(id, m.op);
    else if (m.kind === 'guess') g.guess && g.guess(id, m.text);
    else if (m.kind === 'press') g.press && g.press(id);
    else if (m.kind === 'note') g.note && g.note(id, m);
    else if (m.kind === 'peek') g.peek && g.peek(id, m);
  }
  tick() { for (const c of this.cabs.values()) c.game.tick(); }
}

module.exports = { Arcade, DrawGame, DuelGame, BookRoom, WORDS };
