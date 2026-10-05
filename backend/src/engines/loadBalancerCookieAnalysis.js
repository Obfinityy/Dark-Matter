/**
 * loadBalancerCookieAnalysis.js — load-balancer identification from persistence cookies.
 *
 * Implements idea-bank item 00440: identify the load balancer or ADC in
 * front of a target from the names and value formats of its persistence
 * (stickiness) cookies observed in Set-Cookie headers.
 *
 * All functions are pure and side-effect free: they operate on Set-Cookie
 * values supplied by the caller (gathered during an authorized engagement).
 * No network requests are performed here.
 */

/**
 * Known load-balancer persistence-cookie signatures.
 */
export const LB_COOKIE_SIGNATURES = [
  {
    product: 'AWS Elastic Load Balancing (ALB)',
    confidence: 'high',
    test: (name) => /^AWSALB[A-Za-z0-9]*$/.test(name),
    note: 'AWSALB / AWSALBCORS cookies are minted by Application Load Balancers for stickiness.',
  },
  {
    product: 'AWS Elastic Load Balancing (Classic ELB)',
    confidence: 'high',
    test: (name) => /^AWSELB[A-Za-z0-9]*$/.test(name),
    note: 'AWSELB cookies are minted by Classic Elastic Load Balancers.',
  },
  {
    product: 'F5 BIG-IP',
    confidence: 'high',
    test: (name) => /^BIGipServer/i.test(name),
    note: 'BIGipServer<pool> cookies carry the (often encoded) pool member IP and port.',
  },
  {
    product: 'F5 BIG-IP ASM',
    confidence: 'medium',
    test: (name) => /^TS[0-9a-f]{6,}$/i.test(name),
    note: 'TS<hex> cookies are set by F5 ASM (Application Security Manager).',
  },
  {
    product: 'Azure App Service / Front Door',
    confidence: 'high',
    test: (name) => /^ARRAffinity/i.test(name),
    note: 'ARRAffinity / ARRAffinitySameSite cookies pin clients to an Azure App Service instance.',
  },
  {
    product: 'Citrix ADC (NetScaler)',
    confidence: 'medium',
    test: (name) => /^NSC_/i.test(name),
    note: 'NSC_* cookies are minted by Citrix ADC persistence.',
  },
  {
    product: 'Nginx (sticky module)',
    confidence: 'low',
    test: (name) => /^(srv|route|serverid|backend)/i.test(name),
    note: 'Generic sticky names used by nginx sticky/upstream modules — low specificity.',
  },
  {
    product: 'HAProxy (server cookies)',
    confidence: 'low',
    test: (name, value) => /^[A-Za-z0-9_.-]{1,32}$/.test(name) && /^[A-Za-z0-9_.-]{1,64}$/.test(value || '') && /haproxy|srv/i.test(name + (value || '')),
    note: 'HAProxy inserts server-named cookies; names are operator-chosen so this is a weak signal.',
  },
];

/**
 * Parse Set-Cookie header value(s) into name/value pairs.
 * @param {string|string[]} setCookie One Set-Cookie value or an array of them.
 * @returns {Array<{name:string, value:string, attributes:string}>}
 */
export function parseSetCookies(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : (setCookie != null ? [setCookie] : []);
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'string') continue;
    const firstSemi = raw.indexOf(';');
    const pair = firstSemi === -1 ? raw : raw.slice(0, firstSemi);
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    out.push({
      name: pair.slice(0, eq).trim(),
      value: pair.slice(eq + 1).trim(),
      attributes: firstSemi === -1 ? '' : raw.slice(firstSemi + 1).trim(),
    });
  }
  return out;
}

/**
 * Identify the load balancer behind one cookie.
 * @param {string} name Cookie name.
 * @param {string} [value] Cookie value.
 * @returns {{product:string|null, confidence:string, note:string|null}}
 */
export function identifyLoadBalancerCookie(name, value = '') {
  if (!name || typeof name !== 'string') return { product: null, confidence: 'none', note: null };
  for (const sig of LB_COOKIE_SIGNATURES) {
    let matched = false;
    try {
      matched = sig.test(name, value) === true;
    } catch {
      matched = false;
    }
    if (matched) return { product: sig.product, confidence: sig.confidence, note: sig.note };
  }
  return { product: null, confidence: 'none', note: 'Cookie name does not match any known load-balancer persistence signature.' };
}

/**
 * Decode an F5 BIG-IP persistence cookie value to the pool-member IP and port.
 * The value format is "<encoded-ip>.<encoded-port>" where each is a
 * byte-reversed decimal of the hex representation. Returns null for
 * non-BIG-IP cookies or unparseable values.
 * @param {string} name Cookie name.
 * @param {string} value Cookie value.
 * @returns {{ip:string, port:number}|null}
 */
export function decodeBigIpCookie(name, value) {
  if (!/^BIGipServer/i.test(name || '')) return null;
  const m = /^(\d+)\.(\d+)\.0000$/.exec((value || '').trim());
  if (!m) return null;
  const decode = (num) => {
    const hex = parseInt(num, 10).toString(16).padStart(8, '0');
    return [6, 4, 2, 0].map((i) => parseInt(hex.slice(i, i + 2), 16)).join('.');
  };
  const ip = decode(m[1]);
  const portHex = parseInt(m[2], 10).toString(16).padStart(4, '0');
  const port = parseInt(portHex.slice(2, 4) + portHex.slice(0, 2), 16);
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return null;
  return { ip, port };
}

/**
 * Analyze all Set-Cookie values from an observed response.
 * @param {string|string[]} setCookie One Set-Cookie value or an array.
 * @returns {{cookies:Array<{name:string, value:string, product:string|null, confidence:string, decoded:object|null}>, products:Array<{product:string, confidence:string, cookies:string[]}>}}
 */
export function analyzeLoadBalancerCookies(setCookie) {
  const parsed = parseSetCookies(setCookie);
  const cookies = parsed.map(({ name, value }) => {
    const id = identifyLoadBalancerCookie(name, value);
    const decoded = id.product && id.product.startsWith('F5 BIG-IP') ? decodeBigIpCookie(name, value) : null;
    return { name, value, product: id.product, confidence: id.confidence, decoded };
  });
  const byProduct = new Map();
  for (const c of cookies) {
    if (!c.product) continue;
    if (!byProduct.has(c.product)) byProduct.set(c.product, { product: c.product, confidence: c.confidence, cookies: [] });
    byProduct.get(c.product).cookies.push(c.name);
  }
  const rank = { high: 3, medium: 2, low: 1, none: 0 };
  const products = [...byProduct.values()].sort((a, b) => rank[b.confidence] - rank[a.confidence]);
  return { cookies, products };
}
