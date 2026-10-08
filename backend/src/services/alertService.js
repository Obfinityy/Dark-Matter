/**
 * alertService.js
 *
 * The agent's alert center. Anything worth the user's immediate attention
 * becomes an alert:
 *
 *   - critical_finding : a critical-severity vulnerability was confirmed
 *   - hunt_complete    : a hunt finished (with its finding counts)
 *   - hunt_started     : a scheduled hunt started on its own
 *   - queue_advanced   : the multi-target queue moved to the next target
 *
 * Alerts are stored (so the UI has an alert center) and published as events
 * (so the live UI can push them immediately). Delivery beyond the app
 * (webhook / push) is intentionally a user-configured extension point, not
 * a silent default — see `registerChannel`.
 */

import { randomUUID } from 'node:crypto';

const ALERT_TYPES = [
  'critical_finding',
  'hunt_complete',
  'hunt_started',
  'queue_advanced',
  'schedule_due',
];

class AlertService {
  constructor({ alertModel, eventService, logger }) {
    this.alertModel = alertModel;
    this.eventService = eventService;
    this.logger = logger || console;
    this.channels = [];
  }

  /**
   * Register an external delivery channel, e.g. a webhook.
   * A channel is `async (alert) => {}`. Failures are logged, never thrown.
   */
  registerChannel(channel) {
    if (typeof channel === 'function') this.channels.push(channel);
  }

  async notify({ userId, type, title, body, jobId = null, metadata = {} }) {
    if (!ALERT_TYPES.includes(type)) {
      throw new Error(`Unknown alert type: ${type}`);
    }
    const alert = {
      id: randomUUID(),
      userId,
      type,
      title: String(title || ''),
      body: String(body || ''),
      jobId,
      metadata,
      read: false,
      createdAt: new Date().toISOString(),
    };

    await this.alertModel.create(alert);

    // Live push inside the app.
    if (this.eventService && jobId) {
      await this.eventService
        .publish(jobId, {
          type: 'ALERT_RAISED',
          alert: { id: alert.id, type, title, body, createdAt: alert.createdAt },
        })
        .catch(err => this.logger.warn('[alert] event publish failed', err.message));
    }

    // External channels (webhook etc.). Best-effort.
    for (const channel of this.channels) {
      try {
        await channel(alert);
      } catch (err) {
        this.logger.warn('[alert] channel failed', err.message);
      }
    }

    return alert;
  }

  /**
   * Called by the worker when a finding is confirmed. Only critical
   * findings alert immediately — high and below are batched into the
   * completion summary.
   */
  async notifyCriticalFinding({ userId, job, finding }) {
    return this.notify({
      userId,
      type: 'critical_finding',
      title: `Critical vulnerability found: ${finding.title || finding.category}`,
      body:
        `The agent confirmed a CRITICAL finding on ${job.target || 'the target'} ` +
        `(${(finding.cvss && finding.cvss.score) || (finding.cvssMetrics && finding.cvssMetrics.baseScore) || 'CVSS pending'}). ` +
        `Review it in the findings board.`,
      jobId: job.id,
      metadata: { findingId: finding.id, severity: finding.severity },
    });
  }

  async notifyHuntComplete({ userId, job, stats }) {
    const parts = [
      `${stats.total} confirmed`,
      `${stats.critical} critical`,
      `${stats.high} high`,
    ].join(', ');
    return this.notify({
      userId,
      type: 'hunt_complete',
      title: `Hunt complete on ${job.target || 'target'}`,
      body: `The agent finished hunting. Findings: ${parts}. The submission-quality report is ready.`,
      jobId: job.id,
      metadata: { stats },
    });
  }

  async list(userId, { unreadOnly = false, limit = 50 } = {}) {
    return this.alertModel.list(userId, { unreadOnly, limit });
  }

  async markRead(userId, alertId) {
    return this.alertModel.markRead(userId, alertId);
  }

  async markAllRead(userId) {
    return this.alertModel.markAllRead(userId);
  }
}

export { AlertService, ALERT_TYPES };
