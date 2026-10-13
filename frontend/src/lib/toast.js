// Minimal toast bus: toast(message, kind) emits; <ToastHost/> renders.
const listeners = new Set();

export function toast(message, kind = 'info') {
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message, kind };
  listeners.forEach((fn) => fn(entry));
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
