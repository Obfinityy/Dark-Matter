// Module-resolution hook for frontend unit tests under plain node --test.
//
// Vite resolves extensionless relative imports ('../config'); Node ESM
// does not. This hook retries a failed relative resolution with '.js'
// appended, so frontend ESM modules can be imported in node tests
// without a bundler. Registered by api.startHunt.test.js via
// module.register(); it changes nothing in the app itself.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}
