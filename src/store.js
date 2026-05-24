'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Process-wide change bus. Anyone (the Data Explorer's SSE endpoint, in
// our case) subscribes here to be notified of every insert/update/remove
// across every collection — the entire framework becomes "reactive" with
// no per-resource wiring.
const changes = new EventEmitter();
changes.setMaxListeners(0);

// A tiny JSON-file-backed collection store. Zero dependencies. State lives
// in data.json so it survives hot reload (which clears the require cache)
// AND server restarts — that is what makes the Data Explorer feel live.
//
// Shape on disk:  { "users": [ {id, ...}, ... ], "<collection>": [...] }
//
// Concurrency: every operation is synchronous (readFileSync → modify →
// writeFileSync + rename) so a single Node process cannot interleave two
// writes — the event loop is blocked until each completes. This is the
// simplest correct design for a demo store. A multi-process deployment
// would need a lockfile; we explicitly don't support that here.
//
// Writes are atomic (write a temp file, then rename) so a crash mid-write
// can't corrupt the database.

// Override-able via FS_FORGE_DB so the smoke suite can point at an
// isolated file (e.g. test/.tmp-db.json) instead of polluting the demo
// data.json that the running server shares with the user.
const DB_PATH =
  process.env.FS_FORGE_DB || path.join(__dirname, '..', 'data.json');
const SEED_PATH = path.join(__dirname, '..', 'data.seed.json');

// data.json is the live (gitignored) database; on first run it is seeded
// from the committed data.seed.json so a fresh clone has demo data and
// `rm data.json` resets the demo to a known state.
function ensureSeeded() {
  if (fs.existsSync(DB_PATH)) return;
  try {
    fs.copyFileSync(SEED_PATH, DB_PATH);
  } catch {
    fs.writeFileSync(DB_PATH, '{}');
  }
}

// In-process read cache: keyed by mtimeMs of DB_PATH. Reads return the
// cached parse if the file hasn't changed on disk since the last load.
// Invalidated on every writeAll, and survives the case where someone
// edits data.json by hand (mtime changes, cache misses, fresh parse).
let _cached = null;
let _cachedMtime = -1;

function readAll() {
  ensureSeeded();
  let mtime = -1;
  try {
    mtime = fs.statSync(DB_PATH).mtimeMs;
  } catch {
    /* fall through to fresh read */
  }
  if (_cached && mtime === _cachedMtime) return _cached;
  try {
    _cached = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    _cachedMtime = mtime;
    return _cached;
  } catch {
    return {};
  }
}

function writeAll(db) {
  const tmp = DB_PATH + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_PATH); // atomic on the same filesystem
    // Prime the cache with what we just wrote.
    _cached = db;
    _cachedMtime = fs.statSync(DB_PATH).mtimeMs;
  } catch (err) {
    // Write failed — discard the cache so readers get a fresh disk read
    // rather than the (now-divergent) in-memory copy.
    _cached = null;
    _cachedMtime = -1;
    throw err;
  }
}

// One handle per collection name. Ids are monotonic integers.
function collection(name) {
  const load = () => {
    const db = readAll();
    if (!Array.isArray(db[name])) db[name] = [];
    return db;
  };

  return {
    all() {
      return load()[name];
    },

    get(id) {
      return load()[name].find((r) => String(r.id) === String(id)) || null;
    },

    insert(record) {
      const db = load();
      const rows = db[name];
      const nextId =
        rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
      const row = { id: nextId, ...record };
      rows.push(row);
      writeAll(db);
      changes.emit('change', { collection: name, kind: 'insert', row });
      return row;
    },

    // Replace the mutable fields of a record (id is preserved). Returns the
    // updated row, or null if not found.
    update(id, patch) {
      const db = load();
      const rows = db[name];
      const i = rows.findIndex((r) => String(r.id) === String(id));
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...patch, id: rows[i].id };
      writeAll(db);
      changes.emit('change', { collection: name, kind: 'update', row: rows[i] });
      return rows[i];
    },

    remove(id) {
      const db = load();
      const rows = db[name];
      const i = rows.findIndex((r) => String(r.id) === String(id));
      if (i === -1) return false;
      const [row] = rows.splice(i, 1);
      writeAll(db);
      changes.emit('change', { collection: name, kind: 'remove', row });
      return true;
    },
  };
}

module.exports = { collection, changes };
