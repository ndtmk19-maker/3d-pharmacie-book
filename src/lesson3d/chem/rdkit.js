// RDKit (WebAssembly) is large, so it loads only when a generated lesson needs it.
let ready = null;
export function loadRDKit() {
  ready ??= (async () => {
    const [mod, { default: wasmUrl }] = await Promise.all([
      import('@rdkit/rdkit'),
      import('@rdkit/rdkit/RDKit_minimal.wasm?url'),
    ]);
    const factory = mod.default ?? mod ?? window.initRDKitModule;
    return factory({ locateFile: () => wasmUrl });
  })();
  return ready;
}
