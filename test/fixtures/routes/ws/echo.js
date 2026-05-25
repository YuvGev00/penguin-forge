'use strict';

// WebSocket fixture: echoes text frames (prefixed) and forwards every store
// mutation over the same socket — exercises the from-scratch RFC 6455
// handshake, frame codec, and the reactive change bus. Mirrors fs-forge's
// routes/ws/echo.js.
const { ws } = require('../../../../src');
const { changes } = require('../../../../src/store');

module.exports = ws`${(socket) => {
  socket.send(JSON.stringify({ type: 'welcome', text: 'connected to fixture ws' }));

  socket.on('message', (msg, isBinary) => {
    if (isBinary) { socket.send(msg); return; }
    socket.send(JSON.stringify({ type: 'echo', text: msg }));
  });

  const onChange = (e) => socket.send(JSON.stringify({ type: 'store', change: e }));
  changes.on('change', onChange);
  socket.on('close', () => changes.off('change', onChange));
}}`;
