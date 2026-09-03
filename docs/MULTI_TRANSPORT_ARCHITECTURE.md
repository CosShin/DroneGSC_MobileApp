# ANITECH GCS — Multi-Transport Architecture Report

Ngày kiểm tra: 2026-09-02

## Architecture Before

- Pi Gateway qua WebSocket là đường MAVLink chính.
- UDP native đã có một phần nhưng chưa được đưa vào cùng một màn hình cấu hình/capability hoàn chỉnh.
- TCP và USB tồn tại trong kiểu Settings nhưng chưa có transport hoạt động đầy đủ.
- WebRTC/MediaMTX là đường video chính; chưa có provider RTSP native.
- Chưa có MAVLink 2 signing hoặc kho khóa bảo mật.
- Trạng thái transport/heartbeat đã bắt đầu được tách, nhưng UI và diagnostics chưa trình bày đủ các lớp.

## Architecture After

```text
UDP ───────┐
TCP ───────┤
USB Serial ├─ MavlinkTransport ─ MavlinkManager ─ MavlinkProtocol
WS / WSS ──┘                         │                 │
                                    ├─ telemetry      ├─ one stream parser
                                    ├─ commands/ACK   ├─ one encoder
                                    └─ mission        └─ MAVLink 2 signing

WebRTC ────┐
           ├─ VideoProvider ─ VideoStream/Fly view
RTSP ──────┘

Local Wi-Fi / telemetry radio / 4G / system VPN / SITL = network profile metadata
```

Chỉ một vehicle transport được mở trong một session. Mọi raw byte chunk, kể cả TCP/USB bị chia frame, đều đi vào cùng `MavlinkProtocol`. Video có registry/provider riêng và không quyết định trạng thái vehicle.

## Transport Capability Matrix

`PASS` chỉ dùng khi có bằng chứng test trong môi trường hiện có. Biên dịch thành công không được coi là test thiết bị thật.

| Capability | Android | iOS | Ghi chú |
|---|---:|---:|---|
| WebSocket (WS) | PASS | NOT TESTED | Luồng Pi Gateway binary hiện tại đã được quan sát hoạt động; vẫn cần test iPhone. |
| Secure WebSocket (WSS) | NOT TESTED | NOT TESTED | Cùng một transport, giữ TLS verification mặc định; chưa có endpoint chứng chỉ thật trong phiên test. |
| UDP listen/client | NOT TESTED | NOT TESTED | Native module build thành công; cần SITL/bench và development build. |
| TCP client | NOT TESTED | NOT TESTED | Native module build thành công; parser fragmentation có unit test. |
| USB Serial OTG | NOT TESTED | UNSUPPORTED | Android module, permission, scan/read/write/detach đã build; chưa cắm Pixhawk/radio thật. |
| WebRTC | PASS | NOT TESTED | MediaMTX/WebRTC đã được quan sát LIVE trên Android; iPhone chưa test. |
| RTSP | NOT TESTED | NOT TESTED | VLC native build thành công; cần camera/MediaMTX và thiết bị thật. |
| System VPN IP | NOT TESTED | NOT TESTED | App dùng IP/hostname VPN qua WS/WSS/TCP; không tạo VPN client riêng. |
| MAVLink 2 signing | PASS (unit) | PASS (unit) | Encode/verify, wrong key, replay và strict unsigned đều pass; bench integration chưa test. |
| Secure key storage | PASS (build) | NOT TESTED | Khóa nằm trong SecureStore, không Redux/AsyncStorage/profile/log. |

## Files Added

- `src/platform/PlatformCapabilities.ts`
- `src/services/connection/ConnectionProfiles.ts`
- `src/services/connection/ConnectionValidation.ts`
- `src/services/mavlink/TcpTransport.ts`
- `src/services/mavlink/UsbSerialTransport.ts`
- `src/services/mavlink/MavlinkSigning.ts`
- `src/services/mavlink/MavlinkSigningKeyStore.ts`
- `src/components/video/RtspVideoPlayer.tsx`
- `src/video/VideoProvider.ts`
- `android/app/src/main/java/com/anonymous/anitechgcs/AnitechUsbSerialModule.kt`
- `android/app/src/main/java/com/anonymous/anitechgcs/AnitechUsbSerialPackage.kt`
- `tests/connection-profiles.test.ts`

## Main Files Modified

