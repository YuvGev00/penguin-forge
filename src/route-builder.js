'use strict';

const fs = require('fs');
const path = require('path');

// The Route Builder — create and delete route files from the browser.
//
// This dramatizes the framework's core idea: the routes/ directory IS the
// API. The builder writes a real .js file into routes/; fs.watch +
// hot-reload then make the endpoint live with no restart, and it shows up
// in /_routes and the live console immediately.
//
// Safety model (this is a localhost dev tool, but still): we never write
// or eval user-supplied JavaScript. The handler body comes from a small
// set of vetted TEMPLATES; the only user input is the method, the URL
// path, and a short response value — all validated. Every file the
// builder writes carries a sentinel marker, and delete refuses to remove
// anything that lacks it, so the builder can only ever remove its own
// creations (never your hand-written routes).

const MARKER = '/* @fs-forge-built */';

// A URL path → a routes/ file path. Mirrors fs-router's mapping in reverse:
//   /            -> index.js              (refused: would clobber landing)
//   /api/ping    -> api/ping.js
//   /api/users   -> refused (exists, hand-written)
// Only [a-zA-Z0-9/_-] segments allowed; no params/catch-all from the UI to
// keep it simple and safe (no '[', ']', '.', '..').
function urlPathToFile(urlPath) {
  if (typeof urlPath !== 'string') return null;
  let p = urlPath.trim();
  if (!p.startsWith('/')) p = '/' + p;
  // Reject anything with traversal, params, dots, or weird chars.
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(p)) return null;
  if (p.includes('//')) return null;
  const segments = p.split('/').filter(Boolean);
  if (segments.length === 0) return null; // refuse '/' (the landing page)
  return segments.join('/') + '.js';
}

// Response templates. Each takes the user's `value` and returns the body
// of the route file's handler map (the http`` content). All values are
// JSON-encoded, so nothing the user types can break out into code.
const TEMPLATES = {
  // Static JSON: returns the same object every time.
  json: (method, value) => {
    let parsed;
    try {
      parsed = value ? JSON.parse(value) : { ok: true };
    } catch {
      parsed = { message: String(value) };
    }
    return `${method} \${() => json(${JSON.stringify(parsed)})}`;
  },
  // Plain text.
  text: (method, value) =>
    `${method} \${() => text(${JSON.stringify(String(value || 'hello from a built route'))})}`,
  // Echo: reflects the request's query + params back as JSON.
  echo: (method) =>
    `${method} \${({ query, params, method, path }) => json({ method, path, query, params })}`,
  // Bare status code, e.g. 204 / 418.
  status: (method, value) => {
    const code = Number(value) || 204;
    return `${method} \${() => status(${code})}`;
  },
};

function buildFileContents(method, template, value) {
  const make = TEMPLATES[template] || TEMPLATES.json;
  const line = make(method, value);
  return (
    MARKER +
    '\n' +
    "'use strict';\n" +
    "const { http, json, text, status } = require(@REQ@);\n" +
    'module.exports = http`\n  ' +
    line +
    '\n`;\n'
  );
}

function createRoute(root, { method, urlPath, template, value }) {
  const M = String(method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(M)) {
    return { error: 'unsupported method' };
  }
  const rel = urlPathToFile(urlPath);
  if (!rel) {
    return {
      error: 'invalid path',
      hint: 'use letters/numbers/-/_ and slashes, e.g. /api/ping',
    };
  }
  const abs = path.join(root, rel);
  // Double-check containment (defense in depth against any path trick).
  if (!abs.startsWith(root + path.sep)) {
    return { error: 'path escapes routes dir' };
  }
  if (fs.existsSync(abs)) {
    const existing = fs.readFileSync(abs, 'utf8');
    if (!existing.startsWith(MARKER)) {
      return {
        error: 'route already exists',
        hint: 'that path maps to a hand-written route file; pick another',
      };
    }
    // It's a previously-built file → overwriting is fine.
  }
  // Compute the require path from the file back to src/index.
  const depth = rel.split('/').length; // routes/<...>.js → segments incl file
  const up = '../'.repeat(depth); // from the file's dir up to project root
  const reqPath = `'${up}src'`;
  const contents = buildFileContents(M, template, value).replace('@REQ@', reqPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
  return { created: { method: M, path: '/' + rel.replace(/\.js$/, ''), file: rel } };
}

// List only builder-created routes (files carrying the marker).
function listBuilt(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.js')) {
        try {
          if (fs.readFileSync(full, 'utf8').startsWith(MARKER)) {
            const rel = path.relative(root, full).split(path.sep).join('/');
            out.push('/' + rel.replace(/\.js$/, '').replace(/\/index$/, '') || '/');
          }
        } catch {}
      }
    }
  };
  walk(root);
  return out;
}

// Delete a built route by URL path. Refuses unless the file carries the
// marker — so it can never remove a hand-written route.
function deleteRoute(root, urlPath) {
  const rel = urlPathToFile(urlPath);
  if (!rel) return { error: 'invalid path' };
  const abs = path.join(root, rel);
  if (!abs.startsWith(root + path.sep)) return { error: 'path escapes routes dir' };
  if (!fs.existsSync(abs)) return { error: 'no such route file' };
  const contents = fs.readFileSync(abs, 'utf8');
  if (!contents.startsWith(MARKER)) {
    return { error: 'refusing to delete a route the builder did not create' };
  }
  fs.unlinkSync(abs);
  return { deleted: { path: '/' + rel.replace(/\.js$/, ''), file: rel } };
}

module.exports = { MARKER, createRoute, deleteRoute, listBuilt, urlPathToFile };
