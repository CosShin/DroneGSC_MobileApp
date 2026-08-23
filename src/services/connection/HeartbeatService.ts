import { AppConfig } from '../../config';

type HeartbeatCallback = (isAlive: boolean) => void;

class HeartbeatService {
  private lastHeartbeat: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: HeartbeatCallback[] = [];

  start() {
    if (this.intervalId) return;
    this.lastHeartbeat = Date.now();
    this.intervalId = setInterval(() => {
      this.checkHeartbeat();
    }, 1000); // Check every second
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onHeartbeat(callback: HeartbeatCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== callback);
    };
  }

  // Called when we receive a heartbeat from the drone/gateway
  receiveHeartbeat() {
    this.lastHeartbeat = Date.now();
    this.notify(true);
  }

  private checkHeartbeat() {
    const now = Date.now();
    const diff = now - this.lastHeartbeat;
    if (diff > AppConfig.CONNECTION_TIMEOUT) {
      console.warn(`[HEARTBEAT] Connection timeout! Last heartbeat was ${diff}ms ago.`);
      this.notify(false);
    }
  }

  private notify(isAlive: boolean) {
    this.callbacks.forEach(cb => cb(isAlive));
  }
}

export const heartbeatService = new HeartbeatService();