- `src/services/mavlink/MavlinkTransport.ts`
- `src/services/mavlink/WebSocketTransport.ts`
- `src/services/mavlink/UdpTransport.ts`
- `src/services/mavlink/MavlinkProtocol.ts`
- `src/services/mavlink/MavlinkManager.ts`
- `src/services/connection/UniversalConnectionService.ts`
- `src/app/ConnectionManager.tsx`
- `src/app/SettingsPersistence.tsx`
- `src/app/screens/SettingsScreen.tsx`
- `src/components/video/VideoStream.tsx`
- `src/components/settings/WebRtcVideoSettings.tsx`
- `src/components/vehicle/MavlinkInspector.tsx`
- `src/services/mavlink/MavlinkInspectorService.ts`
- `src/store/settings/settingsSlice.ts`
- connection/video/MAVLink setting types and defaults
- Android manifest, Gradle app configuration and `MainApplication.kt`
- `package.json`, `package-lock.json`, `app.json`

## Native Dependencies Added

- `react-native-tcp-socket` — TCP client.
- `expo-secure-store` — lưu khóa signing ngoài Redux/AsyncStorage.
- `@noble/hashes` — SHA-256 cho MAVLink 2 signing.
- `com.github.mik3y:usb-serial-for-android:3.11.0` — Android USB host serial.
- `react-native-vlc-media-player` và `react-native-udp` đã có trong project và hiện được nối vào capability/build.

## Expo Development Build Requirements

Expo Go chỉ dùng được đường WebSocket/WebRTC hiện tại. UDP, TCP, USB Serial và RTSP cần native development/standalone build. Sau thay đổi native phải build và cài lại app; reload Metro không đủ.

Android release test artifact hiện tại: `android/app/build/outputs/apk/release/app-release.apk`. Artifact này dùng debug keystore theo cấu hình project hiện tại, chỉ dành cho test nội bộ; trước khi phát hành phải cấu hình release keystore riêng.

## Connection State Machine

- Transport: opening/ready/error.
- MAVLink: idle/waiting heartbeat/active/heartbeat lost.
- Vehicle: no vehicle/connected/stale.
- Video: offline/connecting/live/reconnecting/error.
- `CONNECTED` của ứng dụng chỉ xuất hiện sau HEARTBEAT hợp lệ và vehicle identity thật, không phải khi socket vừa mở.

## Transport Lifecycle

- Chuyển transport luôn teardown transport/parser session/listeners/timers cũ trước.
- Session ID tăng theo connection attempt; packet/ACK không được ghép lẫn session.
- WS/TCP/UDP reconnect có exponential backoff, tối đa 30 giây.
- USB không tự reconnect spam; người dùng scan/chọn/connect lại.
- Test reconnect 10 lần xác nhận subscription không nhân đôi.

## USB Implementation

- Android USB host scan bằng default serial prober.
- Hiển thị device name, VID:PID và permission state.
- Xin Android USB permission khi connect.
- Baud: 57600, 115200, 230400, 460800, 921600.
- Cấu hình 8-N-1; raw chunks đi vào parser chung.
- Rút cáp phát `USB_DEVICE_DETACHED`, đóng I/O và chuyển transport sang error/lost path.
- iOS được đánh dấu unsupported, không có nút giả.

## UDP Implementation

- LISTEN bind local address/port; CLIENT thêm remote host/port.
- Peer nhận được có thể dùng làm endpoint MAVLink trả lời.
- Socket cleanup, error state, RX/TX datagram/byte diagnostics và reconnect policy.
- Không hardcode 14550; đó chỉ là preset/default.

## TCP Implementation

- Native TCP client với host, port, timeout, keepalive, reconnect.
- Không giả định một callback bằng một MAVLink packet; mọi chunk được đưa cho streaming parser chung.
- Diagnostics gồm endpoint, connection time, last data, RX/TX bytes/packets.

## WS/WSS Implementation

- Một `WebSocketTransport` xử lý cả `ws://` và `wss://`.
- Không tắt TLS verification hoặc trust-all certificate.
- URL có validation và không hardcode IP bắt buộc; Pi Gateway chỉ là preset dễ dùng.
- Binary MAVLink từ gateway đi thẳng vào parser chung.

## Video Provider Architecture

- `VideoProvider` registry chọn WebRTC hoặc RTSP; FlyScreen không chứa conditionals theo từng native player.
- Provider validation/capability chạy trước khi player được load.
- Unmount/switch provider giải phóng WebView/VLC view cũ.
- Video runtime độc lập hoàn toàn với connection/heartbeat.

