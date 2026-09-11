export type OutboundPriority = 0 | 1 | 2 | 3 | 4;

interface QueueItem<T> {
  id: number;
  priority: OutboundPriority;
  value: T;
  replaceKey?: string;
  expiresAt: number | null;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export interface EnqueueOptions {
  priority: OutboundPriority;
  replaceKey?: string;
  maxAgeMs?: number;
  discardPendingKey?: string;
}

/** Serial priority queue. Replace keys provide latest-value-wins without control backlog. */
export class OutboundPriorityQueue<T> {
  private items: Array<QueueItem<T>> = [];
  private draining = false;
  private nextId = 1;
  private generation = 0;

  constructor(
    private readonly sender: (value: T) => Promise<void>,
    private readonly now: () => number = Date.now,
  ) {}

  enqueue(value: T, options: EnqueueOptions) {
    if (options.discardPendingKey) this.discardKey(options.discardPendingKey);
    if (options.replaceKey) this.discardKey(options.replaceKey);
    const generation = this.generation;
    return new Promise<void>((resolve, reject) => {
      this.items.push({
        id: this.nextId++,
        priority: options.priority,
        value,
        replaceKey: options.replaceKey,
        expiresAt: options.maxAgeMs === undefined ? null : this.now() + options.maxAgeMs,
        resolve,
        reject,
      });
      void this.drain(generation);
    });
  }

  clear(reason = 'OUTBOUND_QUEUE_CLEARED') {
    this.generation++;
    const pending = this.items.splice(0);
    pending.forEach(item => item.reject(new Error(reason)));
  }

  getDepth() { return this.items.length; }

  private discardKey(key: string) {
    const kept: Array<QueueItem<T>> = [];
    for (const item of this.items) {
      if (item.replaceKey === key) item.resolve();
      else kept.push(item);
    }
    this.items = kept;
  }

  private async drain(generation: number) {
    if (this.draining) return;
    this.draining = true;
    try {
      while (generation === this.generation && this.items.length) {
        this.items.sort((a, b) => a.priority - b.priority || a.id - b.id);
        const item = this.items.shift()!;
        if (item.expiresAt !== null && this.now() > item.expiresAt) {
          item.reject(new Error('OUTBOUND_PACKET_STALE'));
          continue;
        }
        try {
          await this.sender(item.value);
          item.resolve();
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      this.draining = false;
      if (this.items.length) void this.drain(this.generation);
    }
  }
}
