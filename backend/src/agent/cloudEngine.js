/**
 * Cloud Security Testing — S3, Azure, GCP, Firebase misconfigurations.
 *
 * Elite hunters check cloud storage because it's OFTEN misconfigured:
 *   - Public S3 buckets with sensitive data
 *   - Writable buckets (upload malicious files)
 *   - Firebase databases open to the world
 *   - Azure blobs publicly listable
 *
 * All checks are READ-ONLY and non-destructive. We never upload, never
 * delete, never access data beyond confirming exposure level.
 */

export const CLOUD_TESTS = Object.freeze([
  {
    id: 's3_list',
    name: 'S3 bucket listing',
    severity: 'medium',
    description: 'Check if S3 bucket allows public listing',
    urls: bucket => [
      `https://${bucket}.s3.amazonaws.com/`,
      `https://${bucket}.s3-website-us-east-1.amazonaws.com/`,
    ],
    detect: (status, body) => {
      if (status === 200 && body.includes('<ListBucketResult')) {
        return { vulnerable: true, evidence: 'S3 bucket publicly listable' };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 's3_read',
    name: 'S3 public read',
    severity: 'high',
    description: 'Check common sensitive files in public S3 bucket',
    urls: bucket => [
      `https://${bucket}.s3.amazonaws.com/.env`,
      `https://${bucket}.s3.amazonaws.com/config.json`,
      `https://${bucket}.s3.amazonaws.com/backup.zip`,
    ],
    detect: (status, body) => {
      if (status === 200 && body.length > 0) {
        return { vulnerable: true, evidence: `Sensitive file publicly readable` };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'firebase_open',
    name: 'Firebase open database',
    severity: 'critical',
    description: 'Check if Firebase Realtime Database is world-readable',
    urls: domain => [`https://${domain}.firebaseio.com/.json`],
    detect: (status, body) => {
      if (status === 200) {
        try {
          const data = JSON.parse(body);
          if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            return { vulnerable: true, evidence: 'Firebase database world-readable' };
          }
        } catch {
          /* not JSON */
        }
      }
      // 401/permission denied = secure
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'azure_blob_list',
    name: 'Azure blob listing',
    severity: 'medium',
    description: 'Check if Azure storage container is publicly listable',
    urls: account => [`https://${account}.blob.core.windows.net/?restype=container&comp=list`],
    detect: (status, body) => {
      if (status === 200 && body.includes('<EnumerationResults')) {
        return { vulnerable: true, evidence: 'Azure container publicly listable' };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'gcp_bucket',
    name: 'GCP bucket open',
    severity: 'high',
    description: 'Check if Google Cloud Storage bucket is public',
    urls: bucket => [`https://storage.googleapis.com/${bucket}/`],
    detect: (status, body) => {
      if (status === 200 && body.includes('<ListBucketResult')) {
        return { vulnerable: true, evidence: 'GCP bucket publicly listable' };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
]);

/**
 * Extract potential bucket/storage names from a domain.
 * e.g. assets.example.com → ["assets", "assets-example", "example-assets"]
 */
export function guessBucketNames(domain) {
  const base = domain.split('.')[0];
  const org = domain.split('.').slice(-2, -1)[0] || base;
  const names = new Set([
    base,
    `${base}-prod`,
    `${base}-dev`,
    `${base}-backup`,
    `${base}-assets`,
    `${base}-static`,
    org,
    `${org}-assets`,
    domain.replace(/\./g, '-'),
  ]);
  return [...names];
}

/**
 * Extract Firebase project from JS/HTML.
 */
export function findFirebaseProjects(text) {
  const matches = text.matchAll(/([a-z0-9\-]+)\.firebaseio\.com/g);
  return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Extract S3 buckets from text.
 */
export function findS3Buckets(text) {
  const patterns = [
    /([a-z0-9.\-]+\.s3\.amazonaws\.com)/g,
    /s3\.amazonaws\.com\/([a-z0-9.\-]+)/g,
    /([a-z0-9.\-]+\.s3-website[.\-a-z0-9]+\.amazonaws\.com)/g,
  ];
  const buckets = new Set();
  for (const p of patterns) {
    for (const m of text.matchAll(p)) {
      buckets.add(m[1].split('.')[0]);
    }
  }
  return [...buckets];
}