## RTSP Implementation

- RTSP dùng native VLC view, không dùng WebView hack.
- URL bắt buộc `rtsp://`, port hợp lệ và không cho nhúng username/password vào URL.
- Vì chưa có secure credential reference riêng cho RTSP, authenticated RTSP chưa được bật giả.
- Playback, buffering và error cập nhật video runtime thật.

## VPN Profile Behavior

- `4G / VPN` chỉ preconfigure network metadata; transport vẫn là WS/WSS/TCP.
- Tailscale/WireGuard/system VPN phải được bật bên ngoài app, sau đó nhập VPN IP hoặc hostname bình thường.
- Không tồn tại “4G protocol” hoặc VPN MAVLink parser riêng.

## MAVLink Signing Implementation

- Policy: Disabled, Sign outgoing, Require valid signatures.
- MAVLink 2 incompat flag được đặt trước CRC; signature gồm link ID, timestamp 48-bit và 6-byte SHA-256 truncation.
- Timestamp 10 microsecond từ MAVLink epoch, monotonic.
- Incoming validation kiểm tra key, source stream, timestamp và replay.
- Strict mode bỏ unsigned/invalid frames; diagnostics đếm valid/invalid/unsigned/replay.
- UI vô hiệu signing khi cấu hình MAVLink 1.

## Secure Key Storage

- Chỉ `expo-secure-store` giữ key 32 byte.
- UI dùng masked input và xóa input sau khi lưu.
- Redux, AsyncStorage, saved connection profiles, diagnostics và logs không chứa key.
- Migration persistence loại bỏ credential RTSP plaintext cũ.

## Diagnostics Integration

MAVLink Inspector/diagnostics hiển thị selected transport, endpoint/detail riêng theo transport, RX/TX pps/bytes, SYSID/COMPID, heartbeat age, CRC, MAVLink version, signatures và reconnect count. Packet inspector vẫn read-only và danh sách không còn tự đảo liên tục.

## Verification Results

- `npm run typecheck`: PASS.
- `npm test`: PASS, 62/62.
- Reconnect/listener cleanup ×10: PASS.
- Stream fragmentation/multiple frames/CRC resync: PASS.
- Signing correct/wrong/replay/strict unsigned: PASS.
- Connection/profile/host/port/WS/WSS/RTSP validation: PASS.
- `npx expo export --platform android`: PASS.
- `gradlew :app:compileDebugKotlin`: PASS.
- `gradlew :app:assembleRelease`: PASS, gồm `lintVitalRelease`.
- Android real-device UDP/TCP/USB/WSS/RTSP/VPN: NOT TESTED.
- iOS real-device tests: NOT TESTED; project hiện không có thư mục native iOS để build cục bộ trên Windows.

## Remaining Limitations

1. Cần SITL/bench test từng transport với HEARTBEAT, telemetry, command và COMMAND_ACK; không lắp cánh quạt.
2. Cần Android real-device USB OTG permission/read/write/unplug test với đúng chipset Pixhawk/radio.
3. Cần endpoint WSS chứng chỉ CA hợp lệ và VPN IP thật để integration test.
4. Cần camera/MediaMTX RTSP thật để kiểm chứng codec, latency và resource cleanup.
5. Cần Mac + iPhone để kiểm chứng iOS UDP/TCP/WS/WSS/WebRTC/RTSP/VPN.
6. RTSP authentication còn tắt cho tới khi credential reference được lưu trong SecureStore.
7. `@noble/hashes` tạo cảnh báo Metro về subpath export nhưng bundle và release build vẫn pass; nên theo dõi khi nâng dependency/Expo.
8. `npm install` báo dependency audit findings; không chạy auto-fix cưỡng bức vì có thể phá React Native native stack.
9. APK test hiện ký bằng debug key; cần production keystore trước khi phát hành.

## Safe Bench Test Order

1. Unit tests.
2. ArduPilot/PX4 SITL qua WS, UDP và TCP.
3. Pixhawk bench, tháo cánh quạt, kiểm tra heartbeat/telemetry/ACK.
4. USB OTG/radio bench, thử rút cáp và reconnect.
5. Signing với key test trên SITL/bench.
6. Chỉ sau đó mới thử bay có kiểm soát.
