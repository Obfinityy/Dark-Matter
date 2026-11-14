// Tests for the SSTI engine-specific legs (rows #288–#293 —
// FreeMarker, Velocity, Thymeleaf, Smarty, ERB, Handlebars/Pug;
// phase 'ssti-engines').
//
// Each engine gets an engine-specific arithmetic leg plus a
// discriminator leg that only that engine evaluates, with the false
// branch as the nonsense control (the Pebble shape: a page that merely
// echoes the oracle fails the false leg). Stubs below: one evaluator
// per engine, a Jinja2-style evaluator (generic {{ }} only — the
// engines probe must stay silent there; ssti.js owns it), a literal
// reflector, a page whose control already carries 9352, and the
// proof-#18 fresh-token shape.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeSstiEngines,
  engineLegs,
  assessEngineLeg,
  __sstiEnginesMeta,
} from './sstiEngines.js';
import { verifyFindings } from '../verifier.js';

describe('ssti-engines probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  let tokenSeq = 0;

  function freshToken(withOracle) {
    tokenSeq += 1;
    const seq = String(tokenSeq).padStart(2, '0');
    return 'd9516f' + seq + (withOracle ? '9352' : '4177') + '3765cd44c03913e4c7c';
  }

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      let out;
      if (u.pathname === '/freemarker') {
        if (q === '${1336*7}') out = 'result: 9352';
        else if (q === '${(true)?then(9352,1111)}') out = 'result: 9352';
        else if (q === '${(false)?then(9352,1111)}') out = 'result: 1111';
        else out = `result: ${q}`; // FreeMarker never evaluates ? : or #strings
      } else if (u.pathname === '/velocity') {
        if (q === '#set($dmv=1336*7)$dmv') out = 'result: 9352';
        else if (q === '#if(true)9352#else 1111#end') out = 'result: 9352';
        else if (q === '#if(false)9352#else 1111#end') out = 'result: 1111';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/thymeleaf') {
        if (q === '${1336*7}') out = 'result: 9352';
        else if (q === "${#strings.toUpperCase('dmtest')}") out = 'result: DMTEST';
        else if (q === '${false ? 9352 : 1111}') out = 'result: 1111';
        else out = `result: ${q}`; // Thymeleaf never evaluates ?then
      } else if (u.pathname === '/smarty') {
        if (q === '{math equation="1336*7"}') out = 'result: 9352';
        else if (q === '{if true}9352{else}1111{/if}') out = 'result: 9352';
        else if (q === '{if false}9352{else}1111{/if}') out = 'result: 1111';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/erb') {
        if (q === '<%= 1336*7 %>') out = 'result: 9352';
        else if (q === '<%= true ? 9352 : 1111 %>') out = 'result: 9352';
        else if (q === '<%= false ? 9352 : 1111 %>') out = 'result: 1111';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/handlebars') {
        if (q === '{{#if true}}9352{{else}}1111{{/if}}') out = 'result: 9352';
        else if (q === '{{#if false}}9352{{else}}1111{{/if}}') out = 'result: 1111';
        else if (q === '{{1336*7}}') out = 'result: '; // lookup, not evaluation
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/pug') {
        if (q === '#{1336*7}') out = 'result: 9352';
        else if (q === '#{true ? 9352 : 1111}') out = 'result: 9352';
        else if (q === '#{false ? 9352 : 1111}') out = 'result: 1111';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/jinja') {
        // Generic {{ }} evaluator only — ssti.js owns this sink.
        if (q === '{{1336*7}}') out = 'result: 9352';
        else out = `result: ${q}`;
      } else if (u.pathname === '/login') {
        // Proof-#18 shape: fresh hidden token; the payload response's
        // token happens to contain 9352, the control's does not.
        const token = freshToken(q.includes('1336*7') || q.includes('?then') || q.includes('#if(true)'));
        out = `<form><input type="hidden" name="user_token" value="${token}">login</form>`;
      } else if (u.pathname === '/noisy') {
        out = 'result: 9352 always';
      } else {
        out = `result: ${q}`; // plain reflector
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>${out}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fires on a FreeMarker evaluator (arithmetic + ?then, false leg flips)', async () => {
    const diag = {};
    const findings = await probeSstiEngines(`${base()}/freemarker`, ['q'], { timeoutMs: 8000, diagnostics: diag });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'ssti');
    assert.equal(f.id, 'ssti-freemarker-q');
    assert.equal(f.severity, 'critical');
    assert.match(f.title, /FreeMarker/);
    assert.equal(f.evidence.engine, 'freemarker');
    assert.ok(f.evidence.signalCorrelated);
    assert.ok(f.evidence.response.includes('9352'));
    assert.deepEqual(diag.confirmedEngines, ['freemarker']);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('does NOT fire the Thymeleaf finding on a FreeMarker sink (?then is the discriminator)', async () => {
    const findings = await probeSstiEngines(`${base()}/freemarker`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].evidence.engine, 'freemarker');
  });

  it('fires on a Velocity evaluator (#set + #if, false leg flips)', async () => {
    const findings = await probeSstiEngines(`${base()}/velocity`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.id, 'ssti-velocity-q');
    assert.equal(f.severity, 'critical');
    assert.match(f.title, /Velocity/);
    assert.equal(f.evidence.engine, 'velocity');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('fires on a Thymeleaf evaluator (${} + #strings, ternary-false flips)', async () => {
    const findings = await probeSstiEngines(`${base()}/thymeleaf`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.id, 'ssti-thymeleaf-q');
    assert.equal(f.severity, 'critical');
    assert.match(f.title, /Thymeleaf/);
    assert.equal(f.evidence.engine, 'thymeleaf');
    assert.ok(f.evidence.response.includes('DMTEST'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('does NOT fire the FreeMarker finding on a Thymeleaf sink (#strings is the discriminator)', async () => {
    const findings = await probeSstiEngines(`${base()}/thymeleaf`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].evidence.engine, 'thymeleaf');
  });

  it('fires on a Smarty evaluator ({math} + {if}, false leg flips)', async () => {
    const findings = await probeSstiEngines(`${base()}/smarty`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.id, 'ssti-smarty-q');
    assert.equal(f.severity, 'critical');
    assert.match(f.title, /Smarty/);
    assert.equal(f.evidence.engine, 'smarty');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('fires on an ERB evaluator (<%= %> + Ruby ternary, false leg flips)', async () => {
    const findings = await probeSstiEngines(`${base()}/erb`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.id, 'ssti-erb-q');
    assert.equal(f.severity, 'critical');
    assert.match(f.title, /ERB/);
    assert.equal(f.evidence.engine, 'erb');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('fires on a Handlebars evaluator (#if block helper, false leg flips) — severity high per row #293', async () => {
    const findings = await probeSstiEngines(`${base()}/handlebars`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.id, 'ssti-handlebars-q');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /Handlebars/);
    assert.equal(f.evidence.engine, 'handlebars');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('fires on a Pug evaluator (#{ } interpolation + JS ternary, false leg flips) — severity high per row #293', async () => {
    const findings = await probeSstiEngines(`${base()}/pug`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.id, 'ssti-pug-q');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /Pug/);
    assert.equal(f.evidence.engine, 'pug');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('stays silent on a Jinja2-style evaluator (generic {{ }} only — ssti.js owns it)', async () => {
    const findings = await probeSstiEngines(`${base()}/jinja`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent on literal reflection', async () => {
    const findings = await probeSstiEngines(`${base()}/reflect`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent when the control already carries 9352', async () => {
    const findings = await probeSstiEngines(`${base()}/noisy`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent when 9352 hides inside a fresh hidden token (proof-#18 FP)', async () => {
    const findings = await probeSstiEngines(`${base()}/login`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('engine legs are the documented engine spellings', () => {
    const byKey = Object.fromEntries(engineLegs().map((e) => [e.key, e]));
    assert.deepEqual(Object.keys(byKey), ['freemarker', 'velocity', 'thymeleaf', 'smarty', 'erb', 'handlebars', 'pug']);
    assert.equal(byKey.freemarker.legs[0].payload, '${1336*7}');
    assert.equal(byKey.freemarker.legs[1].payload, '${(true)?then(9352,1111)}');
    assert.equal(byKey.freemarker.legs[2].payload, '${(false)?then(9352,1111)}');
    assert.equal(byKey.velocity.legs[0].payload, '#set($dmv=1336*7)$dmv');
    assert.equal(byKey.velocity.legs[1].payload, '#if(true)9352#else 1111#end');
    assert.equal(byKey.velocity.legs[2].payload, '#if(false)9352#else 1111#end');
    assert.equal(byKey.thymeleaf.legs[0].payload, '${1336*7}');
    assert.equal(byKey.thymeleaf.legs[1].payload, "${#strings.toUpperCase('dmtest')}");
    assert.equal(byKey.thymeleaf.legs[1].expected, 'DMTEST');
    assert.equal(byKey.thymeleaf.legs[2].payload, '${false ? 9352 : 1111}');
    assert.equal(byKey.smarty.legs[0].payload, '{math equation="1336*7"}');
    assert.equal(byKey.smarty.legs[1].payload, '{if true}9352{else}1111{/if}');
    assert.equal(byKey.smarty.legs[2].payload, '{if false}9352{else}1111{/if}');
    assert.equal(byKey.erb.legs[0].payload, '<%= 1336*7 %>');
    assert.equal(byKey.erb.legs[1].payload, '<%= true ? 9352 : 1111 %>');
    assert.equal(byKey.erb.legs[2].payload, '<%= false ? 9352 : 1111 %>');
    assert.equal(byKey.handlebars.legs[0].payload, '{{#if true}}9352{{else}}1111{{/if}}');
    assert.equal(byKey.handlebars.legs[1].payload, '{{#if false}}9352{{else}}1111{{/if}}');
    assert.equal(byKey.pug.legs[0].payload, '#{1336*7}');
    assert.equal(byKey.pug.legs[1].payload, '#{true ? 9352 : 1111}');
    assert.equal(byKey.pug.legs[2].payload, '#{false ? 9352 : 1111}');
    // FreeMarker and Thymeleaf share the ${} arithmetic screen.
    assert.equal(byKey.freemarker.legs[0].payload, byKey.thymeleaf.legs[0].payload);
    // Handlebars has no arithmetic leg — {{ }} is a lookup there.
    assert.equal(byKey.handlebars.legs.length, 2);
  });

  it('assessEngineLeg confirms a full stable leg', () => {
    const v = assessEngineLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: 9352</html>',
      bodyRepeatRaw: '<html>result: 9352</html>',
      payload: '${1336*7}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'confirmed');
  });

  it('assessEngineLeg rejects literal reflection', () => {
    const v = assessEngineLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: ${1336*7}</html>',
      bodyRepeatRaw: '<html>result: ${1336*7}</html>',
      payload: '${1336*7}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessEngineLeg rejects HTML-escaped reflection (stronger than a raw literal check)', () => {
    // A page that HTML-escapes the reflected payload still carries the
    // oracle digits inside the payload text — never evaluation. A
    // raw-only literal check (body.includes(payload)) would MISS this:
    // the raw <%= %> form is absent, 9352 is present, the repeat is
    // stable — it would confirm. isPayloadReflected catches the
    // &lt;...&gt; form and rejects.
    const v = assessEngineLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: &lt;%= true ? 9352 : 1111 %&gt;</html>',
      bodyRepeatRaw: '<html>result: &lt;%= true ? 9352 : 1111 %&gt;</html>',
      payload: '<%= true ? 9352 : 1111 %>',
      expected: '9352',
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessEngineLeg rejects a control that already carries the oracle', () => {
    const v = assessEngineLeg({
      controlRaw: '<html>result: 9352 always</html>',
      bodyRaw: '<html>result: 9352</html>',
      bodyRepeatRaw: '<html>result: 9352</html>',
      payload: '${1336*7}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessEngineLeg is unconfirmed when the repeat moves the reflection point', () => {
    const v = assessEngineLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: 9352</html>',
      bodyRepeatRaw: '<html>other slot: 9352</html>',
      payload: '${1336*7}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'unconfirmed');
  });

  it('probe meta names the phase and all depths', () => {
    assert.deepEqual(__sstiEnginesMeta.phases, ['ssti-engines']);
    assert.deepEqual(__sstiEnginesMeta.depth, ['quick', 'standard', 'deep']);
  });

  it('no params means no findings', async () => {
    const findings = await probeSstiEngines(`${base()}/freemarker`, [], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });
});
