// Dark Matter rule-based scanner — standalone Chrome DevTools Protocol
// client (CDP authenticated-DOM-render lane, 8 Nov 2026).
//
// WHY A STANDALONE CLIENT: the scanner's dom-render phase renders pages
// with `chromium --dump-dom`, which cannot carry an authenticated
// session — DOM probes therefore never see post-login state. The
// human-mode browser tools (guiTools.js) already speak CDP, but they
// import huntRunner.js (container/exec machinery) and domRender.js
// deliberately refuses that import: pulling the hunt machinery into the
// probe path would drag the container/egress stack into every scan.
// This client is zero-dependency and imports NOTHING from the repo:
// it speaks CDP over the global fetch + WebSocket (Node >= 22, the
// backend runs Node 24) against a headless chromium started with
// --remote-debugging-port. The authenticated renderer
// (authDomRender.js) owns the browser lifecycle; this module owns
// only the protocol.
//
// PROTOCOL NOTES (Chrome DevTools Protocol, stable surface):
// - GET /json/version probes the endpoint (browser + protocol version).
// - PUT /json/new?about:blank creates a page target and returns its
//   webSocketDebuggerUrl. (GET also works on some builds; PUT is the
//   documented method.)
// - WebSocket frames are JSON-RPC-ish: {id, method, params} out,
//   {id, result} / {id, error} back, and {method, params} events
//   (no id) for Page.loadEventFired etc. send() resolves on the
//   matching id and rejects on a CDP error or a per-call timeout.
// - Session injection: Network.setCookie carries cookie sessions;
//   Page.addScriptToEvaluateOnNewDocument runs BEFORE any page
//   script, so a token written to localStorage there is present
//   when the SPA boots (Juice Shop reads its JWT from localStorage).
// - navigate() sends Page.navigate then waits for the load event —
//   a resolve on navigate alone only proves the command was accepted.
//
// FAIL-CLOSED: connectCdp never throws — it returns
// {ok:false, error}. Method calls throw Error on protocol errors;
// the caller (authDomRender) converts those to {ok:false} results
// so a dead browser can never break a scan. Every method honours
// its timeout; a hung browser is a failure, not a stall.

export const CDP_DEFAULT_TIMEOUT_MS = 20000;
export const CDP_NAVIGATE_TIMEOUT_MS = 15000;
export const CDP_LOAD_SETTLE_MS = 500;

/**
 * Open a CDP session against a remote-debugging endpoint
 * (http://127.0.0.1:PORT). Probes GET /json/version first: an
 * endpoint that does not answer is not a browser. Returns
 * {ok:true, client} or {ok:false, error}. Never throws.
 * deps.fetchFn defaults to the global fetch; deps.WebSocketCtor
 * defaults to the global WebSocket — both are seams for tests.
 */
export async function connectCdp(endpoint, opts = {}) {
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const WebSocketCtor =
    typeof opts.WebSocketCtor === 'function' ? opts.WebSocketCtor : globalThis.WebSocket;
  const base = String(endpoint || '').replace(/\/+$/, '');
  if (!base) return { ok: false, error: 'no cdp endpoint' };
  if (typeof fetchFn !== 'function') return { ok: false, error: 'no fetch available' };
  if (typeof WebSocketCtor !== 'function') return { ok: false, error: 'no WebSocket available' };
  try {
    const res = await fetchFn(`${base}/json/version`);
    if (!res || !res.ok) return { ok: false, error: `cdp version probe failed: HTTP ${res ? res.status : 'no response'}` };
    let info = null;
    try {
      info = await res.json();
    } catch {
      info = null;
    }
    return { ok: true, client: createCdpClient(base, { fetchFn, WebSocketCtor, timeoutMs: opts.timeoutMs }) };
  } catch (e) {
    return { ok: false, error: e && e.message ? String(e.message) : String(e) };
  }
}

