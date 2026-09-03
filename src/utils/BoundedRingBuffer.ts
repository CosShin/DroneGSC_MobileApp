export class BoundedRingBuffer<T> {
  private storage: Array<T | undefined>;
  private start = 0;
  private length = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('INVALID_RING_BUFFER_CAPACITY');
    this.storage = new Array<T | undefined>(capacity);
  }

  get size() {
    return this.length;
  }

  push(value: T) {
    const index = (this.start + this.length) % this.capacity;
    this.storage[index] = value;
    if (this.length < this.capacity) {
      this.length++;
    } else {
      this.start = (this.start + 1) % this.capacity;
    }
  }

  clear() {
    this.storage = new Array<T | undefined>(this.capacity);
    this.start = 0;
    this.length = 0;
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let index = 0; index < this.length; index++) {
      result.push(this.storage[(this.start + index) % this.capacity] as T);
    }
    return result;
  }
}
