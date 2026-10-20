// Dark Matter — PRIVATE RECALL EVAL (Job 6 closing measurement).
// Run on EC2: /opt/node24/bin/node scripts/recall-eval.mjs [huntId]
//
// The research report's non-negotiable: vendor memory numbers are
// disputed and NOTHING is published for an 8B local model — so memory
// quality gets measured here, on the agent's own hunt history, or not
// claimed at all. Every question's ground truth comes from the recorded
// history itself (the 3 audited verified classes, exact identifiers
// from real evidence, the top dead-end families, and episodes sampled
// live from the ledger). Scoring: does retrieveEpisodes surface a
// ground-truth episode in the top 5 (hit@5) / top 8 (hit@8)?
// This is a measurement, not a gate: it always exits 0 and prints the
// misses verbatim so the number can be trusted.

const huntId = process.argv[2] || 'h_bench_d69e5746';
const es = await import('../src/episodeStore.js');

const has = (ep, re) => re.test(`${ep.title || ''}\n${ep.body || ''}`);
const verifiedWith = (re) => (ep) => ep.kind === 'finding' && ep.outcome === 'verified' && has(ep, re);

const QUESTIONS = [
  // — The 3 audited verified classes, 4 phrasings each —
  { cat: 'verified', q: 'sql injection login bypass', match: verifiedWith(/sql/i) },
  { cat: 'verified', q: 'how did you get admin access to this app', match: verifiedWith(/sql/i) },
  { cat: 'verified', q: 'authentication bypass vulnerability confirmed', match: verifiedWith(/sql/i) },
  { cat: 'verified', q: 'which injection gave a valid admin token', match: verifiedWith(/sql/i) },
  { cat: 'verified', q: 'xxe external entity file disclosure', match: verifiedWith(/xxe/i) },
  { cat: 'verified', q: 'xml upload reading server files', match: verifiedWith(/xxe/i) },
  { cat: 'verified', q: 'how was /etc/passwd read from the target', match: verifiedWith(/xxe/i) },
  { cat: 'verified', q: 'file upload vulnerability that was verified', match: verifiedWith(/xxe|file/i) },
  { cat: 'verified', q: 'sensitive file exposure ftp kdbx', match: verifiedWith(/kdbx|ftp|sensitive/i) },
  { cat: 'verified', q: ' KeePass database file download'.trim(), match: verifiedWith(/kdbx/i) },
  { cat: 'verified', q: 'unauthenticated file download exposure', match: verifiedWith(/kdbx|ftp|sensitive/i) },
  { cat: 'verified', q: 'what was found in the ftp directory listing', match: verifiedWith(/kdbx|ftp/i) },
  // — Exact identifiers from real evidence —
  { cat: 'identifier', q: '/etc/passwd contents disclosed', match: (ep) => has(ep, /\/etc\/passwd/) },
  { cat: 'identifier', q: 'incident-support.kdbx', match: (ep) => has(ep, /incident-support\.kdbx/) },
  { cat: 'identifier', q: 'login endpoint /rest/user/login tests', match: (ep) => has(ep, /\/rest\/user\/login/) },
  { cat: 'identifier', q: "admin@juice-sh.op' OR 1=1 payload", match: (ep) => has(ep, /admin@juice-sh\.op/) },
  { cat: 'identifier', q: '/file-upload endpoint probes', match: (ep) => has(ep, /\/file-upload/) },
  { cat: 'identifier', q: 'PRETTY_NAME Distroless os-release disclosure', match: (ep) => has(ep, /os-release|Distroless/) },
  // — Dead ends the validator ruled out —
  { cat: 'dead-end', q: 'abnormal endpoint parameter manipulation attempts', match: (ep) => has(ep, /abnormal_endpoint_parameter_manipulation|abnormal endpoint/i) },
  { cat: 'dead-end', q: 'unauthorized access without authentication tries', match: (ep) => has(ep, /unauthorized access without authentication/i) },
  { cat: 'dead-end', q: 'unusual http status codes findings', match: (ep) => has(ep, /unusual http status/i) },
  { cat: 'dead-end', q: 'docker exec command failed executions', match: (ep) => has(ep, /Command failed: docker exec/) },
  // — Chaining —
  { cat: 'chain', q: 'jwt chain pursuit after login bypass', match: (ep) => has(ep, /chain/i) && has(ep, /jwt/i) },
  { cat: 'chain', q: 'whoami with the captured admin token', match: (ep) => has(ep, /whoami/) },
];

// Auto-sampled: real test episodes from the ledger itself — can
// retrieval find a known episode from its own salient terms?
const pool = es.queryEpisodes(huntId, { kind: 'test', limit: 400 })
  .filter((e) => e.title && e.title.length > 30);
const seen = new Set();
for (const ep of pool) {
  if (QUESTIONS.length >= 40) break;
  const key = ep.title.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const probe = ep.title.replace(/^(test|try|check|probe|attempt)\s+/i, '').slice(0, 60);
  QUESTIONS.push({ cat: 'sampled', q: probe, match: (e) => e.id === ep.id, sampledId: ep.id });
  if (QUESTIONS.filter((x) => x.cat === 'sampled').length >= 8) break;
}

let hit5 = 0;
let hit8 = 0;
const byCat = {};
for (const item of QUESTIONS) {
  const { results } = await es.retrieveEpisodes(item.q, { huntId, limit: 8 });
  const idx = results.findIndex((r) => item.match(r));
  const h5 = idx >= 0 && idx < 5;
  const h8 = idx >= 0;
  if (h5) hit5++;
  if (h8) hit8++;
  byCat[item.cat] = byCat[item.cat] || { n: 0, h5: 0 };
  byCat[item.cat].n++;
  if (h5) byCat[item.cat].h5++;
  console.log(`${h5 ? 'HIT ' : h8 ? 'hit8' : 'MISS'}  [${item.cat}] ${item.q}${h5 || h8 ? ` (rank ${idx + 1})` : ` — top: "${(results[0]?.title || 'none').slice(0, 70)}"`}`);
}

const n = QUESTIONS.length;
console.log(`\nRECALL EVAL — hunt ${huntId}`);
console.log(`questions: ${n}  hit@5: ${hit5} (${Math.round((hit5 / n) * 100)}%)  hit@8: ${hit8} (${Math.round((hit8 / n) * 100)}%)`);
for (const [cat, s] of Object.entries(byCat)) {
  console.log(`  ${cat}: ${s.h5}/${s.n} hit@5`);
}
const emb = es.getEmbeddingStats();
console.log(`embedding coverage at eval time: ${emb.embedded}/${emb.episodes} episodes`);
