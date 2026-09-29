import crypto from 'crypto';

class LocalAIQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxConcurrency = parseInt(process.env.PHONE_AI_MAX_CONCURRENCY || '1', 10);
    this.activeCount = 0;
  }

  async processQueue() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const { task, resolve, reject, requestId } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      setImmediate(() => this.processQueue());
    }
  }

  enqueue(task, requestId = crypto.randomUUID()) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject, requestId });
      this.processQueue();
    });
  }
}

export const localAIQueue = new LocalAIQueue();
