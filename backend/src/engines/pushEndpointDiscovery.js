/**
 * pushEndpointDiscovery.js — Push-notification endpoint discovery engine.
 *
 * Discovers push-notification infrastructure from service-worker scripts and
 * web app manifests observed on authorized targets: pushManager usage in
 * worker code, VAPID public keys, and gcm_sender_id hints in manifests.
 * Identifying the push provider (Firebase, OneSignal, etc.) is part of the
 * target's supply-chain map. The engine only analyzes observed artifacts.
 */

const PUSH_PROVIDER_PATTERNS = [
  { name: 'firebase-cloud-messaging', patterns: [/firebase-messaging/i, /fcm/i] },
  { name: 'onesignal', patterns: [/onesignal/i] },
  { name: 'pushwoosh', patterns: [/pushwoosh/i] },
  { name: 'pusher-beams', patterns: [/pusher.*beams|beams/i] },
  { name: 'airship', patterns: [/urbanairship|airship/i] },
  {
    name: 'web-push-generic',
    patterns: [/pushManager\s*\.\s*subscribe/i, /applicationServerKey/i],
  },
];

/**
 * Scan service-worker source for push subscription indicators.
 * @param {string} workerSource service-worker JavaScript source
 * @returns {{usesPush: boolean, hasVapidKey: boolean, vapidKey: string|null, providers: string[]}}
 */
export function scanWorkerForPush(workerSource = '') {
  const src = String(workerSource);
  const usesPush =
    /pushManager|['"]push['"]\s*:/i.test(src) && /addEventListener|onpush/i.test(src);
  const vapidMatch =
    /applicationServerKey\s*[:=]\s*['"]([^'"]{20,})['"]/i.exec(src) ||
    /vapid[^'"]*['"]\s*[:=]\s*['"]([^'"]{20,})['"]/i.exec(src);
  const providers = PUSH_PROVIDER_PATTERNS.filter(p => p.patterns.some(re => re.test(src))).map(
    p => p.name
  );
  return {
    usesPush,
    hasVapidKey: Boolean(vapidMatch),
    vapidKey: vapidMatch ? vapidMatch[1].slice(0, 24) + '…' : null, // truncated — never store full keys
    providers: [...new Set(providers)],
  };
}

/**
 * Extract push hints from a web app manifest object.
 * @param {object} manifest parsed manifest (see manifestIconHarvester.parseManifest shape)
 * @returns {{gcmSenderId: string|null, gcmProjectNumber: boolean}}
 */
export function manifestPushHints(manifest = {}) {
  const gcmSenderId = manifest.gcm_sender_id || manifest.gcmSenderId || null;
  return {
    gcmSenderId: typeof gcmSenderId === 'string' ? gcmSenderId : null,
    gcmProjectNumber: typeof gcmSenderId === 'string' && /^\d+$/.test(gcmSenderId),
  };
}

/**
 * Combine worker + manifest signals into a push-infrastructure summary.
 * @param {{workerSource?: string, manifest?: object}} inputs
 * @returns {{pushEnabled: boolean, providers: string[], vapidPresent: boolean, notes: string[]}}
 */
export function discoverPushEndpoints({ workerSource = '', manifest = {} } = {}) {
  const worker = scanWorkerForPush(workerSource);
  const mHints = manifestPushHints(manifest);
  const notes = [];
  if (worker.usesPush) notes.push('service worker handles push events');
  if (worker.hasVapidKey) notes.push('VAPID application server key referenced in worker');
  if (mHints.gcmSenderId) notes.push('gcm_sender_id present in manifest (Firebase push likely)');
  return {
    pushEnabled: worker.usesPush || Boolean(mHints.gcmSenderId),
    providers: worker.providers,
    vapidPresent: worker.hasVapidKey,
    notes,
  };
}

export const PUSH_ENDPOINT_DISCOVERY = {
  scanWorkerForPush,
  manifestPushHints,
  discoverPushEndpoints,
};

export default PUSH_ENDPOINT_DISCOVERY;
