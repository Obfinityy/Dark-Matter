/**
 * ComputerEvents — the computer layer's event channel.
 *
 * Reuses DARKMATTER's existing EventService (collection `events`, keyed by
 * `scanId`) instead of introducing a second event framework. The job id is used
 * as the channel so every computer event is persisted and therefore replayable
 * after a browser refresh / reconnect (requirement #20, #50).
 *
 * Event types emitted here line up with the autonomous dashboard:
 *   computer.probe, computer.state, computer.action, computer.observation,
 *   computer.error
 */

export class ComputerEvents {
  constructor({ eventService = null, state = null } = {}) {
    this.eventService = eventService;
    this.state = state;
    this.recent = []; // in-process ring buffer for late subscribers
    this.maxRecent = 500;
    this.listeners = new Set();
  }

  /** Attach the persisted event service once the app is built. */
  attach(eventService) {
    this.eventService = eventService;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Publish a computer event.
   * @param {string} channel jobId / assessmentId
   */
  async publish(channel, { type, level = 'INFO', message, data = null }) {
    const event = {
      type: `computer.${type}`,
      level,
      message: String(message || ''),
      data: data || null,
      channel,
    };

    this.recent.push({ ...event, at: new Date().toISOString() });
    if (this.recent.length > this.maxRecent)
      this.recent.splice(0, this.recent.length - this.maxRecent);

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* ignore broken listener */
      }
    }

    if (this.eventService && channel) {
      try {
        return await this.eventService.publish(channel, event);
      } catch {
        /* event persistence must never break an agent action */
      }
    }
    return null;
  }

  /** Recent events, for the dashboard's first paint before SSE attaches. */
  listRecent(channel, limit = 100) {
    const filtered = channel ? this.recent.filter(e => e.channel === channel) : this.recent;
    return filtered.slice(-limit);
  }
}
