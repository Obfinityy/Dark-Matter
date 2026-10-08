import { config } from '../config.js';
import { AppError } from '../core/errors.js';

function unique(values) {
  return [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
}

function inScope(name, hostname) {
  return name === hostname || name.endsWith(`.${hostname}`);
}

export class SubdomainService {
  constructor({ scanModel, targetModel, eventService }) {
    this.scanModel = scanModel;
    this.targetModel = targetModel;
    this.eventService = eventService;
  }

  async start(scanId) {
    const scan = await this.scanModel.getInternal(scanId);
    const target = scan ? await this.targetModel.getInternal(scan.targetId) : null;
    if (!scan || !target) return;

    await this.scanModel.update(scanId, {
      status: 'running',
      currentPhase: 'subdomain-enumeration',
      progress: 10,
    });
    await this.eventService.publish(scanId, {
      type: 'tool.started',
      level: 'INFO',
      message: 'Subdomain enumeration started',
      data: { toolId: 'subdomain-enumerator', source: 'crt.sh', hostname: target.hostname },
    });

    try {
      const subdomains = await this.lookupCertificateTransparency(target.hostname);
      await this.scanModel.update(scanId, {
        status: 'completed',
        currentPhase: 'completed',
        progress: 100,
        results: { subdomains, source: 'crt.sh' },
      });
      await this.eventService.publish(scanId, {
        type: 'tool.completed',
        level: 'INFO',
        message: `Subdomain enumeration completed: ${subdomains.length} result${subdomains.length === 1 ? '' : 's'}`,
        data: { toolId: 'subdomain-enumerator', count: subdomains.length, subdomains },
      });
    } catch (error) {
      await this.scanModel.update(scanId, {
        status: 'failed',
        currentPhase: 'failed',
        progress: 100,
        error: error.message,
      });
      await this.eventService.publish(scanId, {
        type: 'tool.failed',
        level: 'ERROR',
        message: error.message,
        data: { toolId: 'subdomain-enumerator' },
      });
    }
  }

  async lookupCertificateTransparency(hostname) {
    const url = new URL('https://crt.sh/');
    url.searchParams.set('q', `%.${hostname}`);
    url.searchParams.set('output', 'json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.toolRequestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'DarkMatter-Subdomain-Enumerator/1.0',
        },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new AppError(
          502,
          `Certificate Transparency lookup failed with HTTP ${response.status}`,
          'SUBDOMAIN_LOOKUP_FAILED'
        );
      const records = await response.json();
      const names = records.flatMap(record => [
        record.common_name,
        ...String(record.name_value || '').split('\n'),
      ]);
      return unique(
        names.map(name =>
          String(name || '')
            .replace(/^\*\./, '')
            .replace(/\.$/, '')
        )
      ).filter(name => inScope(name, hostname) && name !== hostname);
    } catch (error) {
      if (error.name === 'AbortError')
        throw new AppError(
          504,
          'Certificate Transparency lookup timed out',
          'SUBDOMAIN_LOOKUP_TIMEOUT'
        );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
