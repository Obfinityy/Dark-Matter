/**
 * mdnsLocalIntel.js — mDNS .local name harvesting (idea 00126).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Multicast
 * DNS (mDNS/Bonjour/Avahi) has every device on the adjacent network
 * announce its `.local` hostname and advertised services — printers,
 * workstations, IoT, build servers. Where the agent can legitimately
 * observe mDNS traffic (same-segment assessments, avahi-browse output,
 * captured announcement logs), parsing it enumerates `.local` hostnames
 * and the services each host exposes.
 *
 * All functions are pure: they analyze announcement/log text supplied by
 * the caller and never capture packets themselves.
 */

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;
const IPV6_RE = /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g;

/**
 * Parse `avahi-browse -a -t` style output:
 *   = eth0 IPv4 MyPrinter  _ipp._tcp  local
 *   + eth0 IPv4 MyPrinter  _ipp._tcp  local
 *
 * @param {string} text
 * @returns {Array<{ instance: string, serviceType: string, domain: string, state: string }>}
 */
export function parseAvahiBrowse(text) {
  const out = [];
  const seen = new Set();
  const re = /^[=+#-]\s+\S+\s+\S+\s+(.+?)\s+(_[a-z0-9-]+\._(?:tcp|udp))\s+(\S+)\s*$/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}|${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      instance: m[1].trim().replace(/\\\d{3}/g, ''),
      serviceType: m[2].trim(),
      domain: m[3].trim(),
      state: text[m.index] === '+' ? 'new' : text[m.index] === '-' ? 'removed' : 'resolved',
    });
  }
  return out;
}

/**
 * Parse captured DNS-style records mentioning .local names:
 *   printer.local. 120 IN A 192.168.1.50
 *   _ipp._tcp.local. 120 IN PTR MyPrinter._ipp._tcp.local.
 *   MyPrinter._ipp._tcp.local. 120 IN SRV 0 0 631 printer.local.
 *   MyPrinter._ipp._tcp.local. 120 IN TXT "ty=LaserJet" "adminurl=..."
 *
 * @param {string} text
 * @returns {{ hosts: Map<string, { addresses: string[], services: string[] }>, services: Array<{ instance: string, serviceType: string, host: string | null, port: number | null, txt: Record<string, string> }> }}
 */
export function parseMdnsRecords(text) {
  const hosts = new Map(); // name -> { addresses: Set, services: Set }
  const services = [];
  const ensure = name => {
    const n = name.replace(/\.$/, '').toLowerCase();
    if (!hosts.has(n)) hosts.set(n, { addresses: new Set(), services: new Set() });
    return hosts.get(n);
  };

  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    // A / AAAA records
    let m = line.match(/^([A-Za-z0-9_.-]+\.local\.?)\s+\d*\s*IN\s+(A|AAAA)\s+(\S+)/i);
    if (m) {
      const h = ensure(m[1]);
      h.addresses.add(m[3]);
      continue;
    }
    // PTR: service type -> instance
    m = line.match(/^(_[a-z0-9-]+\._(?:tcp|udp)(?:\.local)?\.?)\s+\d*\s*IN\s+PTR\s+(\S+)/i);
    if (m) {
      const inst = m[2].replace(/\.$/, '');
      const tm = inst.match(/\.(_[a-z0-9-]+\._(?:tcp|udp))(?:\.|$)/i);
      const st = tm
        ? tm[1].toLowerCase()
        : m[1]
            .replace(/\.local\.?$/i, '')
            .replace(/\.$/, '')
            .toLowerCase();
      services.push({ instance: inst, serviceType: st, host: null, port: null, txt: {} });
      continue;
    }
    // SRV: instance -> host:port
    m = line.match(/^(\S+)\s+\d*\s*IN\s+SRV\s+\d+\s+\d+\s+(\d+)\s+(\S+)/i);
    if (m) {
      const inst = m[1].replace(/\.$/, '');
      const host = m[3].replace(/\.$/, '');
      const port = Number(m[2]);
      let svc = services.find(s => s.instance.toLowerCase() === inst.toLowerCase());
      if (!svc) {
        svc = { instance: inst, serviceType: null, host: null, port: null, txt: {} };
        services.push(svc);
      }
      svc.host = host;
      svc.port = port;
      if (!svc.serviceType) {
        const tm = inst.match(/\.(_[a-z0-9-]+\._(?:tcp|udp))(?:\.|$)/i);
        if (tm) svc.serviceType = tm[1].toLowerCase();
      }
      if (/\.local$/i.test(host)) {
        const h = ensure(host);
        const st = svc.serviceType || inst.split('.').slice(1, 3).join('.');
        if (st) h.services.add(st);
      }
      continue;
    }
    // TXT: instance -> key=value pairs
    m = line.match(/^(\S+)\s+\d*\s*IN\s+TXT\s+(.+)$/i);
    if (m) {
      const inst = m[1].replace(/\.$/, '');
      const txt = {};
      for (const qm of m[2].matchAll(/"([^"]*)"/g)) {
        const kv = qm[1];
        const eq = kv.indexOf('=');
        if (eq > 0) txt[kv.slice(0, eq).toLowerCase()] = kv.slice(eq + 1);
      }
      let svc = services.find(s => s.instance.toLowerCase() === inst.toLowerCase());
      if (!svc) {
        svc = { instance: inst, serviceType: null, host: null, port: null, txt: {} };
        services.push(svc);
      }
      Object.assign(svc.txt, txt);
    }
  }

  // Fold avahi-style lines into the same model
  for (const a of parseAvahiBrowse(text)) {
    const h = ensure(
      a.instance.toLowerCase().endsWith('.local') ? a.instance : `${a.instance}.local`
    );
    h.services.add(a.serviceType);
  }

  return { hosts, services };
}

