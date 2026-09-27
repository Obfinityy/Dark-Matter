import { assert } from '../core/errors.js';
import { extractUrl } from '../core/utils.js';
import { normalizeTargetUrl } from '../models/targetModel.js';

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
}
