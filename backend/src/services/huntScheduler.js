/**
 * huntScheduler.js
 *
 * Scheduled hunts: the user sets a target + cadence once, and the agent
 * re-hunts it on schedule — continuous monitoring, the way a real bounty
 * hunter re-tests targets after every deploy.
 *
 * The scheduler is deliberately simple and crash-safe:
 *   • `tick()` finds due schedules and fires them. It is idempotent:
 *     a schedule is advanced to its next run BEFORE the job is created,
 *     so a crash between the two never double-fires.
 *   • Cadence arithmetic is in plain date math (daily / weekly / once).
 *   • The host (app.js) calls tick() on an interval; tests call it directly.
 *
 * Job creation goes through an injected `createJob` callback so this service
 * never imports the job manager (no import cycles).
 */

import { randomUUID } from 'node:crypto';

const CADENCE_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export class HuntScheduler {
  constructor({ scheduleModel, createJob, alertService = null, logger = console }) {
    this.scheduleModel = scheduleModel;
    this.createJob = createJob;
    this.alertService = alertService;
    this.logger = logger;
  }

  nextRunAfter(cadence, from = new Date()) {
    if (cadence === 'once') return null;
    const ms = CADENCE_MS[cadence];
    if (!ms) throw new Error(`Unknown cadence: ${cadence}`);
    return new Date((from instanceof Date ? from.getTime() : new Date(from).getTime()) + ms).toISOString();
  }

  async schedule({ userId, name, target, scope, objective = null, cadence = 'weekly', nextRunAt = null }) {
    if (!['once', 'daily', 'weekly'].includes(cadence)) {
      throw new Error(`Unknown cadence: ${cadence}`);
    }
    const schedule = {
      id: randomUUID(),
      userId,
      name: name || `Scheduled hunt: ${target}`,
      target,
      scope: scope || null,
      objective,
      cadence,
      nextRunAt: nextRunAt || new Date().toISOString(),
      enabled: true,
      lastJobId: null,
      lastRunAt: null,
      createdAt: new Date().toISOString(),
    };
    await this.scheduleModel.create(schedule);
    return schedule;
  }

  /**
   * Fire every due schedule. Returns the list of jobs created.
   */
  async tick(now = new Date()) {
    const due = await this.scheduleModel.due(now);
    const fired = [];

    for (const schedule of due) {
      try {
        // Advance FIRST — crash safety: never fire the same run twice.
        const next = this.nextRunAfter(schedule.cadence, now);
        await this.scheduleModel.update(schedule.userId, schedule.id, {
          nextRunAt: next,
          enabled: schedule.cadence === 'once' ? false : schedule.enabled,
          lastRunAt: (now instanceof Date ? now : new Date(now)).toISOString(),
        });

        const job = await this.createJob({
          userId: schedule.userId,
          target: schedule.target,
          scope: schedule.scope,
          objective: schedule.objective || `Scheduled ${schedule.cadence} hunt of ${schedule.target}`,
          origin: { kind: 'schedule', scheduleId: schedule.id },
        });

        await this.scheduleModel.update(schedule.userId, schedule.id, { lastJobId: job.id });
        fired.push({ scheduleId: schedule.id, jobId: job.id });

        if (this.alertService) {
          await this.alertService.notify({
            userId: schedule.userId,
            type: 'hunt_started',
            title: `Scheduled hunt started: ${schedule.target}`,
            body: `The "${schedule.name}" schedule fired and the agent is now hunting ${schedule.target}.`,
            jobId: job.id,
            metadata: { scheduleId: schedule.id, cadence: schedule.cadence },
          }).catch((err) => this.logger.warn('[scheduler] alert failed', err.message));
        }
      } catch (err) {
        this.logger.warn(`[scheduler] failed to fire schedule ${schedule.id}`, err.message);
      }
    }

    return fired;
  }
}
