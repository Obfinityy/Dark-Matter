// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import {
  spawnHuntContainer,
  teardownHuntContainer,
  execInHuntContainer,
  execInHuntContainerWithRespawn,
  dockerAvailable,
} from '../huntRunner.js';
import { webSearch, searchCVE } from '../webSearch.js';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';
import {
  generateLogicTests,
  evidenceGate,
  verifyPipeline,
  executionFailed,
  httpErrorStatus,
  evidenceReproduced,
  assessContentRelevance,
  evidenceSignalIds,
  supportingSignalLines,
  extractLinkedAssetUrls,
  beamSearchChains,
  analyzeFindings,
  mineJsEndpoints,
  rankEndpoints,
  blModulesFor,
  classifyTarget,
  scoreWeirdness,
  isWorthInvestigating,
  recordHuntExperience,
  getPlaybook,
  encodePayload,
  ENCODERS,
  fingerprintWaf,
  classifyFinding,
  sweepSiblings,
  buildSweepProbe,
  backfillVerifiedClasses,
} from '../hunt-intel/index.js';
import { extractSignal, extractTestsFromThinking, finding, fnv1aHex, inferAppPurpose, isPaused, isStopped, repairShellQuoting, sanitizeForAI, stripTerminalArtifacts, think, waitWhilePaused } from './text.js';