function createCdpClient(base, { fetchFn, WebSocketCtor, timeoutMs }) {
  const defaultTimeout =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CDP_DEFAULT_TIMEOUT_MS;
  let ws = null;
  let seq = 0;
  const pending = new Map(); // id -> {res, rej, timer}
  const eventWaiters = new Map(); // method -> [ {res, timer} ]

  function failAll(error) {
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      pending.delete(id);
      p.rej(error);
    }
    for (const [method, list] of eventWaiters) {
      for (const w of list) {
        clearTimeout(w.timer);
        w.res(null);
      }
      eventWaiters.delete(method);
    }
  }

  function onMessage(ev) {
    let m = null;
    try {
      m = JSON.parse(String(ev && ev.data !== undefined ? ev.data : ev));
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.id !== undefined && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.error) p.rej(new Error(`CDP error: ${m.error.message || JSON.stringify(m.error)}`));
      else p.res(m.result !== undefined ? m.result : {});
      return;
    }
    if (typeof m.method === 'string' && eventWaiters.has(m.method)) {
      const list = eventWaiters.get(m.method);
      eventWaiters.delete(m.method);
      for (const w of list) {
        clearTimeout(w.timer);
        w.res(m.params || {});
      }
    }
  }

  function waitForEvent(method, ms) {
    return new Promise((res) => {
      const timer = setTimeout(() => {
        const list = eventWaiters.get(method) || [];
        const i = list.findIndex((w) => w.res === res);
        if (i >= 0) list.splice(i, 1);
        res(null);
      }, ms);
      const list = eventWaiters.get(method) || [];
      list.push({ res, timer });
      eventWaiters.set(method, list);
    });
  }

  const client = {
    endpoint: base,

    async version() {
      const res = await fetchFn(`${base}/json/version`);
      if (!res || !res.ok) throw new Error(`cdp version probe failed: HTTP ${res ? res.status : 'no response'}`);
      return res.json();
    },

    async newTarget(url) {
      const res = await fetchFn(`${base}/json/new?${encodeURIComponent(url || 'about:blank')}`, { method: 'PUT' });
      if (!res || !res.ok) throw new Error(`cdp new target failed: HTTP ${res ? res.status : 'no response'}`);
      const target = await res.json();
      if (!target || !target.webSocketDebuggerUrl) throw new Error('cdp new target returned no websocket URL');
      return target;
    },

    async attach(webSocketDebuggerUrl) {
      if (!webSocketDebuggerUrl) throw new Error('no websocket URL to attach to');
      if (ws) throw new Error('cdp client already attached');
      ws = new WebSocketCtor(webSocketDebuggerUrl);
      ws.onmessage = onMessage;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('CDP websocket connect timed out')), defaultTimeout);
        ws.onopen = () => {
          clearTimeout(timer);
          resolve();
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('CDP websocket failed'));
        };
      });
      ws.onclose = () => failAll(new Error('CDP websocket closed'));
      ws.onerror = () => failAll(new Error('CDP websocket error'));
      return true;
    },

    async send(method, params = {}, ms = defaultTimeout) {
      if (!ws) throw new Error('cdp client not attached');
      const id = ++seq;
      const payload = JSON.stringify({ id, method, params });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, ms);
        pending.set(id, { res: resolve, rej: reject, timer });
        try {
          ws.send(payload);
        } catch (e) {
          clearTimeout(timer);
          pending.delete(id);
          reject(e);
        }
      });
    },

    async evaluate(expression) {
      const r = await this.send('Runtime.evaluate', {
        expression: String(expression),
        returnByValue: true,
        awaitPromise: true,
      });
      if (r && r.exceptionDetails) {
        const d = r.exceptionDetails;
        const detail = (d.exception && d.exception.description) || d.text || 'evaluate failed';
        throw new Error(`page JS error: ${String(detail).slice(0, 300)}`);
      }
      return r && r.result ? r.result.value : undefined;
    },

    async setCookie(cookie) {
      const c = cookie || {};
      if (!c.name || c.value === undefined || c.value === null) {
        throw new Error('setCookie needs {name, value}');
      }
      const params = { name: String(c.name), value: String(c.value) };
      if (c.domain) params.domain = String(c.domain);
      if (c.path) params.path = String(c.path);
      if (c.secure !== undefined) params.secure = Boolean(c.secure);
      if (c.httpOnly !== undefined) params.httpOnly = Boolean(c.httpOnly);
      return this.send('Network.setCookie', params);
    },

    async addInitScript(source) {
      if (!source) throw new Error('addInitScript needs a source string');
      return this.send('Page.addScriptToEvaluateOnNewDocument', { source: String(source) });
    },

    async navigate(url, { timeoutMs = CDP_NAVIGATE_TIMEOUT_MS, settleMs = CDP_LOAD_SETTLE_MS } = {}) {
      if (!url) throw new Error('navigate needs a URL');
      const loadWait = waitForEvent('Page.loadEventFired', timeoutMs);
      await this.send('Page.navigate', { url: String(url) });
      await loadWait;
      if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));
      return true;
    },

    async outerHTML() {
      const html = await this.evaluate('document.documentElement.outerHTML');
      return typeof html === 'string' ? html : '';
    },

    async close() {
      try {
        if (ws) ws.close();
      } catch {
        // close is best-effort
      }
      ws = null;
      failAll(new Error('CDP client closed'));
    },
  };
  return client;
}
