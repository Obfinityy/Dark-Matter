/**
 * eventService — event service.
 * Encapsulates event business logic used by controllers and workers.
 * Part of: Infinity AI / Dark-Matter backend (business-logic services).
 */

import { id, now } from '../core/utils.js';

/** Business-logic service for event. */
export class EventService {
  constructor(database) {
    this.collection = database.collection('events');
    this.listeners = new Map();
  }

  async list(scanId) {
    return this.collection.find({ scanId }).sort({ timestamp: 1 }).limit(1000).toArray();
  }

  async publish(scanId, input) {
    const event = {
      id: id('event'),
      scanId,
      type: input.type || 'scan.log',
      level: input.level || 'INFO',
      message: String(input.message || ''),
      data: input.data || null,
      timestamp: now(),
    };
    await this.collection.insertOne(event);
    for (const listener of this.listeners.get(scanId) || []) listener(event);
    return event;
  }

  subscribe(scanId, listener) {
    const listeners = this.listeners.get(scanId) || new Set();
    listeners.add(listener);
    this.listeners.set(scanId, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(scanId);
    };
  }
}
