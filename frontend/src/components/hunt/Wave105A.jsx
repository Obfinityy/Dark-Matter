/**
 * Wave105A.jsx — Infinity AI · Wave 105A
 * 20 working React components for target health-check signals, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useState } from 'react';
import * as X105A from './wave105ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w105a-card">
      <div className="w105a-title">{title}</div>
      {note ? <div className="w105a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w105a-badge w105a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w105a-kv">
      <span className="w105a-k">{k}</span>
      <span className="w105a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w105a-bar-row">
      <span className="w105a-k">{label}</span>
      <div className="w105a-bar"><div className="w105a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w105a-v">{value}</span>
    </div>
  );
}

export function ResponseTimeTracking() {
  const [threshold, setThreshold] = useState(1500);
  const data = [
    { target: 'shop', samplesMs: [120, 240, 310, 480, 900] },
    { target: 'legacy', samplesMs: [800, 1400, 2100, 2600] },
  ];
  const v = X105A.trackResponseTimes(data, { thresholdMs: threshold });
  return (
    <Card title="ResponseTimeTracking" note="Idea 54161">
      <Kv k="Degraded" v={v.degradedCount} />
      <label className="w105a-field">Degraded threshold ({threshold} ms p95)
        <input type="range" min="300" max="4000" step="100" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={`${r.target} p95`} value={r.p95Ms} max={4000} />)}
    </Card>
  );
}
export function HomepageContentHashChecks() {
  const [noise, setNoise] = useState(5);
  const data = [
    { target: 'shop', changeRatio: 0.42 },
    { target: 'blog', changeRatio: noise / 1000 },
  ];
  const v = X105A.checkHomepageHash(data, { noiseThreshold: noise / 100 });
  return (
    <Card title="HomepageContentHashChecks" note="Idea 54162">
      <Kv k="Alerts" v={v.alertCount} />
      <label className="w105a-field">Noise threshold ({noise}%)
        <input type="range" min="1" max="50" value={noise} onChange={e => setNoise(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function KeywordPresenceChecks() {
  const [keyword, setKeyword] = useState('pricing');
  const data = [{ target: 'shop', expectedKeywords: ['login', keyword], pageText: 'Welcome to the login page for members' }];
  const v = X105A.checkKeywordPresence(data);
  const row = v.rows[0];
  return (
    <Card title="KeywordPresenceChecks" note="Idea 54163">
      <Kv k="Coverage" v={row.coverage} />
      <label className="w105a-field">Second expected keyword
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} />
      </label>
      <Kv k="Missing" v={row.missing.join(', ') || 'none'} />
    </Card>
  );
}
export function MaintenancePageDetection() {
  const [body, setBody] = useState('We are currently down for maintenance');
  const v = X105A.detectMaintenancePage([{ target: 'shop', statusCode: 503, bodyText: body }]);
  const row = v.rows[0];
  return (
    <Card title="MaintenancePageDetection" note="Idea 54164">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Response body
        <input type="text" value={body} onChange={e => setBody(e.target.value)} />
      </label>
      <Kv k="Matched phrase" v={row.matchedPhrase || 'none'} />
    </Card>
  );
}
export function RedirectLoopDetection() {
  const [extra, setExtra] = useState(0);
  const chain = ['https://a.example.com', 'https://b.example.com', ...Array.from({ length: extra }, (_, i) => `https://hop${i}.example.com`), 'https://a.example.com'];
  const v = X105A.detectRedirectLoops([{ target: 'shop', redirects: chain }]);
  const row = v.rows[0];
  return (
    <Card title="RedirectLoopDetection" note="Idea 54165">
      <Kv k="Status" v={row.status} />
      <Kv k="Chain length" v={row.chainLength} />
      <button type="button" onClick={() => setExtra(n => n + 1)}>Add redirect hop</button>
    </Card>
  );
}
export function WafBlockDetection() {
  const [challenge, setChallenge] = useState(false);
  const v = X105A.detectWafBlock([{ target: 'shop', statusCode: 403, bodyText: 'Forbidden', challengeHeader: challenge }]);
  const row = v.rows[0];
  return (
    <Card title="WafBlockDetection" note="Idea 54166">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Challenge header present
        <input type="checkbox" checked={challenge} onChange={e => setChallenge(e.target.checked)} />
      </label>
      <Kv k="WAF blocks" v={v.wafCount} />
    </Card>
  );
}
export function RateLimitSignalDetection() {
  const [limited, setLimited] = useState(2);
  const codes = [200, 200, ...Array.from({ length: limited }, () => 429)];
  const v = X105A.detectRateLimitSignals([{ target: 'shop', statusCodes: codes }]);
  const row = v.rows[0];
  return (
    <Card title="RateLimitSignalDetection" note="Idea 54167">
      <Kv k="Limited responses" v={row.limitedCount} />
      <Kv k="Backoff (s)" v={row.backoffSeconds} />
      <button type="button" onClick={() => setLimited(n => n + 1)}>Add 429 response</button>
    </Card>
  );
}
export function ErrorSpikeAlerts() {
  const [errors, setErrors] = useState(12);
  const v = X105A.detectErrorSpikes([{ target: 'shop', totalRequests: 100, serverErrors: errors }], { threshold: 0.05 });
  const row = v.rows[0];
  return (
    <Card title="ErrorSpikeAlerts" note="Idea 54168">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Server errors per 100 requests ({errors})
        <input type="range" min="0" max="40" value={errors} onChange={e => setErrors(Number(e.target.value))} />
      </label>
      <Bar label="Error rate" value={row.errorRate} max={0.4} />
    </Card>
  );
}
export function LoginPageAvailabilityChecks() {
  const [formShown, setFormShown] = useState(true);
  const v = X105A.checkLoginPageAvailability([{ target: 'shop', loginUrl: 'https://shop.example.com/login', statusCode: 200, hasLoginForm: formShown }]);
  const row = v.rows[0];
  return (
    <Card title="LoginPageAvailabilityChecks" note="Idea 54169">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Login form rendered
        <input type="checkbox" checked={formShown} onChange={e => setFormShown(e.target.checked)} />
      </label>
    </Card>
  );
}
export function ApiEndpointChecks() {
  const [versionDown, setVersionDown] = useState(false);
  const routes = [
    { path: '/health', statusCode: 200, schemaValid: true },
    { path: '/version', statusCode: versionDown ? 500 : 200, schemaValid: true },
  ];
  const v = X105A.checkApiEndpoints([{ target: 'api', routes }]);
  const row = v.rows[0];
  return (
    <Card title="ApiEndpointChecks" note="Idea 54170">
      <Kv k="Status" v={row.status} />
      <Kv k="Failing routes" v={row.failingPaths.join(', ') || 'none'} />
      <button type="button" onClick={() => setVersionDown(d => !d)}>{versionDown ? 'Restore /version' : 'Break /version'}</button>
    </Card>
  );
}
export function SyntheticTransactionChecks() {
  const [failStep, setFailStep] = useState(-1);
  const steps = [
    { name: 'open-home', ok: failStep !== 0, durationMs: 300 },
    { name: 'search', ok: failStep !== 1, durationMs: 450 },
    { name: 'signup', ok: failStep !== 2, durationMs: 700 },
  ];
  const v = X105A.runSyntheticTransactions([{ target: 'shop', flow: 'signup-journey', steps }]);
  const row = v.rows[0];
  return (
    <Card title="SyntheticTransactionChecks" note="Idea 54171">
      <Kv k="Status" v={row.status} />
      <Kv k="Failed step" v={row.failedStep || 'none'} />
      <label className="w105a-field">Fail step index (-1 = none)
        <input type="number" min="-1" max="2" value={failStep} onChange={e => setFailStep(Number(e.target.value))} />
      </label>
    </Card>
  );
}
export function WebSocketHealthChecks() {
  const [frames, setFrames] = useState(true);
  const v = X105A.checkWebSocketHealth([{ target: 'chat', endpoint: 'wss://chat.example.com/socket', connects: true, handshakeMs: 84, receivesFrames: frames }]);
  const row = v.rows[0];
  return (
    <Card title="WebSocketHealthChecks" note="Idea 54172">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Frames arriving
        <input type="checkbox" checked={frames} onChange={e => setFrames(e.target.checked)} />
      </label>
    </Card>
  );
}
export function GraphqlHealthQueries() {
  const [exposed, setExposed] = useState(false);
  const v = X105A.checkGraphqlHealth([{ target: 'api', endpoint: 'https://api.example.com/graphql', statusCode: 200, dataPresent: true, introspectionExposed: exposed }]);
  const row = v.rows[0];
  return (
    <Card title="GraphqlHealthQueries" note="Idea 54173">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Introspection exposed
        <input type="checkbox" checked={exposed} onChange={e => setExposed(e.target.checked)} />
      </label>
      <Kv k="Note" v={row.note} />
    </Card>
  );
}
export function JsRenderedPageChecks() {
  const [rawEmpty, setRawEmpty] = useState(true);
  const v = X105A.checkJsRenderedPages([{ target: 'app', rawHasContent: !rawEmpty, renderedHasContent: true, renderErrors: 0 }]);
  const row = v.rows[0];
  return (
    <Card title="JsRenderedPageChecks" note="Idea 54174">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Raw HTML empty (JS app shell)
        <input type="checkbox" checked={rawEmpty} onChange={e => setRawEmpty(e.target.checked)} />
      </label>
    </Card>
  );
}
export function MultiRegionChecks() {
  const [downRegion, setDownRegion] = useState('none');
  const regions = ['us', 'eu', 'ap'].map(region => ({ region, status: region === downRegion ? 'down' : 'up' }));
  const v = X105A.checkMultiRegion([{ target: 'shop', regions }]);
  const row = v.rows[0];
  return (
    <Card title="MultiRegionChecks" note="Idea 54175">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Region down
        <select value={downRegion} onChange={e => setDownRegion(e.target.value)}>
          <option value="none">none</option>
          <option value="us">us</option>
          <option value="eu">eu</option>
          <option value="ap">ap</option>
        </select>
      </label>
      <Kv k="Down regions" v={row.downRegions.join(', ') || 'none'} />
    </Card>
  );
}
export function Ipv6ReachabilityChecks() {
  const [aaaa, setAaaa] = useState(true);
  const v = X105A.checkIpv6Reachability([{ target: 'shop', hasAaaa: aaaa, ipv6Connects: true, ipv4Connects: true }]);
  const row = v.rows[0];
  return (
    <Card title="Ipv6ReachabilityChecks" note="Idea 54176">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">AAAA record published
        <input type="checkbox" checked={aaaa} onChange={e => setAaaa(e.target.checked)} />
      </label>
    </Card>
  );
}
export function HttpProtocolChecks() {
  const [negotiated, setNegotiated] = useState('h2');
  const v = X105A.checkHttpProtocols([{ target: 'shop', advertised: ['h2', 'h3'], negotiated }]);
  const row = v.rows[0];
  return (
    <Card title="HttpProtocolChecks" note="Idea 54177">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Negotiated protocol
        <select value={negotiated} onChange={e => setNegotiated(e.target.value)}>
          <option value="h2">h2</option>
          <option value="h3">h3</option>
          <option value="http/1.1">http/1.1</option>
        </select>
      </label>
      <Kv k="Not negotiated" v={row.missing.join(', ') || 'none'} />
    </Card>
  );
}
export function OcspStaplingChecks() {
  const [stapled, setStapled] = useState(true);
  const v = X105A.checkOcspStapling([{ target: 'shop', expected: true, stapled, certValid: true }]);
  const row = v.rows[0];
  return (
    <Card title="OcspStaplingChecks" note="Idea 54178">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Stapled response delivered
        <input type="checkbox" checked={stapled} onChange={e => setStapled(e.target.checked)} />
      </label>
    </Card>
  );
}
export function HstsHeaderChecks() {
  const [maxAge, setMaxAge] = useState(365);
  const v = X105A.checkHstsHeaders([{ target: 'shop', hstsPresent: true, maxAgeDays: maxAge, includeSubDomains: true }]);
  const row = v.rows[0];
  return (
    <Card title="HstsHeaderChecks" note="Idea 54179">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">HSTS max-age (days {maxAge})
        <input type="range" min="0" max="730" step="5" value={maxAge} onChange={e => setMaxAge(Number(e.target.value))} />
      </label>
    </Card>
  );
}
export function PortHealthChecks() {
  const [extraClosed, setExtraClosed] = useState(false);
  const v = X105A.checkPortHealth([{ target: 'iot-hub', expectedPorts: [443, 8443], openPorts: extraClosed ? [443] : [443, 8443] }]);
  const row = v.rows[0];
  return (
    <Card title="PortHealthChecks" note="Idea 54180">
      <Kv k="Status" v={row.status} />
      <label className="w105a-field">Port 8443 firewalled
        <input type="checkbox" checked={extraClosed} onChange={e => setExtraClosed(e.target.checked)} />
      </label>
      <Kv k="Closed ports" v={row.closedPorts.join(', ') || 'none'} />
    </Card>
  );
}

export const WAVE105_A_COMPONENTS = [ResponseTimeTracking, HomepageContentHashChecks, KeywordPresenceChecks, MaintenancePageDetection, RedirectLoopDetection, WafBlockDetection, RateLimitSignalDetection, ErrorSpikeAlerts, LoginPageAvailabilityChecks, ApiEndpointChecks, SyntheticTransactionChecks, WebSocketHealthChecks, GraphqlHealthQueries, JsRenderedPageChecks, MultiRegionChecks, Ipv6ReachabilityChecks, HttpProtocolChecks, OcspStaplingChecks, HstsHeaderChecks, PortHealthChecks];

export function Wave105AGallery() {
  return (
    <div className="w105a-gallery">
      {WAVE105_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
