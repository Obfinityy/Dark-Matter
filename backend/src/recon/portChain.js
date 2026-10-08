/**
 * naabu → nmap chaining: a fast naabu port sweep produces the open-port list,
 * and the portChain builds a TARGETED nmap service/version scan over exactly
 * those ports — never a full-range scan. Full-range nmap is slow, loud, and
 * pointless after naabu already mapped the surface.
 *
 * Pure functions so the chaining logic is unit-testable on canned outputs;
 * the executor only ever runs nmap with the argument list this module built.
 */

/** Parse naabu JSONL ({host, port, ip}) into [{host, port}]. */
export function parseNaabuJsonLines(raw) {
  if (!raw) return { ports: [], hosts: [] };
  const ports = [];
  const hostSet = new Set();
  for (const line of String(raw).split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      const port = Number(obj.port);
      const host = String(obj.host || obj.ip || '').trim();
      if (!Number.isInteger(port) || port < 1 || port > 65535 || !host) continue;
      ports.push({ host, port, ip: obj.ip || null });
      hostSet.add(host);
    } catch {
      /* skip malformed lines */
    }
  }
  return { ports, hosts: [...hostSet] };
}

/** Parse nmap XML (-oX) into [{host, port, protocol, state, service, product, version}].
 * Hand-rolled against the nmap -oX schema (no XML dependency in this backend). */
export function parseNmapXml(raw) {
  const text = String(raw || '');
  if (!text.trim()) return { services: [], hosts: [] };
  const services = [];
  const seenHosts = new Set();
  try {
    const hostBlocks = text.match(/<host[\s>][\s\S]*?<\/host>/g) || [];
    for (const block of hostBlocks) {
      const addrMatch =
        block.match(/<address\s+addr="([^"]+)"\s+addrtype="ipv4"/) ||
        block.match(/<address\s+addr="([^"]+)"/);
      const host = addrMatch?.[1];
      if (!host) continue;
      seenHosts.add(host);
      const portBlocks = block.match(/<port\s+[^>]*>[\s\S]*?<\/port>/g) || [];
      for (const pb of portBlocks) {
        const header =
          pb.match(/<port\s+protocol="([^"]+)"\s+portid="(\d+)"/) ||
          pb.match(/<port\s+portid="(\d+)"\s+protocol="([^"]+)"/);
        if (!header) continue;
        const protocol =
          header[1].startsWith('tcp') || header[1].startsWith('udp') ? header[1] : header[2];
        const portid =
          header[1].startsWith('tcp') || header[1].startsWith('udp') ? header[2] : header[1];
        const state = pb.match(/<state\s+state="([^"]+)"/)?.[1];
        if (state !== 'open') continue;
        const svcTag = pb.match(/<service\s+([^>]*?)\/?>/);
        const attrs = svcTag?.[1] || '';
        const attr = name => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] || null;
        services.push({
          host,
          port: Number(portid),
          protocol,
          state,
          service: attr('name') || 'unknown',
          product: attr('product'),
          version: attr('version'),
          extrainfo: attr('extrainfo'),
        });
      }
    }
    return { services, hosts: [...seenHosts] };
  } catch (error) {
    return { services: [], hosts: [], error: error.message };
  }
}

/**
 * Build a targeted nmap argument list from naabu's open ports.
 * Safety rails:
 *   - ports are enumerated explicitly (-p 22,80,443) — no ranges, no -p-
 *   - service/version detection only (-sV -sC); no OS detection, no vuln scripts
 *   - timing is capped at T3 unless the caller explicitly passes T4 with
 *     stealth approval (policyValidator blocks T5)
 *   - maxPorts caps how many ports go into one nmap run (default 100)
 */
export function buildTargetedNmapArgs(
  ports,
  { timing = 'T3', maxPorts = 100, includeDefaultScripts = true, extraArgs = [] } = {}
) {
  const unique = [
    ...new Set(ports.map(Number).filter(p => Number.isInteger(p) && p >= 1 && p <= 65535)),
  ];
  if (!unique.length) {
    return { args: null, reason: 'no open ports from naabu — nothing to chain' };
  }
  const selected = unique.slice(0, maxPorts);
  const args = ['-sV'];
  if (includeDefaultScripts) args.push('-sC');
  args.push('-p', selected.join(','));
  const safeTiming = ['T0', 'T1', 'T2', 'T3'].includes(timing) ? timing : 'T3';
  args.push(`-${safeTiming}`);
  args.push('-oX', '-');
  args.push('--open');
  if (Array.isArray(extraArgs)) args.push(...extraArgs);
  return {
    args,
    ports: selected,
    truncated: unique.length > maxPorts,
    reason: `targeted nmap service scan over ${selected.length} naabu-confirmed open port(s)`,
  };
}

/**
 * Full chaining step: naabu raw output → nmap tool request.
 * Returns null when there is nothing to chain (hunt continues elsewhere).
 */
export function chainNaabuToNmap(naabuRaw, { target, timing = 'T3', maxPorts = 100 } = {}) {
  const { ports, hosts } = parseNaabuJsonLines(naabuRaw);
  const built = buildTargetedNmapArgs(
    ports.map(p => p.port),
    { timing, maxPorts }
  );
  if (!built.args) return { chained: false, reason: built.reason, ports: [], hosts };
  return {
    chained: true,
    reason: built.reason,
    ports: built.ports,
    hosts,
    truncated: built.truncated,
    request: {
      tool: 'nmap',
      target,
      arguments: { args: built.args },
      description: `Targeted nmap service scan chained from naabu (${built.ports.length} open ports, no full-range scan)`,
    },
  };
}
