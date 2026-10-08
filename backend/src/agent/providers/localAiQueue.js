import crypto from 'crypto';

export class LocalAIQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxConcurrency = parseInt(process.env.PHONE_AI_MAX_CONCURRENCY || '1', 10);
    this.activeCount = 0;
    // The phone's generation slot serialises everything, so a 429/busy error is
    // a normal transient condition. The queue retries on a short cadence and
    // the brain layers its own waiting-state on top — the item never errors
    // before the brain's own classification has had a chance to run.
    this.maxRetries = parseInt(process.env.PHONE_AI_QUEUE_MAX_RETRIES || '6', 10);
    this.retryDelayMs = parseInt(process.env.PHONE_AI_QUEUE_RETRY_MS || '1500', 10);
  }

  async processQueue() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const item = this.queue.shift();
    const { task, resolve, reject, requestId, retries = 0 } = item;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      const statusStr = String(error.status || error.statusCode || error.message || '');
      const isTransient =
        statusStr.includes('429') ||
        statusStr.includes('503') ||
        error.code === 'ECONNRESET' ||
        error.name === 'FetchError';

      if (isTransient && retries < this.maxRetries) {
        console.warn(
          `[LocalAIQueue] Local AI busy (${error.message || statusStr}). Retrying queue item (${retries + 1}/${this.maxRetries}) in ${this.retryDelayMs}ms...`
        );
        setTimeout(() => {
          this.queue.unshift({ task, resolve, reject, requestId, retries: retries + 1 });
          this.activeCount--;
          this.processQueue();
        }, this.retryDelayMs);
        return;
      }
      reject(error);
    } finally {
      if (this.activeCount > 0) {
        this.activeCount--;
      }
      setImmediate(() => this.processQueue());
    }
  }

  enqueue(task, requestId = crypto.randomUUID()) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject, requestId, retries: 0 });
      this.processQueue();
    });
  }

  /**
   * Queue observability for the dashboard.
   *
   * This is deliberately NOT a quota: nothing is ever rejected because the
   * queue is long. A single phone is the bottleneck, so work waits its turn
   * (requirement #42).
   */
  stats() {
    return {
      pending: this.queue.length,
      active: this.activeCount,
      maxConcurrency: this.maxConcurrency,
      isProcessing: this.isProcessing,
      policy: 'queue-wait-never-reject',
    };
  }
}

export const localAIQueue = new LocalAIQueue();
