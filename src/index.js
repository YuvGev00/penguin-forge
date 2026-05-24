'use strict';

const path = require('path');
const { createNetServer } = require('./net-server');
const { createFsRouter } = require('./fs-router');
const { createDispatcher } = require('./dispatch');
const { createInspector } = require('./inspector');
const serveStatic = require('./static');
const dsl = require('./dsl');

// forge({ routesDir, staticDir }) -> { listen(port, cb) }
//
// Wires the reused net/HTTP plumbing to the filesystem router + DSL. The
// developer never registers a route by hand: the routes/ tree IS the API.
function forge(options = {}) {
  const routesDir = path.resolve(options.routesDir || 'routes');
  const staticDir = options.staticDir
    ? path.resolve(options.staticDir)
    : null;

  const router = createFsRouter(routesDir);
  const staticMiddleware = staticDir ? serveStatic(staticDir) : null;
  // The wire inspector taps raw socket bytes; opt out with inspect:false.
  const inspector =
    options.inspect === false ? null : createInspector();
  // Make the inspector reachable to route handlers (penguin-forge surfaces
  // game events into the wire feed). No behavior change otherwise.
  require('./runtime').setInspector(inspector);
  const dispatch = createDispatcher(router, staticMiddleware, inspector);
  const server = createNetServer(dispatch, { inspector });

  return {
    router,
    listen(port, callback) {
      server.listen(port, () => {
        console.log(`[fs-forge] listening on http://localhost:${port}`);
        for (const r of router.list()) {
          console.log(`  ${r.methods.join(',').padEnd(12)} ${r.path}`);
        }
        const base = `http://localhost:${port}`;
        console.log(`  landing + console -> ${base}/`);
        console.log(`  data explorer     -> ${base}/_data`);
        if (inspector) {
          console.log(`  wire inspector    -> ${base}/_inspect`);
        }
        if (callback) callback();
      });
      return this;
    },
    close() {
      router.close();
      server.close();
    },
  };
}

// Re-export the DSL so route files can `require('../src')` (or the package).
module.exports = Object.assign(forge, dsl, { forge });
