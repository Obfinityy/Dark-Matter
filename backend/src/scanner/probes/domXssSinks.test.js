// Tests for the DOM XSS sink fingerprint probe
// (coverage row #115 [High] DOM-Based XSS, phase 87).
// No network, no lab needed — the probe fetches bundles through the
// opts.fetchPage seam, stubbed here; inline scripts are scanned
// directly from the page body. Fixtures replicate the exact compiled
// shapes found in Juice Shop's main.js (verified 8 Nov 2026):
// `this.sanitizer.bypassSecurityTrustHtml(…)`, `Y8G("innerHTML", …)`
// bindings, and `window.open(…).document.write(…)`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDomXssSinks,
  scanDomSinks,
  isVendorBundle,
  isFrameworkBundle,
} from './domXssSinks.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://lab.local/';
const MAIN_URL = 'http://lab.local/main.abc123.js';
const VENDOR_URL = 'http://lab.local/vendor.def456.js';

// Stub fetchPage: maps bundle URLs to bodies, records fetches.
function fetchBodies(bodies, seen = []) {
  return async (url) => {
    seen.push(url);
    return { status: 200, body: bodies[url] || '' };
  };
}

const BYPASS_TWO =
  'this.results.orderNo=this.sanitizer.bypassSecurityTrustHtml(`<code>${e.data[0].orderId}</code>`),' +
  'e[o].comment=this.sanitizer.bypassSecurityTrustHtml(e[o].comment),this.galleryRef.addImage({src:1});';

const INNERHTML_BINDING =
  'function pa(n,i){if(1&n){const e=t.XpG().$implicit;t.R7$(),t.Y8G("innerHTML",null==e?null:e.args,t.npT)}}' +
  '[1,"caption",3,"innerHTML"],[1,"item-price"]';

const DOC_WRITE =
  'this.userData=e.userData,window.open("","_blank","width=500")?.document.write(this.userData),this.lastSuccessfulTry=new Date;';

const CLEAN_BUNDLE =
  'function render(t){const el=document.createElement("div");el.textContent=t.name;document.body.appendChild(el);}';

const SANITIZER_DEFINITION =
  '}}bypassSecurityTrustHtml(we){return(0,o.Kcf)(we)}bypassSecurityTrustUrl(we){return(0,o.Kcf)(we)}';

describe('isVendorBundle', () => {
  it('DOM-9a: vendor / polyfills / runtime stems are library bundles', () => {
    assert.equal(isVendorBundle('http://lab.local/vendor.abc123.js'), true);
    assert.equal(isVendorBundle('http://lab.local/vendor.js'), true);
    assert.equal(isVendorBundle('http://lab.local/polyfills.abc123.js'), true);
    assert.equal(isVendorBundle('http://lab.local/polyfill.abc123.js'), true);
    assert.equal(isVendorBundle('http://lab.local/runtime.abc123.js'), true);
  });
  it('DOM-9b: main / chunk app bundles are scanned', () => {
    assert.equal(isVendorBundle('http://lab.local/main.abc123.js'), false);
    assert.equal(isVendorBundle('http://lab.local/main.js'), false);
    assert.equal(isVendorBundle('http://lab.local/chunk-123.abc.js'), false);
    assert.equal(isVendorBundle('http://lab.local/app.abc123.js'), false);
  });
});

describe('isFrameworkBundle', () => {
  it('DOM-2a: a bundle defining the sanitizer is framework code', () => {
    assert.equal(isFrameworkBundle(SANITIZER_DEFINITION), true);
  });
  it('DOM-2b: call sites alone do not mark a bundle as framework code', () => {
    assert.equal(isFrameworkBundle(BYPASS_TWO), false);
    assert.equal(isFrameworkBundle(CLEAN_BUNDLE), false);
    assert.equal(isFrameworkBundle(''), false);
  });
});

