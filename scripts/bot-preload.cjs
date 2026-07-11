// Patch Bun's __importDefault behavior to handle CJS modules that
// already expose a .default property. Specifically, the debug@4.x
// module exports a function with extra properties; agent-base calls
// __importDefault(require("debug")).default(...) which fails under Bun
// because Bun's __importDefault returns the module as-is (which has
// .default = function as a property).
//
// Fix: monkey-patch debug's exports so it works both as a function
// and as { default: function }.
const path = require("path");
const Module = require("module");

const origRequire = Module.prototype.require;
Module.prototype.require = function patchedRequire(id) {
  const result = origRequire.call(this, id);
  // If debug is being required, ensure .default works
  if (id === "debug" && typeof result === "function") {
    // debug@4.x is a function with named exports — should work as-is
    // but Bun's __importDefault may not unwrap it correctly.
    // Make sure result.default is the function itself.
    if (!result.default) {
      result.default = result;
    }
  }
  return result;
};

console.log("✅ bot-preload: debug CJS interop shim loaded");
