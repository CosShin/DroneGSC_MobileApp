import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useVideoStream } from '../../hooks/useVideoStream';
import { VideoErrorState } from './VideoErrorState';
import { videoFrameCaptureService, type CapturedFrame } from '../../services/video/VideoFrameCaptureService';

const PLAYBACK_MONITOR = `
(function () {
  if (window.__anitechVideoMonitorInstalled) return true;
  window.__anitechVideoMonitorInstalled = true;
  var style = document.createElement('style');
  style.textContent = 'html,body{margin:0!important;width:100%!important;height:100%!important;background:#050a11!important;overflow:hidden!important} video{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;background:#050a11!important}';
  document.head.appendChild(style);
  var wired = new WeakSet();
  function send(value) { window.ReactNativeWebView.postMessage(value); }
  function wire(video) {
    if (!video || wired.has(video)) return;
    wired.add(video);
    video.addEventListener('playing', function () { send('VIDEO_PLAYING'); });
    video.addEventListener('error', function () { send('VIDEO_ERROR'); });
    video.addEventListener('stalled', function () { send('VIDEO_STALLED'); });
    if (!video.paused && video.readyState >= 2) send('VIDEO_PLAYING');
  }
  function scan() { document.querySelectorAll('video').forEach(wire); }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });

  window.__anitechCaptureFrame = function () {
    try {
      var video = document.querySelector('video');
      if (!video || video.readyState < 2) {
        send(JSON.stringify({ type: 'FRAME_CAPTURE_ERROR', error: 'VIDEO_NOT_READY' }));
        return;
      }
      var w = video.videoWidth || 640;
      var h = video.videoHeight || 480;
      var maxDim = 640;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round(h * (maxDim / w));
          w = maxDim;
        } else {
          w = Math.round(w * (maxDim / h));
          h = maxDim;
        }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.80);
      var b64 = dataUrl.indexOf(',') !== -1 ? dataUrl.split(',')[1] : dataUrl;
      send(JSON.stringify({ type: 'FRAME_CAPTURED', base64: b64, width: w, height: h }));
    } catch (err) {
      send(JSON.stringify({ type: 'FRAME_CAPTURE_ERROR', error: String(err) }));
    }
  };

  return true;
})();
`;

export const WebRtcVideoPlayer = React.memo(function WebRtcVideoPlayer({
  enabled = true,
  onOpenFullscreen,
  publishGlobalRuntime = false,
}: {
  enabled?: boolean;
  onOpenFullscreen?: () => void;
  publishGlobalRuntime?: boolean;
}) {
  const stream = useVideoStream(enabled, publishGlobalRuntime);
  const source = React.useMemo(() => stream.url ? { uri: stream.url } : undefined, [stream.url]);
  const webViewRef = React.useRef<WebView>(null);
  const pendingCaptureRef = React.useRef<((frame: CapturedFrame | null) => void) | null>(null);

  // Register real frame provider for AI Copilot Vision analysis
  React.useEffect(() => {
    videoFrameCaptureService.registerFrameProvider(async () => {
      return new Promise<CapturedFrame | null>((resolve) => {
        pendingCaptureRef.current = resolve;
        webViewRef.current?.injectJavaScript(
          'if (window.__anitechCaptureFrame) { window.__anitechCaptureFrame(); } else { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "FRAME_CAPTURE_ERROR", error: "NOT_INSTALLED" })); } true;'
        );
        setTimeout(() => {
          if (pendingCaptureRef.current === resolve) {
            pendingCaptureRef.current = null;
            resolve(null);
          }
        }, 3000);
      });
    });

    return () => {
      videoFrameCaptureService.registerFrameProvider(null);
    };
  }, []);

  const onMessage = React.useCallback((event: WebViewMessageEvent) => {
    const message = event.nativeEvent.data;
    if (message === 'VIDEO_PLAYING') stream.onVideoPlaying();
    if (message === 'VIDEO_ERROR') stream.fail('MediaMTX player loaded, but the browser could not play the video track. Check that the stream exists and uses browser-compatible H.264 without B-frames.');
    if (message === 'VIDEO_STALLED') stream.fail('The WebRTC video track stalled. Check MediaMTX, the publisher and UDP 8189; the player will reconnect.');

    if (typeof message === 'string' && message.startsWith('{')) {
      try {
        const data = JSON.parse(message);
        if (data.type === 'FRAME_CAPTURED' && data.base64) {
          if (pendingCaptureRef.current) {
            pendingCaptureRef.current({
              base64: data.base64,
              width: data.width,
              height: data.height,
              timestamp: Date.now(),
              source: 'WEBRTC_PLAYER',
              isLive: true,
            });
            pendingCaptureRef.current = null;
          }
        } else if (data.type === 'FRAME_CAPTURE_ERROR') {
          if (pendingCaptureRef.current) {
            pendingCaptureRef.current(null);
            pendingCaptureRef.current = null;
          }
        }
      } catch {}
    }
  }, [stream]);

  if (!enabled || !source) return null;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        key={stream.reloadNonce}
        style={styles.webView}
        containerStyle={styles.webViewContainer}
        source={source}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['http://*', 'https://*']}
        mixedContentMode={Platform.OS === 'android' ? 'always' : undefined}
        setSupportMultipleWindows={false}
        injectedJavaScript={PLAYBACK_MONITOR}
        onMessage={onMessage}
        onLoadStart={stream.onLoadStart}
        onLoadEnd={stream.onLoadEnd}
        onError={event => stream.fail(`Unable to reach MediaMTX: ${event.nativeEvent.description || 'network error'}. Check the Pi address, TCP 8889, local-network access, and whether MediaMTX is running.`)}
        onHttpError={event => stream.fail(`MediaMTX returned HTTP ${event.nativeEvent.statusCode}. Check stream path "${stream.config.streamPath}" and that a publisher is active.`)}
        onContentProcessDidTerminate={() => stream.fail('The iOS WebView process stopped. The player will reconnect.')}
        allowsFullscreenVideo
        scrollEnabled={false}
        bounces={false}
      />
      {stream.runtime.status !== 'LIVE' ? (
        <VideoErrorState
          connecting={stream.runtime.status === 'IDLE' || stream.runtime.status === 'CONNECTING' || (stream.runtime.status === 'RECONNECTING' && !stream.runtime.lastError)}
          message={stream.runtime.lastError ?? (stream.runtime.status === 'RECONNECTING' ? `Reconnecting to MediaMTX (attempt ${stream.runtime.reconnectAttempt})…` : 'Waiting for a live video stream from the Raspberry Pi…')}
          onRetry={stream.runtime.status === 'ERROR' || stream.runtime.status === 'OFFLINE' || stream.runtime.status === 'RECONNECTING' ? stream.retry : undefined}
        />
      ) : null}
      {onOpenFullscreen ? <TouchableOpacity accessibilityLabel="Open fullscreen video" style={styles.fullscreen} onPress={onOpenFullscreen}><MaterialCommunityIcons name="fullscreen" size={22} color="#fff"/></TouchableOpacity> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#07111f' },
  webViewContainer: { backgroundColor: '#07111f' },
  webView: { flex: 1, backgroundColor: '#07111f' },
  fullscreen: { position: 'absolute', right: 10, bottom: 10, zIndex: 5, width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,.78)' },
});
