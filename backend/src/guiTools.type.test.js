// GUI type-target (28 Oct 2026) — the live DVWA login failure.
//
// The parent brain typed 'admin' then 'password' with no field
// target; the driver put both into the username field (first visible
// input) and every action still reported { ok: true }. The fix: a
// type NAMES its field (label or CSS selector, same resolution as
// click), the field is cleared first, and the value is READ BACK and
// compared before any submit — a type that did not land in the named
// field is a failure, never a success. A type without a target is
// refused before any driver call.
//
// These tests run the ACTUAL type expressions from the shipped
// CDP_SCRIPT (not a copy) in a vm sandbox with a fake DVWA login
// document — the same shape as guiTools.click.test.js — plus the
// public guiBrowserType through a stub exec (the cdpStubExec shape
// from guiTools.wrongPage.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  CDP_SCRIPT,
  resolveClickTarget,
  guiBrowserType,
  guiBrowserOpen,
  guiBrowserClick,
  displayFieldValue,
  formatFieldValues,
  resetGuiProbeCache,
} from './guiTools.js';

// --- extract the two type expressions from the real CDP_SCRIPT ---

function typeExprsFromScript(script) {
  const resolve = /const typed = await evaluate\(`\(\(\) => \{([\s\S]*?) \}\)\(\)`\);/.exec(script);
  const readback = /const check = await evaluate\(`\(\(\) => \{([\s\S]*?) \}\)\(\)`\);/.exec(script);
  assert.ok(resolve, 'type resolve expression must be present in CDP_SCRIPT');
  assert.ok(readback, 'type read-back expression must be present in CDP_SCRIPT');
  return { resolve: resolve[1], readback: readback[1] };
}

function runTypeExpr(exprSrc, target, doc) {
  const interpolated = exprSrc
    .replace('${resolveClickTarget.toString()}', resolveClickTarget.toString())
    .replace('${JSON.stringify(target)}', JSON.stringify(target));
  const code = `(() => {${interpolated} })()`;
  const sandbox = { document: doc, window: { getSelection: () => ({ selectAllChildren: () => {} }) } };
  vm.createContext(sandbox);
  return vm.runInContext(code, sandbox, { timeout: 1000 });
}

function runReadbackExpr(exprSrc, doc) {
  const code = `(() => {${exprSrc} })()`;
  const sandbox = { document: doc };
  vm.createContext(sandbox);
  return vm.runInContext(code, sandbox, { timeout: 1000 });
}

// A fake DVWA login page: username (text) + password (password) inputs.
function fakeLoginDoc() {
  const mk = ({ name, type, value = '' }) => {
    const attrs = { name, type };
    return {
      tagName: 'INPUT',
      isContentEditable: false,
      disabled: false,
      readOnly: false,
      value,
      innerText: '',
      placeholder: '',
      name,
      id: name,
      getAttribute: (n) => attrs[n] || '',
      getBoundingClientRect: () => ({ width: 200, height: 30 }),
      scrollIntoView() { this.scrolled = true; },
      focus() { this.focused = true; },
      select() { this.selected = true; },
      setAttribute(k, v) { this.attrs = { ...(this.attrs || {}), [k]: v }; },
      removeAttribute(k) { if (this.attrs) delete this.attrs[k]; },
      scrolled: false,
      focused: false,
      selected: false,
      attrs: {},
    };
  };
  const username = mk({ name: 'username', type: 'text' });
  const password = mk({ name: 'password', type: 'password' });
  const els = [username, password];
  const doc = {
    username,
    password,
    activeElement: null,
    querySelector: (sel) => {
      if (sel === '[data-dm-typed="1"]') return els.find((e) => e.attrs && e.attrs['data-dm-typed'] === '1') || null;
      const m = /input\[name=([^\]]+)\]/.exec(sel);
      if (m) return els.find((e) => e.name === m[1]) || null;
      if (sel.startsWith('#')) return els.find((e) => e.id === sel.slice(1)) || null;
      return null;
    },
    querySelectorAll: () => els,
  };
  return doc;
}

const { resolve: RESOLVE_EXPR, readback: READBACK_EXPR } = typeExprsFromScript(CDP_SCRIPT);

test('T-1: the resolve expression focuses the NAMED field by label and clears it', () => {
  const doc = fakeLoginDoc();
  const result = runTypeExpr(RESOLVE_EXPR, 'Username', doc);
  assert.equal(result.ok, true);
  assert.equal(doc.username.focused, true, 'the username field is focused');
  assert.equal(doc.username.selected, true, 'the field is selected (cleared) before typing');
  assert.equal(doc.username.attrs['data-dm-typed'], '1', 'the field is stamped for read-back');
  assert.equal(doc.password.focused, false, 'the password field is untouched');
  assert.equal(doc.password.attrs['data-dm-typed'], undefined);
  assert.equal(result.field.name, 'username');
  assert.equal(result.field.type, 'text');
});

