'use strict';

const fs = require('fs');
const path = require('path');
const { http, html } = require('../src');

// fs-forge's own framework showcase: the route table, live API console, DSL
// sample, Route Builder, a live chat (over the /world WebSocket), and the
// dashboard cards (/_data, /_inspect). Served fresh per request.
const PAGE_PATH = path.join(__dirname, '..', 'public', 'forge.html');

module.exports = http`
  GET ${() => html(fs.readFileSync(PAGE_PATH, 'utf8'))}
`;
