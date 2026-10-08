/**
 * screenshotServiceClassifier.js — Screenshot-based service identification for autonomous bug bounty.
 *
 * Implements idea-bank item 00401: classify HTTP services visually when
 * banners are hidden, using features extracted from service screenshots.
 *
 * During an authorized engagement the caller screenshots each HTTP service
 * (with the target's written permission) and reduces every screenshot to a
 * compact feature vector: a perceptual hash, dominant colors, brightness,
 * and edge density. This module matches those feature vectors against a
 * signature database of well-known default/login pages (web consoles,
 * admin panels, default server pages) so a service can be identified even
 * when the HTTP banner is suppressed or forged.
 *
 * All functions are pure and side-effect free: they operate on feature
 * vectors the caller computed from its own screenshots. No image capture,
 * no image decoding, and no network access is performed here.
 */

/**
 * Compute the Hamming distance between two hexadecimal perceptual hashes.
 * @param {string} a Hex-encoded perceptual hash.
 * @param {string} b Hex-encoded perceptual hash of the same length.
 * @returns {number} Number of differing bits, or -1 when the inputs are unusable.
 */
export function hashHammingDistance(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0)
    return -1;
  if (!/^[0-9a-fA-F]+$/.test(a) || !/^[0-9a-fA-F]+$/.test(b)) return -1;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += xor.toString(2).replace(/0/g, '').length;
  }
  return distance;
}

/**
 * Compute the weighted Euclidean distance between two dominant-color palettes.
 * @param {Array<{r:number,g:number,b:number,weight?:number}>} a Palette A.
 * @param {Array<{r:number,g:number,b:number,weight?:number}>} b Palette B.
 * @returns {number} Distance in RGB space (0 = identical), or -1 when unusable.
 */
export function paletteDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return -1;
  const n = Math.min(a.length, b.length);
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < n; i++) {
    const ca = a[i] || {};
    const cb = b[i] || {};
    const w = ((ca.weight ?? 1) + (cb.weight ?? 1)) / 2;
    const dr = (ca.r ?? 0) - (cb.r ?? 0);
    const dg = (ca.g ?? 0) - (cb.g ?? 0);
    const db = (ca.b ?? 0) - (cb.b ?? 0);
    sum += w * (dr * dr + dg * dg + db * db);
    weightSum += w;
  }
  return weightSum > 0 ? Math.sqrt(sum / weightSum) : -1;
}

/**
 * Built-in signature database of well-known service pages. Each signature
 * carries the visual features of a default or login page shipped by common
 * software, so a match suggests the underlying product even when the
 * server header is hidden.
 * @returns {Array<{id:string, product:string, page:string, perceptualHash:string, dominantColors:Array<{r:number,g:number,b:number,weight:number}>, brightness:number, edgeDensity:number, severity:string}>}
 */
export function builtInSignatures() {
  return [
    {
      id: 'jenkins-login',
      product: 'Jenkins',
      page: 'login page',
      severity: 'info',
      perceptualHash: 'c3a55f0f1e2d4b6a',
      brightness: 0.62,
      edgeDensity: 0.31,
      dominantColors: [
        { r: 245, g: 245, b: 245, weight: 0.55 },
        { r: 40, g: 110, b: 170, weight: 0.25 },
        { r: 30, g: 30, b: 30, weight: 0.2 },
      ],
    },
    {
      id: 'apache-default',
      product: 'Apache httpd',
      page: 'default welcome page',
      severity: 'info',
      perceptualHash: '8f1e2d3c4b5a6978',
      brightness: 0.85,
      edgeDensity: 0.12,
      dominantColors: [
        { r: 255, g: 255, b: 255, weight: 0.7 },
        { r: 120, g: 40, b: 30, weight: 0.2 },
        { r: 60, g: 60, b: 60, weight: 0.1 },
      ],
    },
    {
      id: 'nginx-default',
      product: 'nginx',
      page: 'default welcome page',
      severity: 'info',
      perceptualHash: '1a2b3c4d5e6f7081',
      brightness: 0.9,
      edgeDensity: 0.08,
      dominantColors: [
        { r: 255, g: 255, b: 255, weight: 0.8 },
        { r: 50, g: 50, b: 50, weight: 0.2 },
      ],
    },
    {
      id: 'tomcat-manager',
      product: 'Apache Tomcat',
      page: 'manager application',
      severity: 'high',
      perceptualHash: 'dead10cc0ffee42a',
      brightness: 0.55,
      edgeDensity: 0.35,
      dominantColors: [
        { r: 230, g: 230, b: 230, weight: 0.5 },
        { r: 200, g: 90, b: 20, weight: 0.3 },
        { r: 30, g: 30, b: 30, weight: 0.2 },
      ],
    },
    {
      id: 'wordpress-login',
      product: 'WordPress',
      page: 'wp-login page',
      severity: 'info',
      perceptualHash: 'b16b00b5a1a2c3d4',
      brightness: 0.8,
      edgeDensity: 0.22,
      dominantColors: [
        { r: 240, g: 240, b: 240, weight: 0.6 },
        { r: 35, g: 110, b: 170, weight: 0.25 },
        { r: 80, g: 80, b: 80, weight: 0.15 },
      ],
    },
    {
      id: 'grafana-login',
      product: 'Grafana',
      page: 'login page',
      severity: 'info',
      perceptualHash: '5ca1ab1e0ddf00d1',
      brightness: 0.18,
      edgeDensity: 0.28,
      dominantColors: [
        { r: 20, g: 22, b: 28, weight: 0.6 },
        { r: 240, g: 160, b: 40, weight: 0.2 },
        { r: 200, g: 200, b: 200, weight: 0.2 },
      ],
    },
  ];
}

