'use strict';

// The creative API surface.
//
// A route file reads like the HTTP it serves. Methods are literal text;
// handlers are interpolated functions:
//
//   module.exports = http`
//     GET    ${({ params }) => json({ id: params.id })}
//     DELETE ${() => status(204)}
//   `;
//
// `http` is a tagged-template function. It receives the static string
// fragments and the interpolated handler functions in order, pairs each
// leading METHOD token with the handler that follows it, and returns a
// { GET, POST, ... } map the dispatcher can look methods up in.
//
// Handlers return a *descriptor* (built by the json/send/status/text/redirect
// helpers, or a bare value) — they never touch the socket. Keeping handlers
// pure is what makes a whole route fit on one readable line.

const HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

// ---- Response descriptor helpers -----------------------------------------
// Each returns a plain object the dispatcher knows how to flush. They are
// intentionally dumb and side-effect-free.

function json(data, code = 200) {
  return { kind: 'json', status: code, body: data };
}

function text(body, code = 200) {
  return { kind: 'text', status: code, body: String(body) };
}

function send(body, code = 200) {
  return { kind: 'send', status: code, body };
}

function html(body, code = 200) {
  return { kind: 'html', status: code, body: String(body) };
}

// status(204) -> empty body; status(201, json({...})) -> wrap & re-code.
function status(code, descriptor) {
  if (descriptor && typeof descriptor === 'object' && 'kind' in descriptor) {
    return { ...descriptor, status: code };
  }
  return { kind: 'send', status: code, body: descriptor };
}

function redirect(location, code = 302) {
  return { kind: 'redirect', status: code, location };
}

// Ergonomic shorthands so the common REST replies read as one word.
function created(body) {
  return { kind: 'json', status: 201, body };
}

function noContent() {
  return { kind: 'send', status: 204, body: undefined };
}

function notFound(body = { error: 'Not Found' }) {
  return { kind: 'json', status: 404, body };
}

// Stream a file from disk with the right MIME type (e.g. downloads).
function file(filePath, code = 200) {
  return { kind: 'file', status: code, path: filePath };
}

// ---- The tagged-template parser ------------------------------------------

function http(strings, ...handlers) {
  const routes = {};

  // strings[i] is the text that PRECEDES handlers[i]. The leading METHOD
  // token of that fragment names the handler that follows it. The final
  // strings entry is trailing whitespace with no handler — ignored.
  // Optional resource hints: `GET[list]`, `POST[create]`, `GET[item]`,
  // `PUT[update]`, `DELETE[remove]`. They don't change request handling —
  // they let the Data Explorer auto-discover which routes are a collection
  // vs. an item and what each method does, so the admin UI is generated,
  // not hardcoded. Collected under routes.__hints = { GET: 'list', ... }.
  const hints = {};

  for (let i = 0; i < handlers.length; i++) {
    const fragment = strings[i];
    const handler = handlers[i];

    const tokens = String(fragment).trim().split(/\s+/).filter(Boolean);
    const raw = tokens[tokens.length - 1] || '';
    const m = raw.match(/^([A-Za-z]+)(?:\[([a-z]+)\])?$/);
    const method = (m ? m[1] : raw).toUpperCase();
    const hint = m && m[2] ? m[2] : null;

    if (!method) {
      throw new Error(
        `http\`\`: handler #${i + 1} has no HTTP method in front of it`
      );
    }
    if (!HTTP_METHODS.has(method)) {
      throw new Error(`http\`\`: unknown HTTP method "${method}"`);
    }
    if (typeof handler !== 'function') {
      throw new Error(`http\`\`: ${method} is not followed by a function`);
    }
    if (routes[method]) {
      throw new Error(`http\`\`: ${method} declared twice in one route file`);
    }

    routes[method] = handler;
    if (hint) hints[method] = hint;
  }

  if (Object.keys(routes).length === 0) {
    throw new Error('http``: route file declares no methods');
  }

  // A marker so the loader can sanity-check what a route file exported.
  Object.defineProperty(routes, '__forgeRoute', { value: true });
  Object.defineProperty(routes, '__hints', { value: hints });
  return routes;
}

// ---- The WebSocket route tag ---------------------------------------------
//
// A WebSocket route reads as plainly as an HTTP one, but its handler takes a
// live connection rather than returning a descriptor — the two handler shapes
// are genuinely different, so WS gets its own tag instead of a pseudo-method
// inside http``:
//
//   module.exports = ws`${(socket) => {
//     socket.on('message', (msg) => socket.send('echo: ' + msg));
//   }}`;
//
// The handler is called once per upgraded connection with a WebSocketConnection
// (see websocket.js): .on('message'|'close'|'pong'), .send(), .ping(), .close().
function ws(strings, handler) {
  if (typeof handler !== 'function') {
    throw new Error('ws``: expected a single interpolated handler function');
  }
  const route = { handler };
  // Markers parallel to http``'s __forgeRoute so the loader/router can tell a
  // WS route from an HTTP one and the route table can label it.
  Object.defineProperty(route, '__forgeRoute', { value: true });
  Object.defineProperty(route, '__forgeWs', { value: true });
  return route;
}

// Coerce a flat object's string values to numbers/booleans when they
// round-trip cleanly. Query/form values always arrive as strings, so
// without this, editing a numeric field like `age` would silently store
// "32" instead of 32. Conservative: only convert when String(Number(v))
// === v (so "007", "3px", "1e999" stay strings) and exact "true"/"false".
function coerce(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== 'string') {
      out[k] = v;
      continue;
    }
    if (v === 'true') out[k] = true;
    else if (v === 'false') out[k] = false;
    else if (v !== '' && String(Number(v)) === v) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

module.exports = {
  http,
  ws,
  json,
  text,
  html,
  send,
  status,
  redirect,
  created,
  noContent,
  notFound,
  file,
  coerce,
  HTTP_METHODS,
};
