/**
 * node-resolve-hooks.mjs — TEST-ONLY ESM resolve hook.
 *
 * Why this exists: frontend/src/services/vmRunnerApi.js imports
 * './vmEndpoint' WITHOUT a file extension. Vite resolves that fine, but
 * plain node ESM does not, so `node --test` fails with ERR_MODULE_NOT_FOUND
 * before any test runs. (The owning workstream can delete this hook by
 * adding the missing `.js` extension to that import.)
 *
 * This hook maps exactly that one specifier to ./vmEndpoint.js and leaves
 * every other resolution untouched, so the tests still exercise the REAL
 * vmRunnerApi.js file.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && specifier === './vmEndpoint') {
      // parentURL is .../services/vmRunnerApi.js, so './vmEndpoint.js' stays
      // in the same directory.
      return {
        url: new URL('./vmEndpoint.js', context.parentURL).href,
        shortCircuit: true,
      };
    }
    throw err;
  }
}
