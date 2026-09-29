import { randomUUID } from 'crypto';

export class InfiniteChatModel {
  constructor(database) {
    this.database = database;
  }

  async get(userId, conversationId) {
    return this.database.collection('infinite_chats').findOne({ userId, conversationId });
  }

  async appendMessages(userId, conversationId, newMessages) {
    const now = new Date().toISOString();
    
    // Check if conversation exists
    const existing = await this.get(userId, conversationId);
    
    if (existing) {
      await this.database.collection('infinite_chats').updateOne(
        { userId, conversationId },
        { 
          $push: { messages: { $each: newMessages } },
          $set: { updatedAt: now } 
        }
      );
      const updated = await this.get(userId, conversationId);
      return updated;
    } else {
      const chat = {
        userId,
        conversationId,
        messages: newMessages,
        createdAt: now,
        updatedAt: now
      };
      await this.database.collection('infinite_chats').insertOne(chat);
      return chat;
    }
  }

  async updateMessages(userId, conversationId, messages) {
    const now = new Date().toISOString();
    await this.database.collection('infinite_chats').updateOne(
      { userId, conversationId },
      { $set: { messages, updatedAt: now } }
    );
    return this.get(userId, conversationId);
  }

  async list(userId) {
    return this.database.collection('infinite_chats').find({ userId }).sort({ updatedAt: -1 }).toArray();
  }
}
