'use strict';

// A tiny runtime holder so route handlers can reach framework internals that
// aren't part of the (req,res)/connection surface — currently just the wire
// inspector, so a route can surface a readable event line into /_inspect.
//
// This is the one penguin-forge addition to the vendored fs-forge src/: it
// does not change any existing behavior (the inspector is created and used
// exactly as before), it only makes the already-created instance reachable.

let inspector = null;

module.exports = {
  setInspector(i) {
    inspector = i;
  },
  getInspector() {
    return inspector;
  },
};