describe('scanDomSinks', () => {
  it('DOM-1: bypassSecurityTrustHtml call sites are counted', () => {
    const scan = scanDomSinks(BYPASS_TWO);
    assert.equal(scan.bypass, 2);
    assert.equal(scan.innerHTML, 0);
    assert.equal(scan.documentWrite, 0);
  });
  it('DOM-2c: the sanitizer definition alone is not a call site', () => {
    assert.equal(scanDomSinks(SANITIZER_DEFINITION), null);
  });
  it('DOM-4a: quoted "innerHTML" literals (compiled bindings) are counted', () => {
    const scan = scanDomSinks(INNERHTML_BINDING);
    assert.equal(scan.innerHTML, 2);
    assert.equal(scan.bypass, 0);
  });
  it('DOM-4b: a bare innerHTML word in a comment never fires', () => {
    assert.equal(scanDomSinks('// TODO: avoid innerHTML here for now\nvar a = 1;'), null);
  });
  it('DOM-5a: .innerHTML = assignment fires', () => {
    const scan = scanDomSinks('el.innerHTML = user.name;');
    assert.equal(scan.innerHTML, 1);
  });
  it('DOM-5b: .innerHTML == comparison never fires', () => {
    assert.equal(scanDomSinks("if (el.innerHTML == 'x') { return; }"), null);
  });
  it('DOM-6: document.write call sites are counted', () => {
    const scan = scanDomSinks(DOC_WRITE);
    assert.equal(scan.documentWrite, 1);
  });
  it('DOM-7: a clean bundle has no sinks', () => {
    assert.equal(scanDomSinks(CLEAN_BUNDLE), null);
    assert.equal(scanDomSinks(''), null);
    assert.equal(scanDomSinks(null), null);
  });
});

describe('probeDomXssSinks', () => {
  it('DOM-1b: bypass call sites yield one aggregated [Low] finding per bundle', async () => {
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: BYPASS_TWO }) }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'low');
    assert.equal(findings[0].url, MAIN_URL);
    assert.match(findings[0].title, /bypassSecurityTrustHtml ×2/);
    assert.match(findings[0].title, /\(INFO\)/);
    assert.equal(findings[0].evidence.signalCorrelated, true);
  });
  it('DOM-11: all three sink shapes in one bundle aggregate to ONE finding', async () => {
    const body = `${BYPASS_TWO} ${INNERHTML_BINDING} ${DOC_WRITE}`;
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: body }) }
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /bypassSecurityTrustHtml ×2/);
    assert.match(findings[0].title, /innerHTML ×2/);
    assert.match(findings[0].title, /document\.write ×1/);
  });
  it('DOM-2d: a framework bundle (sanitizer definition) is skipped whole, even with call sites', async () => {
    const body = `${SANITIZER_DEFINITION} ${BYPASS_TWO}`;
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: body }) }
    );
    assert.equal(findings.length, 0);
  });
  it('DOM-3: a vendor bundle URL is never fetched; the app bundle is', async () => {
    const seen = [];
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [VENDOR_URL, MAIN_URL], inline: [] },
      {
        fetchPage: fetchBodies({
          [VENDOR_URL]: BYPASS_TWO,
          [MAIN_URL]: BYPASS_TWO,
        }, seen),
      }
    );
    assert.deepEqual(seen, [MAIN_URL]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, MAIN_URL);
  });
  it('DOM-8: an inline block with a bypass call site fires under the page URL', async () => {
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [], inline: [BYPASS_TWO] },
      {}
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, PAGE_URL);
    assert.match(findings[0].title, /bypassSecurityTrustHtml ×2/);
  });
  it('DOM-12a: non-200 and throwing fetches are skipped, not fatal', async () => {
    const fetchPage = async (url) => {
      if (url === MAIN_URL) return { status: 404, body: BYPASS_TWO };
      throw new Error('boom');
    };
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [MAIN_URL, 'http://lab.local/other.js'], inline: [] },
      { fetchPage }
    );
    assert.equal(findings.length, 0);
  });
  it('DOM-12b: empty targets yield no findings', async () => {
    assert.deepEqual(
      await probeDomXssSinks(PAGE_URL, { bundles: [], inline: [] }, {}),
      []
    );
    assert.deepEqual(await probeDomXssSinks(PAGE_URL, {}, {}), []);
  });
  it('DOM-10: assessConfirmation judges a probe finding confirmed (default protocol pin)', async () => {
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: BYPASS_TWO }) }
    );
    assert.equal(findings.length, 1);
    // The class name 'dom_sink' must NOT route to xss_reflected
    // (judged on canaryReflected, which a static fingerprint never
    // carries) — it routes to the default protocol, judged on the
    // signalCorrelated flag the probe sets.
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });
  it('DOM-13: class is dom_sink, never a name containing xss or bypass', async () => {
    const findings = await probeDomXssSinks(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: BYPASS_TWO }) }
    );
    assert.equal(findings[0].class.includes('xss'), false);
    assert.equal(findings[0].class.includes('bypass'), false);
  });
});

export const __domXssSinksTestMeta = { phase: 'dom-xss-sinks', tests: ['DOM-1', 'DOM-2', 'DOM-3', 'DOM-4', 'DOM-5', 'DOM-6', 'DOM-7', 'DOM-8', 'DOM-9', 'DOM-10', 'DOM-11', 'DOM-12', 'DOM-13'] };
