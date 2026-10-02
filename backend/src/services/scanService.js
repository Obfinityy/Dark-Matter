import { assert } from '../core/errors.js';
import { extractUrl } from '../core/utils.js';
import { normalizeTargetUrl } from '../models/targetModel.js';
import { chainNaabuToNmap, parseNmapXml } from '../recon/portChain.js';

export class ScanService {
  constructor({ targetModel, scanModel, eventService, subdomainService }) {
    this.targetModel = targetModel;
    this.scanModel = scanModel;
    this.eventService = eventService;
    this.subdomainService = subdomainService;
  }

  async list(userId) {
    const scans = await this.scanModel.list(userId);
    return Promise.all(scans.map(async (scan) => {
      const target = await this.targetModel.get(userId, scan.targetId);
      return {
        ...scan,
        targetUrl: target.url,
        targetHostname: target.hostname
      };
    }));
  }

  async get(userId, scanId) {
    const scan = await this.scanModel.get(userId, scanId);
    return { ...scan, events: await this.eventService.list(scanId) };
  }

  async startFromMessage(userId, input) {
    const targetUrl = input.targetUrl || extractUrl(input.message);
    if (!targetUrl) return { status: 'needs_target', message: 'Please provide an HTTP or HTTPS target URL.' };
    if (input.authorizationConfirmed !== true) {
      return {
        status: 'awaiting_authorization',
        targetUrl,
        message: 'Before I access this target, confirm that you are authorized to assess it and define its allowed scope.'
      };
    }

    const normalizedUrl = normalizeTargetUrl(targetUrl);
    let target = await this.targetModel.findByUrl(userId, normalizedUrl);
    if (!target) {
      target = await this.targetModel.create(userId, {
        url: normalizedUrl,
        name: input.targetName,
        scope: input.scope,
        authorizationConfirmed: true,
        authorizationNotes: input.authorizationNotes
      });
    }
    assert(target.authorization.confirmed, 400, 'Target authorization is required', 'AUTHORIZATION_REQUIRED');
    const scan = await this.scanModel.create({ userId, targetId: target.id, mode: input.mode, message: input.message });
    await this.eventService.publish(scan.id, { type: 'scan.created', level: 'INFO', message: 'Investigation queued', data: { toolId: scan.toolId, target: target.hostname } });
    this.subdomainService.start(scan.id).catch(() => undefined);
    return { status: 'started', scanId: scan.id, scan };
  }

  /**
   * naabu → nmap chaining (Worker 4): a fast naabu sweep's open ports feed a
   * TARGETED nmap service scan — never a full-range scan. Pure logic lives in
   * src/recon/portChain.js; this method wires it into the scan lifecycle and
   * publishes the chain decision as an event.
   *
   * @param {string} scanId
   * @param {string} naabuRawOutput — raw stdout of the naabu run
   * @param {object} opts — { timing, maxPorts }
   * @returns {{ chained, request|null, reason, ports, hosts }} — hand request to the ToolExecutor
   */
  async planPortChain(scanId, naabuRawOutput, opts = {}) {
    const scan = await this.scanModel.getInternal(scanId).catch(() => null);
    const target = scan ? await this.targetModel.getInternal(scan.targetId).catch(() => null) : null;
    const chain = chainNaabuToNmap(naabuRawOutput, { target: target?.hostname || scanId, ...opts });
    await this.eventService.publish(scanId, {
      type: chain.chained ? 'recon.port_chain.planned' : 'recon.port_chain.skipped',
      level: chain.chained ? 'INFO' : 'WARN',
      message: chain.chained
        ? `Port chain: targeted nmap over ${chain.ports.length} naabu-confirmed open port(s)`
        : `Port chain skipped: ${chain.reason}`,
      data: { ports: chain.ports, hosts: chain.hosts, reason: chain.reason }
    }).catch(() => {});
    return chain;
  }

  /** Parse nmap -oX XML into service records (used after a chained run). */
  parseChainedNmap(nmapXml) {
    return parseNmapXml(nmapXml);
  }
}
