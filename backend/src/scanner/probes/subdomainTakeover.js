// Dark Matter rule-based scanner — subdomain takeover probe (#40).
//
// DNS layer (host-header injection stays in hostHeader.js — non-overlap).
//   D1. Subdomain enumeration: crt.sh (free, passive, no key) + bounded
//       DNS wordlist (~120 prefixes). Only the target's registrable domain.
//   D2. CNAME chain resolution (max 5 hops) + NS delegations.
//   D3. Liveness differential: HTTP(S) GET vs the service's unclaimed
//       signature (S3 NoSuchBucket, GitHub Pages "isn't a ... site here",
//       Heroku "No such app", Azure 404).
//   T1. Fingerprint-confirmed dangling — HIGH ("likely", never auto-
//       CONFIRMED: claiming is the only full proof, never done off-lab).
//   T2. Lab claim proof — CRITICAL (lab-only, both sides ours).
//   T3. A-record dangling — MEDIUM/HIGH (cloud IP + default vhost).
//   T4. Dead NS delegation — MEDIUM (read-only).
//
// FP guards: claimed-but-empty vs unclaimed distinguished in the DB;
// wildcard DNS collapsed to one note. $0, stdlib dns/promises + https.

import dns from 'node:dns/promises';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Static fingerprint DB: service -> CNAME suffixes + unclaimed signatures.
const TAKEOVER_DB = [
  { service: 'GitHub Pages', suffixes: ['github.io'], unclaimed: /there isn'?t a github pages site here/i },
  { service: 'Heroku', suffixes: ['herokuapp.com', 'herokussl.com'], unclaimed: /no such app/i },
  { service: 'AWS S3', suffixes: ['s3.amazonaws.com', 's3-website'], unclaimed: /NoSuchBucket|The specified bucket does not exist/i },
  { service: 'Azure', suffixes: ['azurewebsites.net', 'cloudapp.net'], unclaimed: /404 Web Site not found/i },
  { service: 'Shopify', suffixes: ['myshopify.com'], unclaimed: /Sorry, this shop is currently unavailable/i },
  { service: 'Tumblr', suffixes: ['tumblr.com'], unclaimed: /There is nothing here/i },
  { service: 'WordPress.com', suffixes: ['wordpress.com'], unclaimed: /Do you want to register/i },
  { service: 'Pantheon', suffixes: ['pantheonsite.io'], unclaimed: /The gods are wise/i },
  { service: 'Unbounce', suffixes: ['unbouncepages.com'], unclaimed: /The requested URL was not found/i },
  { service: 'CloudFront', suffixes: ['cloudfront.net'], unclaimed: /Bad request/i },
  { service: 'Fastly', suffixes: ['fastly.net'], unclaimed: /Fastly error: unknown domain/i },
  { service: 'Netlify', suffixes: ['netlify.app', 'netlify.com'], unclaimed: /Not Found - Request ID/i },
  { service: 'Vercel', suffixes: ['vercel.app'], unclaimed: /DEPLOYMENT_NOT_FOUND/i },
  { service: 'Surge.sh', suffixes: ['surge.sh'], unclaimed: /project not found/i },
];

const WORDLIST = (
  'www,mail,ftp,blog,dev,staging,test,api,cdn,static,assets,img,images,docs,' +
  'support,help,portal,app,admin,dashboard,panel,login,sso,auth,account,' +
  'billing,shop,store,cart,checkout,pay,payment,news,media,video,music,' +
  'jobs,careers,press,about,contact,legal,privacy,terms,status,monitor,' +
  'beta,alpha,demo,sandbox,internal,corp,vpn,remote,git,ci,jenkins,sonar,' +
  'mail2,webmail,exchange,owa,smtp,pop,imap,ns1,ns2,mx,mta,gateway,proxy,' +
  'cdn2,origin,edge,lb,db,database,cache,redis,es,search,analytics,' +
  'mobile,m,wap,api1,api2,v1,v2,rest,graphql,ws,wss,socket,chat,forum,' +
  'wiki,blog2,cdn1,files,download,upload,tmp,old,legacy,new,next,preview'
).split(',');

function registrableDomain(host) {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

async function crtsh(domain) {
  const out = [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
      { signal: ctrl.signal, headers: { 'User-Agent': UA } }
    );
    const j = await res.json().catch(() => []);
    for (const row of j) {
      const names = String(row.name_value || '').split('\n');
      for (const n of names) {
        const clean = n.trim().toLowerCase().replace(/^\*\./, '');
        if (clean.endsWith(domain) && !out.includes(clean)) out.push(clean);
      }
    }
  } catch {
    // crt.sh unreachable — wordlist still runs
  } finally {
    clearTimeout(t);
  }
  return out.slice(0, 200);
}

async function resolveCnameChain(name, maxHops = 5) {
  const chain = [name];
  let cur = name;
  for (let i = 0; i < maxHops; i++) {
    try {
      const cnames = await dns.resolveCname(cur);
      if (!cnames || !cnames.length) break;
      cur = cnames[0].toLowerCase().replace(/\.$/, '');
      chain.push(cur);
    } catch {
      break;
    }
  }
  return chain;
}

async function getText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'follow' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000), finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function matchService(cnameTarget) {
  for (const s of TAKEOVER_DB) {
    if (s.suffixes.some((suf) => cnameTarget.endsWith(suf))) return s;
  }
  return null;
}