test('T-2: the resolve expression takes a CSS selector for the password field', () => {
  const doc = fakeLoginDoc();
  const result = runTypeExpr(RESOLVE_EXPR, 'input[name=password]', doc);
  assert.equal(result.ok, true);
  assert.equal(doc.password.focused, true);
  assert.equal(doc.username.focused, false, 'the username field is untouched');
  assert.equal(result.field.name, 'password');
  assert.equal(result.field.type, 'password');
  assert.equal(result.field.how, 'selector');
});

test('T-3: the resolve expression with NO target refuses and touches nothing (failure detection)', () => {
  const doc = fakeLoginDoc();
  const result = runTypeExpr(RESOLVE_EXPR, '', doc);
  assert.equal(result.ok, false);
  assert.match(result.error, /no field target/);
  assert.equal(doc.username.focused, false);
  assert.equal(doc.password.focused, false);
  assert.equal(doc.username.attrs['data-dm-typed'], undefined);
});

test('T-4: the resolve expression with an unknown label refuses and lists the fields', () => {
  const doc = fakeLoginDoc();
  const result = runTypeExpr(RESOLVE_EXPR, 'Email', doc);
  assert.equal(result.ok, false);
  assert.match(result.error, /no field matches "Email"/);
  assert.match(result.error, /username/);
  assert.match(result.error, /password/);
  assert.equal(doc.username.focused, false);
});

test('T-5: the read-back expression returns the stamped field value and clears the stamp', () => {
  const doc = fakeLoginDoc();
  doc.username.value = 'admin';
  doc.username.attrs['data-dm-typed'] = '1';
  const result = runReadbackExpr(READBACK_EXPR, doc);
  assert.equal(result.ok, true);
  assert.equal(result.value, 'admin');
  assert.equal(result.field.name, 'username');
  assert.equal(doc.username.attrs['data-dm-typed'], undefined, 'the stamp is removed after read-back');
  const gone = runReadbackExpr(READBACK_EXPR, doc);
  assert.equal(gone.ok, false);
  assert.match(gone.error, /vanished/);
});

// --- public guiBrowserType through a stub exec (CDP mode) ---

function cdpStubExec(driverResult, captured) {
  return async (h, cmd, t, o) => {
    const c = String(cmd);
    if (c.includes('DMGUI_P64=')) {
      const m = /DMGUI_P64='([^']+)'/.exec(c);
      captured.params = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
      captured.action = /cdp\.mjs (\w+)/.exec(c)[1];
      const res = typeof driverResult === 'function' ? driverResult(captured) : driverResult;
      return { code: 0, stdout: JSON.stringify(res), stderr: '' };
    }
    if (c.includes('wc -c')) return { code: 0, stdout: '5000', stderr: '' };
    if (c.includes('json/version')) {
      return {
        code: 0,
        stdout: 'chrome=/usr/bin/chromium\ncdp={"Browser":"x","webSocketDebuggerUrl":"ws://127.0.0.1:9222/devtools/browser/y"}\nxsock=X0\n',
        stderr: '',
      };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
}

const LOGIN_SNAP = {
  url: 'http://172.17.0.1:3100/login.php',
  title: 'Login :: Damn Vulnerable Web Application',
  text: 'Username Password Login',
  elements: [
    { tag: 'input', type: 'text', label: 'username', id: 'username', name: 'username', placeholder: '', value: 'admin' },
    { tag: 'input', type: 'password', label: 'password', id: 'password', name: 'password', placeholder: '', value: '•••••••• (8 chars)' },
    { tag: 'input', type: 'submit', label: 'Login', id: '', name: 'Login', placeholder: '', value: 'Login' },
  ],
};

function typeDriverResult(field, value, snap) {
  return {
    ok: true,
    typed: value,
    field,
    value,
    valueLength: String(value).length,
    url: snap.url,
    snapshot: snap,
  };
}

test('T-6: guiBrowserType passes the target to the driver and the observation names the verified field + value + URL', async () => {
  resetGuiProbeCache();
  const captured = {};
  const field = { tag: 'input', type: 'text', name: 'username', id: 'username', label: 'Username', how: 'label:username' };
  const res = await guiBrowserType('h_t6', 'Username', 'admin', false, {
    exec: cdpStubExec(typeDriverResult(field, 'admin', LOGIN_SNAP), captured),
  });
  assert.equal(res.ok, true);
  assert.equal(captured.action, 'type');
  assert.equal(captured.params.target, 'Username');
  assert.equal(captured.params.text, 'admin');
  assert.match(res.observation, /Typed "admin" into input type=text name=username/);
  assert.match(res.observation, /field now holds "admin"/);
  assert.match(res.observation, /http:\/\/172\.17\.0\.1:3100\/login\.php/);
  assert.match(res.observation, /field values/);
  assert.match(res.observation, /username \[input type=text\]: "admin"/);
  assert.equal(res.field.name, 'username');
});

