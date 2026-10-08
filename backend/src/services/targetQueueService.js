/**
 * targetQueueService.js
 *
 * The multi-target queue: the user pastes several targets, the agent hunts
 * them one after another with zero supervision. When a job finishes, the
 * worker calls `onJobComplete(job)` and the queue advances to the next
 * target automatically.
 *
 * Like the scheduler, job creation goes through an injected `createJob`
 * callback (no import cycles). Queue state lives in TargetQueueModel.
 */

import { randomUUID } from 'node:crypto';

export class TargetQueueService {
  constructor({ queueModel, createJob, alertService = null, logger = console }) {
    this.queueModel = queueModel;
    this.createJob = createJob;
    this.alertService = alertService;
    this.logger = logger;
  }

  async createQueue({ userId, name, targets }) {
    const urls = (targets || []).map(t => (typeof t === 'string' ? { url: t } : t));
    if (!urls.length) throw new Error('A queue needs at least one target.');
    const queue = {
      id: randomUUID(),
      userId,
      name: name || `Queue of ${urls.length} targets`,
      status: 'active',
      targets: urls.map(t => ({
        url: t.url,
        scope: t.scope || null,
        status: 'queued',
        jobId: null,
      })),
      createdAt: new Date().toISOString(),
    };
    await this.queueModel.create(queue);
    // Start the first target immediately.
    await this._startNext(userId, queue.id);
    return this.queueModel.get(userId, queue.id);
  }

  async pause(userId, queueId) {
    return this.queueModel.update(userId, queueId, { status: 'paused' });
  }

  async resume(userId, queueId) {
    const queue = await this.queueModel.update(userId, queueId, { status: 'active' });
    if (queue) await this._startNext(userId, queueId);
    return this.queueModel.get(userId, queueId);
  }

  /**
   * Called by the worker when a hunt completes. Marks the finished target
   * and starts the next one. Safe to call for jobs that belong to no queue.
   */
  async onJobComplete(job) {
    if (!job) return null;
    const queues = await this.queueModel.list(job.userId);
    const queue = queues.find(
      q => q.status === 'active' && q.targets.some(t => t.jobId === job.id)
    );
    if (!queue) return null;

    const targets = queue.targets.map(t =>
      t.jobId === job.id ? { ...t, status: job.status === 'completed' ? 'done' : 'failed' } : t
    );
    const remaining = targets.some(t => t.status === 'queued');
    await this.queueModel.update(job.userId, queue.id, {
      targets,
      status: remaining ? 'active' : 'complete',
    });

    if (remaining && this.alertService) {
      const next = targets.find(t => t.status === 'queued');
      await this.alertService
        .notify({
          userId: job.userId,
          type: 'queue_advanced',
          title: `Queue advanced: ${next.url}`,
          body: `Finished ${job.target}. The agent is now hunting the next target in "${queue.name}".`,
          jobId: job.id,
          metadata: { queueId: queue.id },
        })
        .catch(err => this.logger.warn('[queue] alert failed', err.message));
    }

    if (remaining) {
      await this._startNext(job.userId, queue.id);
    }
    return this.queueModel.get(job.userId, queue.id);
  }

  async _startNext(userId, queueId) {
    const queue = await this.queueModel.get(userId, queueId);
    if (!queue || queue.status !== 'active') return null;
    const next = queue.targets.find(t => t.status === 'queued');
    if (!next) {
      await this.queueModel.update(userId, queueId, { status: 'complete' });
      return null;
    }
    try {
      const job = await this.createJob({
        userId,
        target: next.url,
        scope: next.scope,
        objective: `Queued hunt of ${next.url} ("${queue.name}")`,
        origin: { kind: 'queue', queueId },
      });
      const targets = queue.targets.map(t =>
        t.url === next.url && t.status === 'queued' ? { ...t, status: 'active', jobId: job.id } : t
      );
      await this.queueModel.update(userId, queueId, { targets });
      return job;
    } catch (err) {
      this.logger.warn(`[queue] failed to start ${next.url}`, err.message);
      const targets = queue.targets.map(t =>
        t.url === next.url && t.status === 'queued' ? { ...t, status: 'failed' } : t
      );
      await this.queueModel.update(userId, queueId, { targets });
      return null;
    }
  }
}