/**
 * Idea 00126 — mDNS .local name harvesting.
 *
 * Enumerates `.local` hostnames, their addresses, and advertised services
 * from supplied mDNS announcement/log text (avahi-browse output, captured
 * DNS records, dns-sd output).
 *
 * @param {string} text Raw mDNS log / browse output.
 * @returns {{
 *   hosts: Array<{ name: string, addresses: string[], services: string[], detail: string }>,
 *   services: Array<{ instance: string, serviceType: string | null, host: string | null, port: number | null, txt: Record<string, string> }>,
 *   summary: { hostCount: number, serviceCount: number, addressCount: number },
 *   findings: string[]
 * }}
 */
export function harvestMdnsNames(text) {
  const raw = String(text || '');
  const { hosts, services } = parseMdnsRecords(raw);

  const hostList = [...hosts.entries()]
    .map(([name, h]) => ({
      name,
      addresses: [...h.addresses],
      services: [...h.services],
      detail:
        `mDNS host '${name}'${[...h.addresses].length ? ` (${[...h.addresses].join(', ')})` : ''} ` +
        `announces: ${[...h.services].join(', ') || 'no parsed services'}. ` +
        'Service types reveal device roles (printers, file shares, dev servers).',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const svcList = services.map(s => ({
    instance: s.instance,
    serviceType: s.serviceType,
    host: s.host,
    port: s.port,
    txt: s.txt,
  }));

  const summary = {
    hostCount: hostList.length,
    serviceCount: svcList.length,
    addressCount: hostList.reduce((n, h) => n + h.addresses.length, 0),
  };

  const findings = [];
  if (hostList.length) {
    findings.push(
      `${hostList.length} .local hostname(s) harvested: ${hostList
        .slice(0, 12)
        .map(h => h.name)
        .join(', ')}` +
        `${hostList.length > 12 ? ` (+${hostList.length - 12} more)` : ''} — adjacent-network device inventory.`
    );
  }
  const interesting = svcList.filter(s =>
    /_ssh\._tcp|_http\._tcp|_smb\._tcp|_afpovertcp|_rdp\._tcp|_vnc\._tcp/i.test(s.serviceType || '')
  );
  if (interesting.length) {
    findings.push(
      `${interesting.length} remote-access/file service(s) advertised: ` +
        interesting
          .slice(0, 6)
          .map(s => `${s.serviceType} on ${s.host || s.instance}${s.port ? `:${s.port}` : ''}`)
          .join(', ') +
        ' — directly reachable service endpoints.'
    );
  }
  const printers = svcList.filter(s =>
    /_ipp\._tcp|_printer\._tcp|_pdl-datastream/i.test(s.serviceType || '')
  );
  if (printers.length) {
    findings.push(
      `${printers.length} printer(s) advertising IPP: printers frequently expose ` +
        'admin panels and stored documents — inventory their models.'
    );
  }
  if (!hostList.length && !svcList.length) {
    const v4 = [...new Set(raw.match(IPV4_RE) || [])];
    const v6 = [...new Set(raw.match(IPV6_RE) || [])];
    if (v4.length || v6.length) {
      findings.push(
        `No .local names parsed, but ${v4.length + v6.length} address(es) observed in the text: ` +
          `${[...v4, ...v6].slice(0, 8).join(', ')} — confirm the input format.`
      );
    } else {
      findings.push(
        'No mDNS data parsed — confirm the input is avahi-browse, dns-sd, or captured .local DNS records.'
      );
    }
  }

  return { hosts: hostList, services: svcList, summary, findings };
}
