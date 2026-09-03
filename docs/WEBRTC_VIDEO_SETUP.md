# MediaMTX WebRTC video (Expo SDK 54)

ANITECH GCS uses the MediaMTX browser player inside `react-native-webview`. The main app is Expo SDK 54 and already uses the Expo-compatible `react-native-webview` 13.15.0. Video and MAVLink have independent state and lifecycle.

## Raspberry Pi / MediaMTX

Use a real LAN/VPN address for the Pi. Do not use `localhost`, `127.0.0.1`, or Android emulator alias `10.0.2.2` on a physical iPhone.

The bundled MediaMTX v1.9 configuration already enables:

```yaml
webrtc: yes
webrtcAddress: :8889
webrtcAllowOrigin: '*'
webrtcLocalUDPAddress: :8189
webrtcLocalTCPAddress: ''
webrtcIPsFromInterfaces: yes
webrtcAdditionalHosts: []
```

On the Raspberry Pi, set the actual Pi LAN/VPN address as an ICE candidate. Do not commit a site-specific IP into the mobile app:

```yaml
webrtcAdditionalHosts: [192.168.x.x]
```

Alternatively, launch MediaMTX with `MTX_WEBRTCADDITIONALHOSTS=192.168.x.x`. Allow inbound TCP 8889 (HTTP/signaling) and UDP 8189 (ICE media). TCP 8189 fallback is intentionally disabled; enable `webrtcLocalTCPAddress: :8189` only when UDP is known to be blocked.

Publish browser-compatible H.264 with no B-frames. Baseline plus low-latency encoder settings are the safest starting point; do not switch this iPhone WebRTC path to H.265.

## Test order

1. Start MediaMTX and publish the configured stream path.
2. On the iPhone, open Safari and visit `http://PI_IP:8889/landing-cam`.
3. Do not debug React Native until Safari plays the stream.
4. Run `npx expo start --go`, open the SDK 54 project in Expo Go, then select **Settings → Video**.
5. Enter scheme, Pi host, port 8889 and stream path; use **Open URL** to repeat the browser test and **Test in App** for WebView.
6. Stop MediaMTX to verify the non-blocking error/reconnect flow, then restart it.

If Safari fails, check the Pi route, stream publisher, codec/B-frames, TCP 8889, UDP 8189, firewall and `webrtcAdditionalHosts`. If Safari works but Expo Go does not, investigate iOS local-network or HTTP/ATS behavior. Changes to this project's `Info.plist` settings do not modify the App Store Expo Go binary; native permission/entitlement changes require a development build.

## Runtime behavior

- `WEBRTC` is the default and never mounts or imports the UDP/VLC player.
- `UDP H.264` is preserved for a future development-build-only entry point; it is disabled in Expo Go.
- A loaded WebView page is shown as `PLAYER READY`, not `LIVE`. `LIVE` is emitted only after the MediaMTX page's actual video element fires `playing`.
- Reconnect delays are 1, 2, 3 and then 5 seconds. Timers stop in the background and restart on foreground.
- Focused-screen gating prevents Fly, fullscreen, Precision Landing and Settings Test from running concurrent WebViews.
- Telemetry overlays subscribe separately and do not alter the WebView URL or key.