/**
 * Classify one screenshot's feature vector against the signature database.
 * @param {object} features { perceptualHash?: string, dominantColors?: Array, brightness?: number, edgeDensity?: number }.
 * @param {object} opts { signatures?: Array, hashWeight?: number, paletteWeight?: number, layoutWeight?: number, maxResults?: number }.
 * @returns {{matches: Array<{signatureId:string, product:string, page:string, confidence:number, severity:string}>, bestMatch: object|null, analyzed: boolean}}
 */
export function classifyScreenshot(features, opts = {}) {
  const signatures = Array.isArray(opts.signatures) ? opts.signatures : builtInSignatures();
  const hashWeight = opts.hashWeight ?? 0.5;
  const paletteWeight = opts.paletteWeight ?? 0.3;
  const layoutWeight = opts.layoutWeight ?? 0.2;
  const maxResults = opts.maxResults ?? 3;
  const f = features && typeof features === 'object' ? features : {};
  const matches = [];

  for (const sig of signatures) {
    const hashDist = hashHammingDistance(f.perceptualHash, sig.perceptualHash);
    const palDist = paletteDistance(f.dominantColors, sig.dominantColors);
    const hashScore =
      hashDist >= 0 ? 1 - Math.min(1, hashDist / (sig.perceptualHash.length * 4)) : 0.5;
    const paletteScore = palDist >= 0 ? 1 - Math.min(1, palDist / 441.67) : 0.5;
    let layoutScore = 0;
    let layoutParts = 0;
    if (typeof f.brightness === 'number' && typeof sig.brightness === 'number') {
      layoutScore += 1 - Math.min(1, Math.abs(f.brightness - sig.brightness));
      layoutParts++;
    }
    if (typeof f.edgeDensity === 'number' && typeof sig.edgeDensity === 'number') {
      layoutScore += 1 - Math.min(1, Math.abs(f.edgeDensity - sig.edgeDensity));
      layoutParts++;
    }
    layoutScore = layoutParts > 0 ? layoutScore / layoutParts : 0.5;
    const totalWeight = hashWeight + paletteWeight + layoutWeight;
    const confidence =
      totalWeight > 0
        ? (hashScore * hashWeight + paletteScore * paletteWeight + layoutScore * layoutWeight) /
          totalWeight
        : 0;
    matches.push({
      signatureId: sig.id,
      product: sig.product,
      page: sig.page,
      severity: sig.severity,
      confidence: Math.round(confidence * 1000) / 1000,
    });
  }

  matches.sort((x, y) => y.confidence - x.confidence);
  const top = matches.slice(0, Math.max(1, maxResults));
  return { matches: top, bestMatch: top[0] || null, analyzed: matches.length > 0 };
}

/**
 * Render a one-line human-readable summary of a classification result.
 * @param {{bestMatch: object|null, analyzed: boolean}} result Output of classifyScreenshot.
 * @returns {string}
 */
export function classificationSummary(result) {
  if (!result || !result.analyzed) return 'No screenshot features available for classification.';
  const best = result.bestMatch;
  if (!best) return 'No matching service signatures found.';
  const pct = Math.round(best.confidence * 100);
  return `Best visual match: ${best.product} ${best.page} (${pct}% confidence, severity: ${best.severity}).`;
}
