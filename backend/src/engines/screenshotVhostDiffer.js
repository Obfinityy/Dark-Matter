/**
 * screenshotVhostDiffer.js — Screenshot diffing for virtual-host discovery in autonomous bug bounty.
 *
 * Implements idea-bank item 00402: screenshot many hostnames resolving to one
 * IP and cluster the screenshots visually to find distinct applications
 * (virtual hosts) hiding behind the same address.
 *
 * During an authorized engagement the caller screenshots each hostname and
 * reduces every screenshot to a compact feature vector (perceptual hash plus
 * dominant colors). This module computes pairwise visual distances and
 * groups hostnames into clusters; each cluster usually corresponds to one
 * distinct virtual host application, while singletons or outliers flag
 * hostnames worth a closer look.
 *
 * All functions are pure and side-effect free: they operate on feature
 * vectors the caller computed from its own screenshots. No image capture,
 * no image decoding, and no network access is performed here.
 */

import { hashHammingDistance, paletteDistance } from './screenshotServiceClassifier.js';

/**
 * Compute the combined visual distance between two screenshot feature vectors.
 * @param {object} a Feature vector { perceptualHash?, dominantColors? }.
 * @param {object} b Feature vector { perceptualHash?, dominantColors? }.
 * @param {object} opts { hashWeight?: number, paletteWeight?: number }.
 * @returns {number} Distance in [0, 1] (0 = visually identical), or -1 when unusable.
 */
export function visualDistance(a, b, opts = {}) {
  const hashWeight = opts.hashWeight ?? 0.65;
  const paletteWeight = opts.paletteWeight ?? 0.35;
  const fa = a && typeof a === 'object' ? a : {};
  const fb = b && typeof b === 'object' ? b : {};
  const parts = [];
  const weights = [];
  if (fa.perceptualHash && fb.perceptualHash) {
    const bits = Math.max(fa.perceptualHash.length, fb.perceptualHash.length) * 4;
    const d = hashHammingDistance(fa.perceptualHash, fb.perceptualHash);
    if (d >= 0 && bits > 0) {
      parts.push(Math.min(1, d / bits));
      weights.push(hashWeight);
    }
  }
  if (fa.dominantColors && fb.dominantColors) {
    const d = paletteDistance(fa.dominantColors, fb.dominantColors);
    if (d >= 0) {
      parts.push(Math.min(1, d / 441.67));
      weights.push(paletteWeight);
    }
  }
  if (parts.length === 0) return -1;
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < parts.length; i++) {
    sum += parts[i] * weights[i];
    wsum += weights[i];
  }
  return wsum > 0 ? sum / wsum : -1;
}

/**
 * Compute pairwise visual distances for a list of captures.
 * @param {Array<{hostname:string, features:object}>} captures Screenshots keyed by hostname.
 * @param {object} opts Passed through to visualDistance.
 * @returns {{matrix: number[][], hostnames: string[]}} Symmetric distance matrix aligned with hostnames.
 */
export function pairwiseDistances(captures, opts = {}) {
  const list = Array.isArray(captures) ? captures : [];
  const hostnames = list.map(c => (c && typeof c.hostname === 'string' ? c.hostname : 'unknown'));
  const matrix = list.map(() => list.map(() => 0));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const d = visualDistance(list[i] && list[i].features, list[j] && list[j].features, opts);
      const v = d >= 0 ? d : 1;
      matrix[i][j] = v;
      matrix[j][i] = v;
    }
  }
  return { matrix, hostnames };
}

/**
 * Cluster hostnames by visual similarity using greedy single-linkage
 * agglomeration: a capture joins the cluster containing its nearest
 * neighbor when that distance is under the threshold.
 * @param {Array<{hostname:string, features:object}>} captures Screenshots keyed by hostname.
 * @param {object} opts { threshold?: number (0-1, default 0.25), visual?: object passed to visualDistance }.
 * @returns {Array<{id:number, hostnames:string[], size:number, cohesion:number}>} Clusters sorted by size descending; cohesion is the mean intra-cluster distance.
 */
export function clusterVhosts(captures, opts = {}) {
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.25;
  const list = Array.isArray(captures) ? captures : [];
  const clusters = [];
  for (const capture of list) {
    if (!capture || typeof capture.hostname !== 'string') continue;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (const member of clusters[i].members) {
        const d = visualDistance(member.features, capture.features, opts.visual || {});
        if (d >= 0 && d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    if (best >= 0 && bestDist <= threshold) {
      clusters[best].members.push(capture);
      clusters[best].distances.push(bestDist);
    } else {
      clusters.push({ members: [capture], distances: [] });
    }
  }
  return clusters
    .map((c, i) => ({
      id: i + 1,
      hostnames: c.members.map(m => m.hostname),
      size: c.members.length,
      cohesion:
        c.distances.length > 0
          ? Math.round((c.distances.reduce((s, d) => s + d, 0) / c.distances.length) * 1000) / 1000
          : 0,
    }))
    .sort((x, y) => y.size - x.size || x.id - y.id);
}

/**
 * Flag clusters that likely represent distinct applications worth manual review:
 * singleton clusters (unique pages) and the largest cluster baseline.
 * @param {Array<{id:number, hostnames:string[], size:number, cohesion:number}>} clusters Output of clusterVhosts.
 * @returns {{distinctApplications:number, singletons:Array<string>, review:Array<{clusterId:number, reason:string, hostnames:string[]}>}}
 */
export function distinctApplications(clusters) {
  const list = Array.isArray(clusters) ? clusters : [];
  const singletons = list.filter(c => c.size === 1).flatMap(c => c.hostnames);
  const review = [];
  for (const c of list) {
    if (c.size === 1) {
      review.push({
        clusterId: c.id,
        reason: 'unique page — possible distinct virtual host',
        hostnames: c.hostnames,
      });
    } else if (c.cohesion > 0.2) {
      review.push({
        clusterId: c.id,
        reason: 'loose cluster — mixed content may hide another vhost',
        hostnames: c.hostnames,
      });
    }
  }
  return { distinctApplications: list.length, singletons, review };
}

/**
 * Render a human-readable summary of the clustering outcome.
 * @param {Array<{id:number, hostnames:string[], size:number}>} clusters Output of clusterVhosts.
 * @returns {string}
 */
export function clusteringSummary(clusters) {
  const list = Array.isArray(clusters) ? clusters : [];
  if (list.length === 0) return 'No screenshots were available to cluster.';
  const total = list.reduce((s, c) => s + c.size, 0);
  return (
    `${total} hostname(s) grouped into ${list.length} visual cluster(s): ` +
    list
      .map(
        c =>
          `#${c.id} (${c.size}: ${c.hostnames.slice(0, 3).join(', ')}${c.hostnames.length > 3 ? ', …' : ''})`
      )
      .join('; ') +
    '.'
  );
}