test('T-7: guiBrowserType with NO target refuses before any driver call (failure detection)', async () => {
  resetGuiProbeCache();
  const captured = {};
  const res = await guiBrowserType('h_t7', '', 'admin', false, {
    exec: cdpStubExec(typeDriverResult({ tag: 'input', type: 'text', name: 'username' }, 'admin', LOGIN_SNAP), captured),
  });
  assert.equal(res.ok, false);
  assert.match(res.observation, /needs a field target/);
  assert.equal(captured.action, undefined, 'the CDP driver was never invoked');
});

test('T-8: a driver value mismatch is a failed type, never a success', async () => {
  resetGuiProbeCache();
  const captured = {};
  const mismatch = {
    ok: false,
    error: 'typed text did not land in the field — field now holds 13 chars, expected 8',
    field: { tag: 'input', type: 'text', name: 'username', id: 'username' },
  };
  const res = await guiBrowserType('h_t8', 'Username', 'password', false, {
    exec: cdpStubExec(mismatch, captured),
  });
  assert.equal(res.ok, false);
  assert.match(res.observation, /Type failed: typed text did not land/);
  assert.match(res.observation, /13 chars, expected 8/);
});

test('T-9: a password field value is masked in the observation (never plain text)', async () => {
  resetGuiProbeCache();
  const captured = {};
  const field = { tag: 'input', type: 'password', name: 'password', id: 'password', label: 'Password', how: 'label:password' };
  const res = await guiBrowserType('h_t9', 'Password', 'password', false, {
    exec: cdpStubExec(typeDriverResult(field, 'password', LOGIN_SNAP), captured),
  });
  assert.equal(res.ok, true);
  assert.doesNotMatch(res.observation, /Typed "password"/);
  assert.match(res.observation, /Typed •+ \(8 chars\) into input type=password name=password/);
  assert.match(res.observation, /field now holds •+ \(8 chars\)/);
  assert.match(res.observation, /password \[input type=password\]: •+ \(8 chars\)/);
  assert.equal(displayFieldValue({ type: 'password' }, 'password'), '•••••••• (8 chars)');
  assert.equal(displayFieldValue({ type: 'text' }, 'admin'), '"admin"');
  assert.match(formatFieldValues(LOGIN_SNAP), /username \[input type=text\]: "admin"/);
});

// --- full GUI login flow: open, type username, type password, click Login ---

test('T-10: full GUI login flow — each type names its field and the dashboard loads', async () => {
  resetGuiProbeCache();
  const seen = [];
  const driverFor = (captured) => {
    const action = captured.action;
    seen.push([action, captured.params.target || captured.params.text || captured.params.url || '']);
    if (action === 'navigate') return LOGIN_SNAP;
    if (action === 'type' && captured.params.target === 'Username') {
      return typeDriverResult({ tag: 'input', type: 'text', name: 'username', id: 'username', label: 'Username' }, 'admin', LOGIN_SNAP);
    }
    if (action === 'type' && captured.params.target === 'Password') {
      return typeDriverResult({ tag: 'input', type: 'password', name: 'password', id: 'password', label: 'Password' }, 'password', LOGIN_SNAP);
    }
    if (action === 'click') {
      return {
        ok: true,
        clicked: 'Login',
        url: 'http://172.17.0.1:3100/index.php',
        snapshot: {
          url: 'http://172.17.0.1:3100/index.php',
          title: 'Welcome :: Damn Vulnerable Web Application',
          text: 'Welcome to Damn Vulnerable Web Application Logout',
          elements: [{ tag: 'a', type: '', label: 'Logout', id: '', name: '', placeholder: '', href: 'logout.php', value: '' }],
        },
      };
    }
    return { ok: false, error: 'unexpected driver action ' + action };
  };
  const captured = {};
  const exec = cdpStubExec(driverFor, captured);
  const deps = { exec };
  const opened = await guiBrowserOpen('h_t10', 'http://172.17.0.1:3100/login.php', deps);
  assert.equal(opened.ok, true);
  resetGuiProbeCache();
  const typedU = await guiBrowserType('h_t10', 'Username', 'admin', false, deps);
  assert.equal(typedU.ok, true);
  assert.match(typedU.observation, /field now holds "admin"/);
  resetGuiProbeCache();
  const typedP = await guiBrowserType('h_t10', 'Password', 'password', false, deps);
  assert.equal(typedP.ok, true);
  assert.doesNotMatch(typedP.observation, /Typed "password"/);
  resetGuiProbeCache();
  const clicked = await guiBrowserClick('h_t10', 'Login', deps);
  assert.equal(clicked.ok, true);
  assert.match(clicked.observation, /Logout/, 'the dashboard loads — the login happened');
  assert.deepEqual(seen.map(([a]) => a), ['navigate', 'type', 'type', 'click']);
  assert.equal(seen[1][1], 'Username', 'the username type named its field');
  assert.equal(seen[2][1], 'Password', 'the password type named its field — not the username field again');
});
