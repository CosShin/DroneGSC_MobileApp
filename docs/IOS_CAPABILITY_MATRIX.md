# ANITECH GCS iOS Capability Matrix

Status date: 2026-09-05

This matrix is based on the current repository, installed native packages, iOS
project files, and local Node test results. It is not a substitute for real
iPhone, SITL, or bench Pixhawk validation.

## Connection And Network

| Feature | iOS classification | Android classification | iOS app action | Evidence |
| --- | --- | --- | --- | --- |
| WebSocket / WSS Pi Gateway | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled | JS `WebSocketTransport` uses binary `arraybuffer` payloads and feeds the single MAVLink parser. |
| Wi-Fi LAN path | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled | OS network path only; not treated as a MAVLink protocol. |
| Tailscale / system VPN path | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled | OS network path only; WebSocket URL may target `100.x.x.x`. |
| Direct UDP MAVLink | UNKNOWN | SUPPORTED_ANDROID when native module is present | Hidden on iOS | `react-native-udp` is installed and has an iOS pod, but no real-iPhone reconnect/packet-rate evidence exists. |
| Direct TCP MAVLink | UNKNOWN | SUPPORTED_ANDROID when native module is present | Hidden on iOS | `react-native-tcp-socket` is installed and has an iOS pod, but no real-iPhone lifecycle evidence exists. |
| USB serial MAVLink | ANDROID_ONLY | SUPPORTED_ANDROID when ANITECH native module is present | Hidden on iOS | Current implementation intentionally returns no iOS devices and requires `NativeModules.AnitechUsbSerial` on Android. |
| Local Network permission | SUPPORTED_IOS | N/A | Enabled | `NSLocalNetworkUsageDescription` is present. |
| ATS local networking | SUPPORTED_IOS | N/A | Enabled | `NSAllowsLocalNetworking=true`, `NSAllowsArbitraryLoads=false`. |

## Video

| Feature | iOS classification | Android classification | iOS app action | Evidence |
| --- | --- | --- | --- | --- |
| WebRTC via MediaMTX/WebView | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled | `WebRtcVideoPlayer` is WebView based and video remains independent from MAVLink state. |
| RTSP / VLC | REPLACE_REQUIRED | SUPPORTED_ANDROID when native VLC view is present | Hidden on iOS | `react-native-vlc-media-player` has an iOS pod, but it is not verified with RN New Architecture on real iPhone. |
| UDP H.264 / RTP VLC | REPLACE_REQUIRED | SUPPORTED_ANDROID when UDP and VLC are present | Hidden on iOS | Player depends on native VLC; iOS path follows RTSP/VLC decision. |

## Voice, AI, Storage

| Feature | iOS classification | Android classification | iOS app action | Evidence |
| --- | --- | --- | --- | --- |
| Speech recognition | PARTIAL_IOS | PARTIAL_IOS | Enabled as optional | `expo-speech-recognition` is configured, but real-iPhone permission/audio-session evidence is still required. |
| TTS | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled as optional | `expo-speech` is configured; failures must not affect flight. |
| AI / Ollama over LAN or VPN | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled as optional | AI services use HTTP clients and tests assert AI failures do not mutate flight connection state. |
| MAVLink signing key storage | SUPPORTED_BOTH | SUPPORTED_BOTH | Enabled | `expo-secure-store` is configured; signing keys are not stored in Redux. |
| File/media capture storage | PARTIAL_IOS | PARTIAL_IOS | Enabled as optional | Expo media/file modules are configured; real-device permission flow still needs validation. |

## Runtime Decisions Implemented

- iOS Settings now offers WebSocket/WSS Pi Gateway as the connection route and hides unverified direct UDP, direct TCP, and USB serial transport choices.
- iOS Settings hides network profiles that would select hidden transports, including USB Direct and UDP-based SITL/telemetry radio profiles.
- Saved connection profiles targeting hidden/unavailable transports are disabled in Settings on iOS instead of silently loading a broken transport.
- iOS video transport choices hide RTSP/VLC and UDP H.264 until real-iPhone New Architecture validation exists.
- iOS native autolinking is disabled for `react-native-udp`, `react-native-tcp-socket`, and `react-native-vlc-media-player`; Android autolinking is preserved.

## Required Real-Device Validation Before PASS

- Launch Expo development build on a real iPhone.
- Grant Local Network, microphone, speech recognition, location, and media permissions.
- Connect `ws://192.168.x.x:8765/mavlink` to the Pi Gateway.
- Connect `ws://100.x.x.x:8765/mavlink` over Tailscale.
- Confirm MAVLink `HEARTBEAT`, telemetry freshness, SYSID/COMPID, RX/TX rates, and no duplicate listeners over 20 reconnect cycles.
- Verify dual joystick multi-touch in SITL first, then Pixhawk bench test with props removed.
- Verify WebRTC video switching and background/foreground behavior.
- Verify AI offline/failure paths do not affect MAVLink, joystick, map, or video.
