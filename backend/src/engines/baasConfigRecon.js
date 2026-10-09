/**
 * baasConfigRecon.js — Backend-as-a-Service config reconnaissance engine.
 *
 * Passively maps Backend-as-a-Service (BaaS) configuration references embedded
 * in a web application's own publicly served client JavaScript: Firebase,
 * AWS Amplify, Appwrite, PocketBase and Directus.
 *
 * It extracts ONLY config references — project IDs, endpoint URLs, region
 * names, bucket names and SDK usage markers — from JS text the hunt agent has
 * already fetched. API keys / tokens appearing in the config are reported as
 * config references (client identifiers baked into the bundle), never treated
 * as secrets to reuse. No network calls, no execution of target code — fully
 * deterministic.
 *
 * @module baasConfigRecon
 */

/**
 * Build the standard finding record for a harvested config reference.
 *
 * @param {string} idea - Idea number ("00981" … "00985").
 * @param {string} provider - BaaS provider name.
 * @param {string} kind - Type of reference (projectId, endpoint, region, bucket, sdkUsage, keyReference …).
 * @param {string} value - The extracted value (trimmed, non-secret config hint).
 * @param {string} source - Short excerpt of the matched code.
 * @param {number} line - 1-based line number in the source text.
 * @returns {{idea: string, provider: string, kind: string, value: string, source: string, line: number, note: string}}
 */
function finding(idea, provider, kind, value, source, line) {
  return {
    idea,
    provider,
    kind,
    value: String(value).slice(0, 220),
    source: String(source).slice(0, 120),
    line,
    note: 'Passive config-reference harvest from the target\'s own client bundle. Values are non-secret config hints only.',
  };
}

/**
 * Generic extractor: run a list of {kind, regex, valueIndex} patterns over the
 * source text, dedupe by kind+value and record line numbers.
 *
 * @param {string} src - Source text.
 * @param {string} idea - Idea number.
 * @param {string} provider - Provider name.
 * @param {Array<{kind: string, re: RegExp}>} patterns - Patterns with one capture group = value.
 * @returns {Array<object>} Deduped findings.
 */
