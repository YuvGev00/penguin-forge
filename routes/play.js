'use strict';

const fs = require('fs');
const path = require('path');
const { http, html } = require('../src');

// The penguin game page (served fresh per request so edits show on refresh).
// Its client scripts (/app.js, /game.js, /penguin.js, /books.js) are served
// by the static middleware and connect to the /world WebSocket on load.
const PAGE_PATH = path.join(__dirname, '..', 'public', 'game.html');

module.exports = http`
  GET ${() => html(fs.readFileSync(PAGE_PATH, 'utf8'))}
`;