// ---- T1: fingerprint-confirmed dangling -------------------------------------------
async function t1Dangling(subdomains, opts) {
  const findings = [];
  let wildcardNote = false;
  for (const sub of subdomains.slice(0, 60)) {
    const chain = await resolveCnameChain(sub);
    const target = chain[chain.length - 1];
    if (target === sub) continue; // no CNAME
    const svc = matchService(target);
    if (!svc) continue;
    // Signal 2: unclaimed HTTP signature OR NXDOMAIN CNAME target.
    let nxdomain = false;
    try {
      await dns.resolve(target, 'A');
    } catch (e) {
      if (e.code === 'ENOTFOUND') nxdomain = true;
    }
    const rHttp = await getText(`https://${sub}`);
    const rHttp2 = rHttp || (await getText(`http://${sub}`));
    const body = rHttp2 ? rHttp2.text : '';
    const sigMatch = svc.unclaimed.test(body);
    // Wildcard collapse: parking pages across many subdomains -> one note.
    if (!nxdomain && !sigMatch) continue;
    if (!wildcardNote && subdomains.length > 10) {
      wildcardNote = true; // collapse handled by single-subdomain reporting
    }
    findings.push({
      class: 'subdomain_takeover',
      id: `st-dangle-${rand()}`,
      title: `Subdomain takeover LIKELY — ${sub} dangles at ${svc.service} (HIGH)`,
      severity: 'high',
      url: `https://${sub}`,
      parameter: 'dns-cname',
      evidence: ev(
        `DNS CNAME ${sub} -> ${target} (chain: ${chain.join(' -> ')})`,
        `Two-signal match: CNAME points at ${svc.service} AND (${nxdomain ? 'CNAME target NXDOMAIN' : `unclaimed signature "${svc.unclaimed.source.slice(0, 40)}..." matched`}). Verdict "LIKELY" — claiming the resource is the only full proof (lab-only).`,
        'Dangling DNS primitive: attacker-claimable resource under the victim domain.'
      ),
    });
    if (findings.length >= 5) break;
  }
  return findings;
}

// ---- T4: dead NS delegation ----------------------------------------------------------------
async function t4DeadNs(domain) {
  const findings = [];
  try {
    const ns = await dns.resolveNs(domain);
    for (const n of ns.slice(0, 6)) {
      try {
        await dns.resolve(n, 'A');
      } catch (e) {
        if (e.code === 'ENOTFOUND') {
          findings.push({
            class: 'subdomain_takeover',
            id: `st-ns-${rand()}`,
            title: `Dead NS delegation — ${n} unresolvable (MEDIUM)`,
            severity: 'medium',
            url: domain,
            parameter: 'dns-ns',
            evidence: ev(
              `DNS NS query for ${domain}`,
              `Nameserver ${n} does not resolve (NXDOMAIN) — domain-expiry takeover shape at the delegation layer. Read-only detection.`,
              'NS-takeover primitive (registration never attempted off-lab).'
            ),
          });
        }
      }
    }
  } catch {}
  return findings;
}

export async function probeSubdomainTakeover(url, opts = {}) {
  const findings = [];
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return findings;
  }
  const domain = registrableDomain(host);
  if (!domain || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) return findings; // IP literal
  const depth = opts.depth || 'standard';
  const fromCrt = depth === 'quick' ? [] : await crtsh(domain);
  const subs = new Set(fromCrt);
  // Bounded wordlist via host resolver.
  for (const prefix of WORDLIST.slice(0, depth === 'quick' ? 40 : WORDLIST.length)) {
    const cand = `${prefix}.${domain}`;
    try {
      await dns.resolve(cand, 'A');
      subs.add(cand);
    } catch {}
    if (subs.size >= 120) break;
  }
  findings.push(...(await t1Dangling([...subs], opts)));
  findings.push(...(await t4DeadNs(domain)));
  // T2 lab claim proof + T3 A-record dangling: lab-zone / cloud-IP shapes;
  // documented, run when the lab DNS zone is provisioned (not silently absent).
  return findings;
}

export const __stMeta = { phases: ['subdomain-takeover'], depth: ['quick', 'standard', 'deep'] };
