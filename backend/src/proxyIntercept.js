// Dark Matter — Proxy Intercept via mitmproxy.
// Gives the hunt agent Burp Suite-like request interception capabilities.
//
// The agent can:
//   - Start a mitmproxy instance for a hunt
//   - Capture all HTTP traffic to the target
//   - Analyze requests/responses for vulnerabilities
//   - Replay modified requests

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Active proxy instances by huntId
const proxies = new Map();

/**
 * Start mitmproxy for a hunt. Returns the proxy port.
 */
export async function startProxy(huntId, targetPort = 8080) {
  if (proxies.has(huntId)) {
    return proxies.get(huntId).port;
  }

  const port = targetPort + Math.floor(Math.random() * 1000);
  const proc = spawn('mitmdump', [
    '-p', String(port),
    '--set', 'confdir=/tmp/mitmproxy-' + huntId,
    '-w', `/tmp/mitmproxy-${huntId}/traffic.log`,
    '--quiet',
  ], {
    detached: true,
    stdio: 'ignore',
  });

  proc.unref();

  proxies.set(huntId, { proc, port, huntId });

  // Wait for proxy to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return port;
}

/**
 * Stop the proxy for a hunt.
 */
export async function stopProxy(huntId) {
  const proxy = proxies.get(huntId);
  if (!proxy) return;

  try {
    proxy.proc.kill();
  } catch { /* already dead */ }

  proxies.delete(huntId);
}

/**
 * Get captured traffic for analysis.
 */
export async function getTraffic(huntId, limit = 50) {
  try {
    const { stdout } = await execAsync(
      `mitmdump -r /tmp/mitmproxy-${huntId}/traffic.log --quiet 2>/dev/null | head -${limit}`
    );
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Analyze traffic for interesting patterns (params, auth, errors).
 */
export function analyzeTrafficForCuriosity(traffic) {
  const observations = [];
  const lines = traffic.split('\n');

  for (const line of lines) {
    // Look for requests with parameters
    if (line.includes('?') && line.includes('=')) {
      observations.push({
        type: 'request_with_params',
        output: line.slice(0, 200),
      });
    }
    // Look for auth headers
    if (line.toLowerCase().includes('authorization') || line.toLowerCase().includes('cookie')) {
      observations.push({
        type: 'auth_observed',
        output: line.slice(0, 200),
      });
    }
  }

  return observations;
}
