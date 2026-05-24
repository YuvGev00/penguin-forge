'use strict';

// penguin-forge entry point. The penguin game runs as a WebSocket route
// (routes/world.js) on top of the vendored fs-forge framework, so the
// framework's own surfaces double as the game's control room:
//   /          → the hub (links to the game + the framework showcase)
//   /play      → the multiplayer penguin game (over the /world WebSocket)
//   /forge     → the framework showcase + a live chat on the same socket
//   /_data     → live penguin roster (the store)
//   /_inspect  → the wire: handshake + game events (join/chat/room/leave)

const path = require('path');
const forge = require('./src');

const PORT = process.env.PORT || 4300;

forge({
  routesDir: path.join(__dirname, 'routes'),
  staticDir: path.join(__dirname, 'public'),
}).listen(PORT, () => {
  console.log(`\n  🐧  penguin-forge — open http://localhost:${PORT}/ in a few tabs`);
  console.log(`      roster  → http://localhost:${PORT}/_data`);
  console.log(`      wire    → http://localhost:${PORT}/_inspect\n`);
});
