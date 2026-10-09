import { useMemo, useState } from 'react';
import { analyseCmsCommerceSurface } from '../../backend/src/engines/cmsCommerceRecon.js';
import { analyseRiskSignalSurface } from '../../backend/src/engines/riskSignalRecon.js';
import {
  dedupeFrontier,
  frontierCanonicalisationReport,
} from '../../backend/src/engines/crawlFrontierDedup.js';
import './CommerceRiskSurface.css';

const SAMPLE_CMS = `<script src="https://js.stripe.com/v3/stripe.js"></script>
<script>const stripe = Stripe('pk_live_EXAMPLE1234567890');
fetch('/api/billing/create-payment-intent', { method: 'POST' });</script>
<script src="https://cdn.sift.com/s/v3/js/sift.js"></script>
<script>var _sift = []; _sift.push(['$create_order', {}]);</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
<div class="cf-turnstile" data-sitekey="0x4AAAAEXAMPLEKEY"></div>
<script>fetch('https://acme-shop.myshopify.com/api/2024-01/graphql.json', { method: 'POST' });</script>
<script>fetch('/wp-json/wp/v2/posts');</script>
<script>fetch('/jsonapi/node/article');</script>`;

const SAMPLE_FRONTIER = `https://example.com/Shop/
HTTPS://EXAMPLE.COM/shop
https://example.com:443/shop?utm_source=google
https://example.com/shop#reviews
https://example.com/blog?page=2&q=x
https://example.com/blog?q=x&page=2&utm_medium=email`;

function Section({ title, children }) {
  return (
    <div className="w961-root-section">
      <h3 className="w961-root-section-title">{title}</h3>
      {children}
    </div>
  );
}

function Kv({ rows }) {
  if (!rows.length) return <p className="w961-root-empty">Not detected in this source.</p>;
  return (
    <ul className="w961-root-list">
      {rows.map((r) => (
        <li key={r[0]} className="w961-root-item">
          <span className="w961-root-key">{r[0]}</span>
          <span className="w961-root-val">{r[1]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CommerceRiskSurface() {
  const [cmsSrc, setCmsSrc] = useState(SAMPLE_CMS);
  const [frontierSrc, setFrontierSrc] = useState(SAMPLE_FRONTIER);

  const cms = useMemo(() => analyseCmsCommerceSurface(cmsSrc), [cmsSrc]);
  const risk = useMemo(() => analyseRiskSignalSurface(cmsSrc), [cmsSrc]);
  const frontier = useMemo(
    () => dedupeFrontier(frontierSrc.split('\n').map((s) => s.trim()).filter(Boolean)),
    [frontierSrc]
  );
  const report = useMemo(
    () => frontierCanonicalisationReport(frontierSrc.split('\n').map((s) => s.trim()).filter(Boolean)),
    [frontierSrc]
  );

  return (
    <div className="w961-root">
      <h2 className="w961-root-title">Commerce &amp; Risk Surface (ideas 991–1000)</h2>
      <p className="w961-root-sub">
        Static inventory of headless-CMS/commerce endpoints, payment, fraud and bot-management
        signals found in client code — plus canonical dedup of the discovered URL frontier.
        Passive analysis only; secrets are masked, never echoed.
      </p>

      <textarea
        className="w961-root-input"
        rows={10}
        value={cmsSrc}
        onChange={(e) => setCmsSrc(e.target.value)}
        aria-label="Client source to analyse"
      />

      <Section title="Headless CMS & commerce endpoints">
        <Kv
          rows={[
            ...cms.datoCms.hosts.map((h) => ['DatoCMS host', `${h.host} (line ${h.line})`]),
            ...cms.prismic.repositories.map((r) => ['Prismic repo', `${r.name} → ${r.endpoint}`]),
            ...cms.ghost.endpoints.map((e) => ['Ghost API', e.path]),
            ...Object.entries(cms.wordpress.namespaces).flatMap(([ns, routes]) =>
              routes.map((r) => [`WP REST ${ns}`, r])
            ),
            ...cms.drupal.resources.map((r) => ['Drupal JSON:API', r.path]),
            ...cms.commerce.shopify.stores.map((s) => ['Shopify store', s.store]),
            ...cms.commerce.shopify.endpoints.map((e) => ['Shopify endpoint', e.endpoint]),
            ...cms.commerce.bigcommerce.endpoints.map((e) => ['BigCommerce endpoint', e.endpoint]),
          ]}
        />
      </Section>

      <Section title="Payment, fraud & bot-management signals">
        <Kv
          rows={[
            ...risk.paymentGateways.map((g) => [
              `Gateway: ${g.gateway}`,
              `${g.evidence}, key ${g.publicKey}, checkout hints: ${g.checkoutHints.join(', ') || 'none'}`,
            ]),
            ...risk.fraudSdks.map((s) => [
              `Fraud SDK: ${s.sdk}`,
              `beacon ${s.beaconHost || 'unknown'}, signals: ${s.signals.map((x) => x.signal).join(', ') || 'none'}`,
            ]),
            ...risk.botManagement.map((b) => [
              `Bot mgmt: ${b.sdk}`,
              `signals: ${b.signals.map((x) => x.signal).join(', ') || 'none'}, challenges: ${b.challengeHints.join(', ') || 'none'}`,
            ]),
          ]}
        />
      </Section>

      <Section title="Crawl-frontier deduplication (idea 1000)">
        <textarea
          className="w961-root-input"
          rows={6}
          value={frontierSrc}
          onChange={(e) => setFrontierSrc(e.target.value)}
          aria-label="Frontier URLs, one per line"
        />
        <Kv
          rows={[
            ['Input URLs', String(frontier.stats.input)],
            ['Unique (canonical)', String(frontier.stats.unique)],
            ['Duplicates removed', `${frontier.stats.duplicateCount} (${frontier.stats.reductionPct}%)`],
            ...Object.entries(report)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => [`Canonical rule: ${k}`, String(v)]),
          ]}
        />
        <Kv
          rows={frontier.duplicates.map((d, i) => [
            `dup ${i + 1}`,
            `${d.url} → ${d.duplicateOf}`,
          ])}
        />
      </Section>
    </div>
  );
}
