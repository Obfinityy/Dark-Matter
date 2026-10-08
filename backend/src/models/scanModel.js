import { assert } from '../core/errors.js';
import { id, now } from '../core/utils.js';

export class ScanModel {
  constructor(database) {
    this.collection = database.collection('scans');
  }

  async list(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async get(userId, scanId) {
    const scan = await this.collection.findOne({ id: scanId, userId });
    assert(scan && scan.userId === userId, 404, 'Scan not found', 'SCAN_NOT_FOUND');
    return scan;
  }

  async getInternal(scanId) {
    return this.collection.findOne({ id: scanId });
  }

  async create({ userId, targetId, mode = 'NORMAL', message }) {
    const scan = {
      id: id('scan'),
      userId,
      targetId,
      mode: String(mode).toUpperCase(),
      toolId: 'subdomain-enumerator',
      status: 'queued',
      currentPhase: 'initializing',
      progress: 0,
      createdAt: now(),
      updatedAt: now(),
      messages: message
        ? [
            {
              id: id('msg'),
              role: 'user',
              content: String(message).slice(0, 6000),
              createdAt: now(),
            },
          ]
        : [],
      results: { subdomains: [], source: null },
      error: null,
    };
    await this.collection.insertOne(scan);
    return scan;
  }

  async update(scanId, patch) {
    await this.collection.updateOne({ id: scanId }, { $set: { ...patch, updatedAt: now() } });
  }
}
