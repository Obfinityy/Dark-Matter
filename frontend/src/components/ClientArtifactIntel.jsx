import { useMemo, useState } from 'react';
import {
  extractAjvSchemas,
  inferEndpointsFromAjv,
  detectOpenApiCodegen,
  mineMswHandlers,
} from '../../backend/src/engines/clientArtifactRecon.js';
import {
  enumerateStorybookStories,
  mapChromaticSnapshots,
  minePlaywrightArtifacts,
  harvestCypressSpecUrls,
  detectSeleniumHubs,
  mineTestFixtures,
  extractSeedDataUrls,
} from '../../backend/src/engines/testArtifactMiner.js';

const SAMPLE = `/* generated using openapi-typescript-codegen -- do not edit */
import Ajv from 'ajv';
const ajv = new Ajv();
const userSchema = {
  $id: 'https://api.example.com/schemas/user',
  type: 'object',
  properties: { userId: { type: 'string' }, email: { type: 'string' } },
  required: ['userId']
};
const validate = ajv.compile(userSchema);
async function loadUser() { await fetch('/api/v1/users/me'); }
export class UserService {
  public static getUser() { return __request(OpenAPI, { method: 'GET', path: '/api/v1/users/{userId}' }); }
}
OpenAPI.BASE = 'https://api.example.com';
import { rest } from 'msw';
export const handlers = [rest.get('/api/v1/invoices', (req, res, ctx) => res(ctx.json([])))];
export default { title: 'Forms/LoginForm' };
export const Empty = { args: { username: '', rememberMe: false } };
test('admin login', async ({ page }) => { await page.goto('https://app.example.com/admin/login'); });
cy.visit('/shop/checkout');
const driver = new RemoteWebDriver(new URL('http://selenium-hub.internal:4444/wd/hub'), caps);
await prisma.user.create({ data: { email: 'seed@example.com' } });`;

function Section({ title, children }) {
  return (
    <div className="w961c-section">
      <h3 className="w961c-section-title">{title}</h3>
      {children}
    </div>
  );
}

function Kv({ rows }) {
  if (!rows.length) return <p className="w961c-empty">Not detected in this artifact.</p>;
  return (
    <ul className="w961c-list">
      {rows.map((r, i) => (
        <li key={i} className="w961c-item">
          <span className="w961c-val w961c-mono">{r}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ClientArtifactIntel() {
  const [input, setInput] = useState(SAMPLE);

  const findings = useMemo(() => {
    const schemas = extractAjvSchemas(input);
    const inferred = inferEndpointsFromAjv(input);
    const codegen = detectOpenApiCodegen(input);
    const msw = mineMswHandlers(input);
    const stories = enumerateStorybookStories(input);
    const chromatic = mapChromaticSnapshots(input);
    const playwright = minePlaywrightArtifacts(input);
    const cypress = harvestCypressSpecUrls(input);
    const selenium = detectSeleniumHubs(input);
    const fixtures = mineTestFixtures(input);
    const seeds = extractSeedDataUrls(input);
    return { schemas, inferred, codegen, msw, stories, chromatic, playwright, cypress, selenium, fixtures, seeds };
  }, [input]);

  return (
    <div className="w961c-root">
      <h2 className="w961c-title">Client Artifact Intel</h2>
      <p className="w961c-sub">
        Paste a fetched client bundle, test file or config (already in hand — nothing here
        makes network calls). The wave-961 engines statically recover endpoints, generated
        API shapes, mock handlers and test-infrastructure hints.
      </p>
      <textarea
        className="w961c-input"
        rows={14}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
      />
      <div className="w961c-grid">
        <Section title="961 · AJV schemas">
          <Kv rows={findings.schemas.map((s) => `${s.name || 'inline'} — props: ${s.properties.join(', ') || 'none'} — required: ${s.required.join(', ') || 'none'}`)} />
        </Section>
        <Section title="961 · Inferred endpoints">
          <Kv rows={findings.inferred.flatMap((s) => s.endpoints.map((e) => `${e.endpoint} (${e.basis})`))} />
        </Section>
        <Section title="962 · OpenAPI codegen">
          <Kv rows={[
            `generated: ${findings.codegen.isGenerated ? 'yes' : 'no'}${findings.codegen.generators.length ? ` — ${findings.codegen.generators.join(', ')}` : ''}`,
            `operations: ${findings.codegen.operationCount}`,
            ...findings.codegen.baseUrls.map((u) => `base: ${u}`),
            ...findings.codegen.specShapes.slice(0, 8).map((s) => `${s.path}${s.methods.length ? ` [${s.methods.join(', ')}]` : ''}`),
          ]} />
        </Section>
        <Section title="963 · MSW handlers">
          <Kv rows={findings.msw.map((h) => `${h.method} ${h.path || h.operationName}`)} />
        </Section>
        <Section title="964 · Storybook stories">
          <Kv rows={findings.stories.map((s) => `${s.title || ''}/${s.name || s.id || ''} — props: ${s.props.join(', ') || 'none'}`)} />
        </Section>
        <Section title="965 · Chromatic snapshots">
          <Kv rows={findings.chromatic.map((c) => `${c.type}: ${c.value}`)} />
        </Section>
        <Section title="966 · Playwright artifacts">
          <Kv rows={[
            ...findings.playwright.urls.map((u) => `url: ${u.url}`),
            ...findings.playwright.testTitles.map((t) => `test: ${t.title}`),
            ...findings.playwright.credentialRefs.map((c) => `credential ref: ${c}`),
          ]} />
        </Section>
        <Section title="967 · Cypress specs">
          <Kv rows={[
            ...findings.cypress.visits.map((v) => `visit: ${v.url}`),
            ...findings.cypress.requests.map((r) => `${r.method} ${r.url}`),
            ...findings.cypress.fixtures.map((f) => `fixture: ${f}`),
          ]} />
        </Section>
        <Section title="968 · Selenium hubs">
          <Kv rows={[
            ...findings.selenium.hubs.map((h) => h.url),
            `grid console refs: ${findings.selenium.usesGridConsole ? 'yes' : 'no'}`,
            `RemoteWebDriver refs: ${findings.selenium.remoteDriverRefs}`,
          ]} />
        </Section>
        <Section title="969 · Fixture data">
          <Kv rows={findings.fixtures.slice(0, 10).map((f) => `${f.kind}: ${f.field} = ${f.value}`)} />
        </Section>
        <Section title="970 · Seed data">
          <Kv rows={findings.seeds.map((s) => `${s.kind}: ${s.value}`)} />
        </Section>
      </div>
      <style>{`
        .w961c-root { padding: 24px; max-width: 1080px; margin: 0 auto; color: #e6e6e6; font-family: inherit; }
        .w961c-title { font-size: 22px; margin: 0 0 6px; }
        .w961c-sub { margin: 0 0 16px; color: #9a9a9a; font-size: 14px; }
        .w961c-input { width: 100%; box-sizing: border-box; background: #111; color: #d8d8d8; border: 1px solid #333; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; resize: vertical; }
        .w961c-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 16px; }
        .w961c-section { background: #161616; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px; }
        .w961c-section-title { font-size: 14px; margin: 0 0 10px; color: #f0c75e; }
        .w961c-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .w961c-item { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
        .w961c-val { color: #e0e0e0; word-break: break-word; }
        .w961c-mono { font-family: monospace; }
        .w961c-empty { color: #6f6f6f; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}