function runPatterns(src, idea, provider, patterns) {
  const findings = [];
  const seen = new Set();
  for (const { kind, re } of patterns) {
    const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = regex.exec(src)) !== null) {
      const value = (m[1] || m[0] || '').trim();
      if (!value || value.length > 220) continue;
      const key = `${kind}::${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const line = src.slice(0, m.index).split('\n').length;
      findings.push(finding(idea, provider, kind, value, m[0], line));
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00981 — Firebase config harvesting
// ---------------------------------------------------------------------------

/**
 * Idea 00981 — Harvest Firebase config references from client JS.
 *
 * Recognises firebaseConfig object literals, initializeApp({...}) inline
 * configs, __FIREBASE_DEFAULTS__, firebase SDK init calls (compat & modular
 * v9), and Hosting /.well-known/firebase / __/firebase/init.json references.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, apiKeyReference, projectId, authDomain, databaseUrl, storageBucket, messagingSenderId, appId, measurementId}.
 */
export function extractFirebaseConfigRefs(js = '') {
  const src = String(js);
  const findings = [];

  // SDK usage markers.
  const sdkPatterns = [
    { kind: 'sdkUsage', re: /\binitializeApp\s*\(/ },
    { kind: 'sdkUsage', re: /\bfirebase\.initializeApp\s*\(/ },
    { kind: 'sdkUsage', re: /\bgetAnalytics\s*\(/ },
    { kind: 'sdkUsage', re: /\bgetFirestore\s*\(/ },
    { kind: 'sdkUsage', re: /\bgetAuth\s*\(/ },
    { kind: 'sdkUsage', re: /\b__FIREBASE_DEFAULTS__\b/ },
    { kind: 'sdkUsage', re: /\b(?:firebaseConfig|FIREBASE_CONFIG)\s*[:=]/ },
  ];
  for (const { kind, re } of sdkPatterns) {
    if (re.test(src)) {
      findings.push(finding('00981', 'firebase', kind, 'firebase-sdk-usage', re.source, src.search(re) === -1 ? 0 : src.slice(0, src.search(re)).split('\n').length));
      break; // one representative marker is enough
    }
  }

  findings.push(
    ...runPatterns(src, '00981', 'firebase', [
      { kind: 'apiKeyReference', re: /\bapiKey\s*[:=]\s*['"`](AIza[0-9A-Za-z\-_]{20,})['"`]/ },
      { kind: 'projectId', re: /\bprojectId\s*[:=]\s*['"`]([A-Za-z0-9][A-Za-z0-9\-]{2,60})['"`]/ },
      { kind: 'authDomain', re: /\bauthDomain\s*[:=]\s*['"`]([A-Za-z0-9][A-Za-z0-9.\-]{2,80})['"`]/ },
      { kind: 'databaseUrl', re: /\bdatabaseURL\s*[:=]\s*['"`](https?:\/\/[^'"`\s]{6,120})['"`]/ },
      { kind: 'databaseUrl', re: /["'`](https?:\/\/[A-Za-z0-9\-]+\.firebaseio\.com[^"'`\s]*)["'`]/ },
      { kind: 'storageBucket', re: /\bstorageBucket\s*[:=]\s*['"`]([A-Za-z0-9][A-Za-z0-9.\-]{2,80})['"`]/ },
      { kind: 'messagingSenderId', re: /\bmessagingSenderId\s*[:=]\s*['"`]?(\d{6,15})['"`]?/ },
      { kind: 'appId', re: /\bappId\s*[:=]\s*['"`](1:\d+:[a-z]+:[0-9a-f]{16,})['"`]/ },
      { kind: 'measurementId', re: /\bmeasurementId\s*[:=]\s*['"`](G-[0-9A-Z]{8,12})['"`]/ },
      { kind: 'authDomain', re: /\b["'`]([A-Za-z0-9][A-Za-z0-9\-]{2,60}\.firebaseapp\.com)["'`]/ },
      { kind: 'authDomain', re: /\b["'`]([A-Za-z0-9][A-Za-z0-9\-]{2,60}\.web\.app)["'`]/ },
    ]),
  );

  // Hosting auto-config reference: /__/firebase/init.json or init.js.
  if (/["'`]\/__\/firebase\/init\.(?:json|js)["'`]/.test(src)) {
    findings.push(finding('00981', 'firebase', 'hostingConfigRef', '/__/firebase/init.json', '/__/firebase/init.json', 0));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00982 — Amplify backend-config mining
// ---------------------------------------------------------------------------

/**
 * Idea 00982 — Mine AWS Amplify backend configs from client JS.
 *
 * Recognises aws-exports.js style config objects (aws_appsync_graphqlEndpoint,
 * aws_user_files_s3_bucket, aws_cognito_*, aws_project_region …) and
 * Amplify.configure(...) / API.graphql usage.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, region, appsyncEndpoint, s3Bucket, cognitoUserPoolId, cognitoClientId, identityPoolId, cloudLogicEndpoint}.
 */
export function extractAmplifyConfigRefs(js = '') {
  const src = String(js);
  const findings = [];

  const sdkMarkers = [
    { re: /\bAmplify\.configure\s*\(/, value: 'Amplify.configure' },
    { re: /\baws-amplify\b/, value: 'aws-amplify import' },
    { re: /\bAPI\.graphql\s*\(/, value: 'API.graphql' },
    { re: /\bAuth\.currentSession\s*\(/, value: 'Auth.currentSession' },
    { re: /\baws_project_region\s*[:=]/, value: 'aws-exports config object' },
  ];
  for (const { re, value } of sdkMarkers) {
    const idx = src.search(re);
    if (idx !== -1) {
      findings.push(finding('00982', 'amplify', 'sdkUsage', value, re.source, src.slice(0, idx).split('\n').length));
      break;
    }
  }

  findings.push(
    ...runPatterns(src, '00982', 'amplify', [
      { kind: 'region', re: /\baws_project_region\s*[:=]\s*['"`]([a-z]{2}-[a-z]+-\d{1,2})['"`]/ },
      { kind: 'appsyncEndpoint', re: /\baws_appsync_graphqlEndpoint\s*[:=]\s*['"`](https?:\/\/[A-Za-z0-9.\-]{4,120}\.amazonaws\.com\/graphql)["'`]/ },
      { kind: 'appsyncEndpoint', re: /\b["'`](https?:\/\/[A-Za-z0-9]{8,60}\.appsync-api\.[a-z]{2}-[a-z]+-\d{1,2}\.amazonaws\.com\/graphql)["'`]/ },
      { kind: 's3Bucket', re: /\baws_user_files_s3_bucket\s*[:=]\s*['"`]([a-z0-9.\-]{3,63})['"`]/ },
      { kind: 's3Bucket', re: /\baws_user_files_s3_bucket_region\s*[:=]\s*['"`]([a-z]{2}-[a-z]+-\d{1,2})['"`]/ },
      { kind: 'cognitoUserPoolId', re: /\baws_user_pools_id\s*[:=]\s*['"`]([a-z]{2}-[a-z]+-\d{1,2}_[A-Za-z0-9]{6,30})['"`]/ },
      { kind: 'cognitoClientId', re: /\baws_user_pools_web_client_id\s*[:=]\s*['"`]([a-z0-9]{10,40})['"`]/ },
      { kind: 'identityPoolId', re: /\baws_cognito_identity_pool_id\s*[:=]\s*['"`]([a-z]{2}-[a-z]+-\d{1,2}:[0-9a-f\-]{20,40})['"`]/ },
      { kind: 'cloudLogicEndpoint', re: /\baws_cloud_logic_custom\s*[:=]\s*\[[^\]]{0,400}?["'`](https?:\/\/[^'"`\s]{8,140})["'`]/ },
      { kind: 'endpoint', re: /\bendpoint\s*[:=]\s*['"`](https?:\/\/[A-Za-z0-9\-]+\.execute-api\.[a-z]{2}-[a-z]+-\d{1,2}\.amazonaws\.com\/[^'"`\s]*)["'`]/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00983 — Appwrite endpoint extraction
// ---------------------------------------------------------------------------

/**
 * Idea 00983 — Extract Appwrite endpoint URLs and project IDs from client JS.
 *
 * Recognises new Appwrite()/Client(), .setEndpoint()/.setProject() chains,
 * NEXT_PUBLIC_APPWRITE_* env references and databases.collections SDK calls.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, endpoint, projectId, envReference, collectionCall}.
 */
export function extractAppwriteConfigRefs(js = '') {
  const src = String(js);
  const findings = [];

  const sdkMarkers = [
    { re: /\bnew\s+Appwrite\s*\(/, value: 'new Appwrite()' },
    { re: /\bnew\s+Client\s*\(\s*\)\s*\.setEndpoint/, value: 'Client().setEndpoint' },
    { re: /\bappwrite\b/i, value: 'appwrite sdk import' },
  ];
  for (const { re, value } of sdkMarkers) {
    const idx = src.search(re);
    if (idx !== -1) {
      findings.push(finding('00983', 'appwrite', 'sdkUsage', value, re.source, src.slice(0, idx).split('\n').length));
      break;
    }
  }

  findings.push(
    ...runPatterns(src, '00983', 'appwrite', [
      { kind: 'endpoint', re: /\.setEndpoint\(\s*['"`](https?:\/\/[^'"`\s]{6,120}\/v1(?:\/[^'"`\s]*)?)['"`]/ },
      { kind: 'endpoint', re: /\b(?:APPWRITE_ENDPOINT|NEXT_PUBLIC_APPWRITE_ENDPOINT)\s*[:=]\s*['"`](https?:\/\/[^'"`\s]{6,120})['"`]/ },
      { kind: 'projectId', re: /\.setProject\(\s*['"`]([A-Za-z0-9]{8,40})['"`]/ },
      { kind: 'projectId', re: /\b(?:APPWRITE_PROJECT_ID|NEXT_PUBLIC_APPWRITE_PROJECT_ID)\s*[:=]\s*['"`]([A-Za-z0-9]{8,40})['"`]/ },
      { kind: 'envReference', re: /process\.env\.(NEXT_PUBLIC_APPWRITE_[A-Z_]+)/ },
      { kind: 'envReference', re: /import\.meta\.env\.(VITE_APPWRITE_[A-Z_]+)/ },
      { kind: 'collectionCall', re: /\b(?:databases|db)\.(?:listDocuments|getDocument|createDocument)\(\s*['"`]([A-Za-z0-9_\-]{2,40})['"`]\s*,\s*['"`]([A-Za-z0-9_\-]{2,40})['"`]/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00984 — PocketBase URL discovery
// ---------------------------------------------------------------------------

/**
 * Idea 00984 — Discover PocketBase instances from client SDK configs.
 *
 * Recognises new PocketBase('<url>'), PocketBase.fromUrl, pb.collection(...)
 * access, admin auth calls and pocketbase esm import markers.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, instanceUrl, collectionAccess, adminAuthCall}.
 */
export function extractPocketBaseConfigRefs(js = '') {
  const src = String(js);
  const findings = [];

  const sdkMarkers = [
    { re: /\bnew\s+PocketBase\s*\(/, value: 'new PocketBase()' },
    { re: /\bPocketBase\.fromUrl\s*\(/, value: 'PocketBase.fromUrl' },
    { re: /\bfrom\s+['"`]pocketbase['"`]/, value: 'pocketbase import' },
    { re: /\bpocketbase\/dist\/pocketbase\.esm/, value: 'pocketbase esm bundle' },
  ];
  for (const { re, value } of sdkMarkers) {
    const idx = src.search(re);
    if (idx !== -1) {
      findings.push(finding('00984', 'pocketbase', 'sdkUsage', value, re.source, src.slice(0, idx).split('\n').length));
      break;
    }
  }

  findings.push(
    ...runPatterns(src, '00984', 'pocketbase', [
      { kind: 'instanceUrl', re: /\bnew\s+PocketBase\(\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'instanceUrl', re: /\bPocketBase\.fromUrl\(\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'instanceUrl', re: /\b(?:POCKETBASE_URL|NEXT_PUBLIC_POCKETBASE_URL|VITE_POCKETBASE_URL)\s*[:=]\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'collectionAccess', re: /\b\w+\.collection\(\s*['"`]([A-Za-z0-9_\-]{2,40})['"`]\)\.(?:getList|getOne|getFullList|create|update|delete|authWithPassword|requestPasswordReset)/ },
      { kind: 'adminAuthCall', re: /\badmins\.authWithPassword\s*\(/ },
      { kind: 'adminAuthCall', re: /\bcollection\(\s*['"`]_superusers['"`]\)/ },
    ]),
  );
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 00985 — Directus instance mapping
// ---------------------------------------------------------------------------

/**
 * Idea 00985 — Map Directus instances from SDK usage in client JS.
 *
 * Recognises new Directus('<url>'), createDirectus(...).with(rest()/graphql()),
 * directus.request(readItems('collection')) and staticToken usage markers.
 *
 * @param {string} js - Raw client JS text.
 * @returns {Array<object>} Findings with kind in {sdkUsage, instanceUrl, collectionRead, transport, tokenReference}.
 */
export function extractDirectusConfigRefs(js = '') {
  const src = String(js);
  const findings = [];

  const sdkMarkers = [
    { re: /\bnew\s+Directus\s*\(/, value: 'new Directus()' },
    { re: /\bcreateDirectus\s*\(/, value: 'createDirectus()' },
    { re: /\b@directus\/sdk\b/, value: '@directus/sdk import' },
  ];
  for (const { re, value } of sdkMarkers) {
    const idx = src.search(re);
    if (idx !== -1) {
      findings.push(finding('00985', 'directus', 'sdkUsage', value, re.source, src.slice(0, idx).split('\n').length));
      break;
    }
  }

  findings.push(
    ...runPatterns(src, '00985', 'directus', [
      { kind: 'instanceUrl', re: /\bnew\s+Directus\(\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'instanceUrl', re: /\bcreateDirectus\(\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'instanceUrl', re: /\b(?:DIRECTUS_URL|NEXT_PUBLIC_DIRECTUS_URL|VITE_DIRECTUS_URL)\s*[:=]\s*['"`](https?:\/\/[^'"`\s]{4,120})['"`]/ },
      { kind: 'collectionRead', re: /\breadItems\(\s*['"`]([A-Za-z0-9_\-]{2,40})['"`]/ },
      { kind: 'collectionRead', re: /\b\/items\/([A-Za-z0-9_\-]{2,40})(?:[?\/'"`\s]|$)/ },
      { kind: 'transport', re: /\.with\(\s*(rest|graphql|authentication|staticToken)\s*\(/ },
      { kind: 'tokenReference', re: /\bstaticToken\(\s*['"`]([A-Za-z0-9_\-.]{8,120})['"`]\s*\)/ },
      { kind: 'tokenReference', re: /\b(?:DIRECTUS_TOKEN|DIRECTUS_STATIC_TOKEN)\s*[:=]\s*['"`]([^'"`\s]{6,120})['"`]/ },
    ]),
  );
  return findings;
}

/**
 * Run all BaaS config harvesters (ideas 00981–00985) over one JS text.
 *
 * @param {string} js - Raw client JS text.
 * @returns {{firebase: Array<object>, amplify: Array<object>, appwrite: Array<object>, pocketbase: Array<object>, directus: Array<object>, total: number}}
 */
export function harvestBaasConfigs(js = '') {
  const firebase = extractFirebaseConfigRefs(js);
  const amplify = extractAmplifyConfigRefs(js);
  const appwrite = extractAppwriteConfigRefs(js);
  const pocketbase = extractPocketBaseConfigRefs(js);
  const directus = extractDirectusConfigRefs(js);
  return {
    firebase,
    amplify,
    appwrite,
    pocketbase,
    directus,
    total: firebase.length + amplify.length + appwrite.length + pocketbase.length + directus.length,
  };
}