/** Phase 1: recon inside the container. Returns {ports, endpoints, profile}. */
export async function reconPhase(huntId, target) {
  think(huntId, 'I started mapping the attack surface — checking what this target exposes.');
  const host = target.replace(/^https?:\/\//, '').split('/')[0];
  const recon = { ports: [], endpoints: [], profile: 'generic' };

  // Port scan
  const nmap = await execInHuntContainer(huntId, `nmap -T4 --top-ports 200 ${host} 2>/dev/null | grep -E "^[0-9]+/tcp.*open" | head -20`);
  for (const line of nmap.stdout.split('\n').filter(Boolean)) {
    const m = /^(\d+)\/tcp\s+open\s+(\S+)/.exec(line.trim());
    if (m) {
      recon.ports.push({ port: m[1], service: m[2] });
      appendHuntEvent(huntId, { type: 'tool_call', tool: 'nmap', detail: `open ${m[1]}/${m[2]}` });
    }
  }

  // BROWSER EXPLORATION REMOVED (#348): the Playwright module was dead
  // (Playwright is not installed, so every call failed), broken
  // (shell `node -e` + `new Function` with interpolated target/payload),
  // and latently injectable. Recon continues with the curl homepage
  // fetch below, which is what actually worked. A browser capability
  // may be re-added later as a properly built feature (installed
  // dependency, file-based scripts, serialized args) — not by
  // reviving this module (see git history if needed).

  // Fetch homepage HTML for JS mining + profiling + TECH DETECTION
  // bypassTmux: tmux truncates to 50 lines; we need the full HTML body.
  const curl = await execInHuntContainer(
    huntId,
    `curl -skL --max-time 25 -A "Mozilla/5.0" -D /tmp/headers.txt "${target}" 2>/dev/null | head -c 200000; echo "---HEADERS---"; cat /tmp/headers.txt 2>/dev/null | head -30`,
    120000,
    { bypassTmux: true }
  );
  const html = curl.stdout || '';
  if (html) {
    const [bodyPart, headerPart] = html.split('---HEADERS---');
    const mined = mineJsEndpoints(bodyPart || html);
    // JS BUNDLE MINING: SPAs (Angular/React/Vue) keep API endpoints in JS
    // bundles, not HTML. Download local <script src> bundles and mine them.
    // Without this, the agent is blind to modern web apps.
    // NOTE: mining happens INSIDE the container via grep — the exec channel
    // (tmux) truncates large outputs, so we only return the matched lines.
    try {
      const scriptSrcs = [...(bodyPart || html).matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1])
        .filter((src) => !src.startsWith('http') && !src.startsWith('//'))
        .slice(0, 5);
      if (scriptSrcs.length) {
        think(huntId, `Mining ${scriptSrcs.length} JS bundles for hidden endpoints.`);
        const base = target.replace(/\/$/, '');
        for (const src of scriptSrcs) {
          const jsUrl = src.startsWith('/') ? base + src : base + '/' + src;
          try {
            const jsRes = await execInHuntContainer(
              huntId,
              `curl -skL --max-time 15 -A "Mozilla/5.0" "${jsUrl}" 2>/dev/null | grep -oE '"/(api|rest|v[0-9]+|admin|graphql|internal)[^"]*"' | head -30`,
            );
            const lines = (jsRes.stdout || '').split('\n').filter(Boolean);
            for (const line of lines) {
              const ep = line.replace(/"/g, '').trim();
              // FIX (19 Oct 2026, solver #6): Validate endpoint format.
              // Raw stdout includes Kali MOTD lines, shell prompts, and command
              // echoes — these were added as "endpoints" (e.g., the MOTD line
              // containing "hushlogin" matched the /login/ filter, corrupting
              // the mandatory SQLi test URL). Only accept actual path-like endpoints.
              if (!/^\/(api|rest|v\d+|admin|graphql|internal)(\/|$|[?#])/.test(ep)) continue;
              if (ep.length > 2 && ep.length < 200 && !mined.includes(ep)) mined.push(ep);
            }
          } catch { /* skip failed bundle */ }
        }
        think(huntId, `Bundle mining found ${mined.length} total endpoints.`);
      }
    } catch { /* bundle mining is best-effort */ }
    recon.endpoints = rankEndpoints(mined).slice(0, 30);
    recon.profile = classifyTarget(recon.endpoints);
    recon.purpose = inferAppPurpose(recon.endpoints, bodyPart || html);
    
    // INTELLIGENT TECH DETECTION — think first, then act
    try {
      const { detectTechnologies, getToolChain, buildIntelligentPrompt } = await import('../toolChains.js');
      const detection = detectTechnologies(headerPart || '', bodyPart || html, target);
      recon.detection = detection;
      recon.intelligentPrompt = buildIntelligentPrompt(detection, target, []);
      // KNOWN APP (zero-genuine lane): the fingerprint names the app —
      // persisted on recon (checkpoint write at resume) so every later
      // iteration, and the human loop, can gate on it. The purpose is
      // recomputed from the fingerprint: keyword regexes over a
      // leaked-endpoint list mis-modelled DVWA as an ecommerce store.
      recon.knownApp = detection.app || null;
      if (recon.knownApp) {
        recon.purpose = inferAppPurpose(recon.endpoints, bodyPart || html, recon.knownApp);
      }
      
      const techList = detection.techs.length ? detection.techs.join(', ') : 'unknown';
      const dbInfo = detection.database ? `Database: ${detection.database}` : 'No database detected';
      think(huntId, `I analyzed the target: [${techList}]. ${dbInfo}. I will only run appropriate tests.`);
      
      // Get intelligent tool chain based on detection
      const chain = getToolChain(detection, target);
      recon.toolChain = chain;
      think(huntId, `My attack plan has ${chain.length} targeted steps based on what I found.`);
      
      appendHuntEvent(huntId, {
        type: 'recon_intel',
        techs: detection.techs,
        database: detection.database,
        chainSteps: chain.length,
      });

      // FIX #40: Web search for CVEs on detected technologies.
      // Trigger only when we have concrete tech names to avoid noise.
      if (detection.techs && detection.techs.length > 0) {
        try {
          const topTech = detection.techs.slice(0, 2);
          think(huntId, `Searching for known vulnerabilities in: ${topTech.join(', ')}`);
          const cveResults = [];
          for (const tech of topTech) {
            const results = await searchCVE(tech, '');
            cveResults.push(...results.slice(0, 2));
          }
          if (cveResults.length > 0) {
            recon.cveIntel = cveResults;
            think(huntId, `Found ${cveResults.length} relevant CVE references.`);
            appendHuntEvent(huntId, {
              type: 'cve_intel',
              techs: topTech,
              results: cveResults.map(r => ({ title: r.title, url: r.url })),
            });
          }
        } catch (err) {
          // Web search is best-effort, never blocks the hunt
          console.error('[hunt] CVE search failed:', err.message);
        }
      }
    } catch (err) {
      console.error('[hunt] tech detection failed:', err.message);
    }
    
    think(huntId, `I mapped ${mined.length} endpoints. This looks like: ${recon.profile} (${recon.purpose}).`);
  }

  // Nuclei quick scan
  const nuclei = await execInHuntContainer(huntId, `nuclei -u "${target}" -silent -json 2>/dev/null | head -30`, 300000);
  for (const line of nuclei.stdout.split('\n').filter(Boolean)) {
    try {
      const nj = JSON.parse(line);
      const cand = {
        class: nj.info?.severity ? `nuclei_${nj['template-id'] || 'finding'}` : 'nuclei_finding',
        title: nj.info?.name || 'nuclei finding',
        severity: (nj.info?.severity || 'medium').toLowerCase(),
        url: nj['matched-at'] || target,
        evidence: { request: `nuclei ${nj['template-id']}`, response: line.slice(0, 500) },
      };
      // Gate EVERYTHING through evidence + verification — no raw scanner output ships
      const { pass, gated } = evidenceGate(cand);
      if (pass) {
        const v = verifyPipeline({ reachability: true, payload_validation: true, impact_assessment: true, exploit_confirmation: false });
        finding(huntId, { ...gated, verification: v.verdict });
      }
    } catch { /* skip malformed lines */ }
  }

  return recon;
}

/**
 * CONTENT-RELEVANCE BASELINES (solver #454, Job 7 item C): the target's
 * generic response bodies — its root page and a canary path that returns
 * the SPA fallback / generic error — fetched through the hunt container
 * with the same exec path the probes use, normalised exactly like
 * assessResult output, cached per hunt for 10 minutes. The relevance
 * judgement (hunt-intel/differential.js) compares a candidate's
 * signal-bearing text against these bodies: signal words that are part
 * of the site's ambient content cannot prove a vulnerability.
 * Returns null when no baseline could be fetched (the judgement then
 * abstains on the novelty limb rather than blocking blind).
 */
const baselineCache = new Map(); // huntId -> { at, texts }

export async function getTargetBaselines(huntId, target) {
  const hit = baselineCache.get(huntId);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.texts;
  try {
    const base = String(target || '').replace(/\/+$/, '');
    if (!base) return null;
    const cmd = `curl -sk -m 15 ${JSON.stringify(base + '/')}; printf '\n==DM-CANARY==\n'; curl -sk -m 15 ${JSON.stringify(base + '/dm-baseline-canary-7f3a')}`;
    const res = await execInHuntContainer(huntId, cmd, 60000, { bypassTmux: true });
    const raw = String((res && res.stdout) || '');
    if (executionFailed(res, raw + '\n' + String((res && res.stderr) || '')) || !raw.trim()) return null;
    const texts = raw.split('==DM-CANARY==')
      .map((p) => stripTerminalArtifacts(sanitizeForAI(p)).slice(0, 20000))
      .filter((t) => t.trim().length > 0);
    if (!texts.length) return null;
    // Corpus extension (solver #456, Job 8 item 3): the root HTML shell is
    // not the whole ambient surface — its linked CSS/JS assets are generic
    // target content too, and asset-shaped stamps (#233/#256 family) must
    // be judged against the real asset bodies. Same-origin only (the
    // extractor enforces it), bounded count + per-asset bytes. Any failure
    // here falls back to the shell-only corpus — never worse than before.
    try {
      const assetUrls = extractLinkedAssetUrls(texts[0], base + '/');
      if (assetUrls.length) {
        const acmd = assetUrls
          .map((u) => `curl -sk -m 10 ${JSON.stringify(u)} | head -c 262144`)
          .join("; printf '\\n==DM-ASSET==\\n'; ");
        const ares = await execInHuntContainer(huntId, acmd, 90000, { bypassTmux: true });
        const araw = String((ares && ares.stdout) || '');
        if (araw.trim() && !executionFailed(ares, araw + '\n' + String((ares && ares.stderr) || ''))) {
          for (const part of araw.split('==DM-ASSET==')) {
            const t = stripTerminalArtifacts(sanitizeForAI(part)).slice(0, 20000);
            if (t.trim().length > 0) texts.push(t);
          }
        }
      }
    } catch { /* asset corpus is best-effort; shell corpus still applies */ }
    baselineCache.set(huntId, { at: Date.now(), texts });
    return texts;
  } catch {
    return null;
  }
}
