/**
 * LongGenerationStore — persistence for long-generation records.
 * One document per generationId in the `lc_generations` collection.
 * Contains the plan, all generated parts, progress and status so a browser
 * refresh or server restart never loses completed work (#25, #42).
 */
class LongGenerationStore {
  constructor(database) {
    this.database = database;
  }

  async save(record) {
    const existing = await this.database.collection('lc_generations').findOne({ generationId: record.generationId });
    if (existing) {
      await this.database.collection('lc_generations').updateOne(
        { generationId: record.generationId },
        { $set: record }
      );
    } else {
      await this.database.collection('lc_generations').insertOne(record);
    }
    return record;
  }

  async get(generationId) {
    return this.database.collection('lc_generations').findOne({ generationId });
  }

  async listForUser(userId, conversationId, { limit = 20 } = {}) {
    const all = await this.database
      .collection('lc_generations')
      .find(conversationId ? { userId, conversationId } : { userId })
      .toArray();
    all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return all.slice(0, limit);
  }
}

export { LongGenerationStore };
