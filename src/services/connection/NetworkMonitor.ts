import { AppState, type AppStateStatus, type NativeEventSubscription, NativeModules, Platform } from 'react-native';
import type { NetInfoState } from '@react-native-community/netinfo';
import type { NetworkSnapshot } from './ConnectionHealth';

type NetworkListener = (snapshot: NetworkSnapshot, previous: NetworkSnapshot) => void;

const initialSnapshot = (): NetworkSnapshot => ({
  isConnected: null,
  isInternetReachable: null,
  type: null,
  changedAt: Date.now(),
});

/**
 * Safely resolves the native NetInfo module only if RNCNetInfo is present in the runtime.
 * This prevents crashes in Expo Go or custom dev clients where the native module is not linked.
 */
function getNativeNetInfo(): {
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
  refresh: () => Promise<NetInfoState>;
} | null {
  try {
    if (typeof NativeModules !== 'undefined' && NativeModules?.RNCNetInfo) {
      // Lazy-require only when the underlying native module actually exists
      const netInfo = require('@react-native-community/netinfo');
      return netInfo.default || netInfo;
    }
  } catch {
    // Gracefully ignore require errors if native bridge is not linked
  }
  return null;
}

export class NetworkMonitor {
  private snapshot = initialSnapshot();
  private listeners = new Set<NetworkListener>();
  private foregroundListeners = new Set<() => void>();
  private removeNetInfo: (() => void) | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private appState: AppStateStatus = typeof AppState !== 'undefined' && AppState.currentState ? AppState.currentState : 'active';

  start() {
    this.appState = typeof AppState !== 'undefined' && AppState.currentState ? AppState.currentState : 'active';

    // 1. Native NetInfo listener if native module is present
    const netInfo = getNativeNetInfo();
    if (netInfo && !this.removeNetInfo) {
      try {
        this.removeNetInfo = netInfo.addEventListener(state => this.handleNetworkState(state));
      } catch {
        this.removeNetInfo = null;
      }
    }

    // 2. Default snapshot when NetInfo native module is absent (e.g. Expo Go on iOS)
    if (!netInfo && this.snapshot.isConnected === null) {
      this.snapshot = {
        isConnected: true,
        isInternetReachable: null,
        type: Platform.OS === 'ios' ? 'wifi' : 'unknown',
        changedAt: Date.now(),
      };
    }

    // 3. React Native AppState listener (safe on all platforms)
    if (!this.appStateSubscription && typeof AppState !== 'undefined' && AppState.addEventListener) {
      this.appStateSubscription = AppState.addEventListener('change', next => {
        const wasBackground = this.appState !== 'active';
        this.appState = next;
        if (next === 'active' && wasBackground) {
          const activeNetInfo = getNativeNetInfo();
          const refreshPromise = activeNetInfo
            ? activeNetInfo.refresh().then(state => this.handleNetworkState(state)).catch(() => {})
            : Promise.resolve();
          void refreshPromise.finally(() => {
            this.foregroundListeners.forEach(listener => listener());
          });
        }
      });
    }
  }

  stop() {
    this.removeNetInfo?.();
    this.removeNetInfo = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  getSnapshot() { return { ...this.snapshot }; }

  onChange(listener: NetworkListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onForeground(listener: () => void) {
    this.foregroundListeners.add(listener);
    return () => this.foregroundListeners.delete(listener);
  }

  private handleNetworkState(state: NetInfoState) {
    const previous = this.snapshot;
    const next: NetworkSnapshot = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type ?? null,
      changedAt: Date.now(),
    };
    if (previous.isConnected === next.isConnected
      && previous.isInternetReachable === next.isInternetReachable
      && previous.type === next.type) return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener({ ...next }, { ...previous }));
  }
}

export const networkMonitor = new NetworkMonitor();
