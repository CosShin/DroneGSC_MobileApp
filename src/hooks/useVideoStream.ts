import React from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectVideoSettings } from '../store/settings/settingsSlice';
import {
  selectVideoRuntime,
  setVideoSource,
  setVideoStatus,
  videoFailed,
  videoPlaying,
  videoReconnecting,
} from '../store/videoSlice';
import { selectWebRtcConfig } from '../video/VideoConfig';
import { buildMediaMtxWebRtcUrl } from '../video/VideoSourceResolver';
import type { VideoRuntimeState, VideoStatus } from '../video/VideoTypes';
import { createDevDiagnostics } from '../utils/devDiagnostics';

const RECONNECT_DELAYS_MS = [1_000, 2_000, 3_000, 5_000] as const;
const devLog = createDevDiagnostics('VIDEO', { minIntervalMs: 500, maxPerKey: 120 });

function isPermanentVideoFailure(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('app transport security')
    || normalized.includes('ats blocks')
    || normalized.includes('tls')
    || normalized.includes('secure connection');
}
const EMPTY_RUNTIME: VideoRuntimeState = {
  status: 'IDLE',
  currentUrl: null,
  lastConnectedAt: null,
  lastError: null,
  reconnectAttempt: 0,
};

export function useVideoStream(enabled = true, publishGlobalRuntime = false) {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectVideoSettings);
  const globalRuntime = useAppSelector(selectVideoRuntime);
  const [localRuntime, setLocalRuntime] = React.useState<VideoRuntimeState>(EMPTY_RUNTIME);
  const config = React.useMemo(
    () => selectWebRtcConfig(settings),
    [
      settings.scheme,
      settings.host,
      settings.port,
      settings.streamPath,
      settings.autoplay,
      settings.muted,
      settings.controls,
      settings.playsInline,
      settings.autoReconnect,
    ],
  );
  const resolved = React.useMemo(() => {
    try {
      return { url: buildMediaMtxWebRtcUrl(config, { platform: Platform.OS }), error: null };
    } catch (error) {
      return { url: null, error: error instanceof Error ? error.message : 'Invalid video configuration.' };
    }
  }, [config]);
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [playerPageLoaded, setPlayerPageLoaded] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = React.useRef(0);
  const failurePendingRef = React.useRef(false);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);

  const reportSource = React.useCallback((url: string | null) => {
    setLocalRuntime(current => ({
      ...current,
      currentUrl: url,
      lastError: null,
      reconnectAttempt: 0,
    }));
    if (publishGlobalRuntime) dispatch(setVideoSource(url));
  }, [dispatch, publishGlobalRuntime]);

  const reportStatus = React.useCallback((status: VideoStatus) => {
    setLocalRuntime(current => ({ ...current, status }));
    if (publishGlobalRuntime) dispatch(setVideoStatus(status));
  }, [dispatch, publishGlobalRuntime]);

  const reportFailure = React.useCallback((message: string) => {
    setLocalRuntime(current => ({ ...current, status: 'ERROR', lastError: message }));
    if (publishGlobalRuntime) dispatch(videoFailed(message));
  }, [dispatch, publishGlobalRuntime]);

  const reportReconnect = React.useCallback((attempt: number) => {
    setLocalRuntime(current => ({ ...current, status: 'RECONNECTING', reconnectAttempt: attempt }));
    if (publishGlobalRuntime) dispatch(videoReconnecting(attempt));
  }, [dispatch, publishGlobalRuntime]);

  const reportPlaying = React.useCallback(() => {
    const connectedAt = Date.now();
    setLocalRuntime(current => ({
      ...current,
      status: 'LIVE',
      lastConnectedAt: connectedAt,
      lastError: null,
      reconnectAttempt: 0,
    }));
    if (publishGlobalRuntime) dispatch(videoPlaying());
  }, [dispatch, publishGlobalRuntime]);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const connect = React.useCallback((resetAttempts: boolean) => {
    clearTimer();
    failurePendingRef.current = false;
    if (resetAttempts) attemptRef.current = 0;
    setPlayerPageLoaded(false);
    setReloadNonce(value => value + 1);
    devLog('connect', { resetAttempts, enabled, url: resolved.url });
    reportStatus('CONNECTING');
  }, [clearTimer, enabled, reportStatus, resolved.url]);

  const fail = React.useCallback((message: string) => {
    if (failurePendingRef.current) return;
    failurePendingRef.current = true;
    clearTimer();
    setPlayerPageLoaded(false);
    devLog('failure', { message, enabled, autoReconnect: config.autoReconnect, appState: appStateRef.current });
    reportFailure(message);
    if (isPermanentVideoFailure(message)) {
      devLog('no-retry-permanent-failure', { message });
      return;
    }
    if (!enabled || !config.autoReconnect || appStateRef.current !== 'active') return;

    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    reportReconnect(attempt);
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt - 1, RECONNECT_DELAYS_MS.length - 1)];
    devLog('schedule-reconnect', { attempt, delay });
    timerRef.current = setTimeout(() => connect(false), delay);
  }, [clearTimer, config.autoReconnect, connect, enabled, reportFailure, reportReconnect]);

  React.useEffect(() => {
    clearTimer();
    attemptRef.current = 0;
    reportSource(resolved.url);
    if (!enabled) {
      reportStatus('IDLE');
    } else if (resolved.error) {
      reportFailure(resolved.error);
    } else {
      connect(true);
    }
    return clearTimer;
  }, [clearTimer, connect, enabled, reportFailure, reportSource, reportStatus, resolved.error, resolved.url]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasBackground = appStateRef.current !== 'active';
      devLog('appstate', { previous: appStateRef.current, next: nextState, enabled });
      appStateRef.current = nextState;
      if (nextState !== 'active') {
        clearTimer();
      } else if (wasBackground && enabled && resolved.url) {
        connect(true);
      }
    });
    return () => subscription.remove();
  }, [clearTimer, connect, enabled, resolved.url]);

  const onLoadStart = React.useCallback(() => {
    setPlayerPageLoaded(false);
    devLog('load-start', { url: resolved.url });
    reportStatus('CONNECTING');
  }, [reportStatus, resolved.url]);
  const onLoadEnd = React.useCallback(() => {
    devLog('load-end', { url: resolved.url });
    setPlayerPageLoaded(true);
  }, [resolved.url]);
  const onVideoPlaying = React.useCallback(() => {
    clearTimer();
    attemptRef.current = 0;
    devLog('playing', { url: resolved.url });
    reportPlaying();
  }, [clearTimer, reportPlaying, resolved.url]);

  const runtime = publishGlobalRuntime ? globalRuntime : localRuntime;

  return {
    config,
    url: resolved.url,
    configurationError: resolved.error,
    runtime,
    reloadNonce,
    playerPageLoaded,
    onLoadStart,
    onLoadEnd,
    onVideoPlaying,
    fail,
    retry: () => connect(true),
  };
}
