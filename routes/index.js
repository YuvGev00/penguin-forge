'use strict';

const fs = require('fs');
const path = require('path');
const { http, html } = require('../src');

// The HUB landing page (/): introduces the project and links to the game
// (/play), the framework showcase (/forge), and the dashboards. Served fresh
// per request so edits to public/index.html show on refresh, no restart.
const PAGE_PATH = path.join(__dirname, '..', 'public', 'index.html');

module.exports = http`
  GET ${() => html(fs.readFileSync(PAGE_PATH, 'utf8'))}
`;
