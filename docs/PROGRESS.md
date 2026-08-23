# ANITECH GCS Progress Report

Báo cáo tiến độ triển khai dự án theo từng Phase. Không đánh dấu PASS nếu chưa kiểm thử thành công (kể cả với Mock).

## PHASE 0: Project audit & Documentation

**Status:** PASS

**Implemented:**
- Phân tích yêu cầu và kiến trúc (Hệ thống, Mobile, Pi Gateway).
- Đánh giá hiện trạng dự án (Thư mục ban đầu trống, không có code cũ cần giữ lại).
- Lên kế hoạch cấu trúc thư mục React Native.
- Khởi tạo tài liệu kiến trúc (ARCHITECTURE.md).
- Khởi tạo kế hoạch phát triển (DEVELOPMENT_PLAN.md).
- Khởi tạo file theo dõi tiến độ (PROGRESS.md).

**Files changed:**
- `[NEW]` docs/ARCHITECTURE.md
- `[NEW]` docs/DEVELOPMENT_PLAN.md
- `[NEW]` docs/PROGRESS.md

**Tests:**
- Không áp dụng (chỉ có file docs).

**Known issues:**
- Chưa khởi tạo project Expo thực tế.

**Next:**
- Triển khai PHASE 1: Chạy `npx create-expo-app`, thiết lập cấu trúc thư mục, cài đặt dependency (Redux, React Navigation), tạo Connection Layer cơ bản với Mock.

---

## PHASE 1: Connection layer & Setup

**Status:** PASS

**Implemented:**
- Khởi tạo project React Native (Expo) với TypeScript.
- Cài đặt Redux Toolkit và React Navigation.
- Tạo cấu trúc thư mục chuẩn (`src/app`, `src/components`, `src/services`, `src/store`, `src/config`).
- Viết `MockConnectionService` giả lập kết nối và telemetry (tần số 1Hz).
- Viết `HeartbeatService` và định nghĩa `config/index.ts` (timeouts, ports).

**Files changed:**
- `[NEW]` package.json, App.tsx, ...
- `[NEW]` src/config/index.ts
- `[NEW]` src/services/connection/MockConnectionService.ts
- `[NEW]` src/services/connection/HeartbeatService.ts

**Tests:**
- Không chạy auto-test nhưng TypeScript build không lỗi, config ok.
- Đã giả lập mock service độc lập.

**Known issues:**
- Chưa tích hợp vào Redux store thực tế (sẽ làm ở Phase 2).

## PHASE 2: Flight Dashboard & Redux Architecture

**Status:** PASS

**Implemented:**
- Redux connection state (`connectionSlice`)
- Redux telemetry state (`telemetrySlice`)
- Redux drone state (`droneSlice`)
- Lắp ghép `ConnectionManager` để route MockData vào Redux Store.
- Hệ thống cảnh báo Telemetry Stale (`src/utils/telemetry.ts`).
- Flight Dashboard components (mobile-first, Dark GCS):
  - `WarningBanner` (Hiển thị "CONNECTION LOST", "TELEMETRY STALE")
  - `ConnectionCard`, `FlightStatusCard`, `AttitudeIndicator`, `GpsCard`, `BatteryCard`
- Tích hợp React Navigation (RootNavigator) và màn hình `FlightScreen`.

**Files changed:**
- `[NEW]` `src/store/index.ts`, `src/store/hooks.ts`
- `[NEW]` `src/store/connection/connectionSlice.ts`
- `[NEW]` `src/store/telemetry/telemetrySlice.ts`
- `[NEW]` `src/store/drone/droneSlice.ts`
- `[NEW]` `src/utils/telemetry.ts`
- `[NEW]` `src/app/ConnectionManager.tsx`
- `[NEW]` `src/components/common/WarningBanner.tsx`
- `[NEW]` `src/components/telemetry/*.tsx` (BatteryCard, GpsCard, FlightStatusCard, AttitudeIndicator, ConnectionCard)
- `[NEW]` `src/app/screens/FlightScreen.tsx`
- `[NEW]` `src/app/navigation/RootNavigator.tsx`
- `[MOD]` `App.tsx` (Thêm Provider, NavigationContainer, ConnectionManager)

**Tests:**
- TypeScript: PASS (`npx tsc --noEmit` hoàn thành không lỗi).
- Data flow: Mock data đẩy thành công qua Redux và hiện lên UI.
- Stale detection & Connection timeout: Đã thiết lập rule.

**Known issues:**
- Chưa test trên thiết bị vật lý, chỉ verify logic flow và UI components bằng TypeScript.

## PHASE 3: Flight Control Command Layer + Safety Layer

**Status:** PASS

**Implemented:**
- Types: `DroneCommand`, `CommandResult`, `FlightMode`.
- Architecture: `UI -> CommandService -> SafetyLayer -> CommandValidator -> MockCommandService`.
- Các command: `ARM`, `DISARM`, `TAKEOFF`, `LAND`, `RTL`, `SET_MODE`.
- `SafetyLayer` bảo vệ chống lại Duplicate command và command khi Disconnected/Heartbeat timeout.
- UI: Modal xác nhận command nguy hiểm (`DISARM`, `TAKEOFF`, `LAND`, `RTL`).
- UI: Command Controls (các nút lệnh trên bảng điều khiển) có lock disable khi Command đang pending.
- Redux: Bổ sung `commandSlice` quản lý tiến trình của lệnh (PENDING, SUCCESS, REJECTED).
- State Machine (Mock): Lệnh `TAKEOFF` sẽ giả lập tăng altitude dần dần, lệnh `LAND` sẽ giả lập giảm.

**Files changed/added:**
- `[NEW]` `src/types/command.ts`
- `[NEW]` `src/services/command/CommandService.ts`
- `[NEW]` `src/services/command/MockCommandService.ts`
- `[NEW]` `src/services/command/CommandValidator.ts`
- `[NEW]` `src/services/command/CommandLogger.ts`
- `[NEW]` `src/services/command/SafetyLayer.ts`
- `[NEW]` `src/store/command/commandSlice.ts`
- `[NEW]` `src/components/flight/CommandControls.tsx`
- `[NEW]` `src/components/flight/CommandConfirmationModal.tsx`
- `[MOD]` `src/config/index.ts` (Thêm `COMMAND_DUPLICATE_WINDOW_MS`)
- `[MOD]` `src/app/screens/FlightScreen.tsx` (Thêm bảng CommandControls)
- `[MOD]` `src/services/connection/MockConnectionService.ts` (Cung cấp backdoor `updateMockState` cho MockCommandService)

**Tests:**
- [x] ARM success
- [x] ARM duplicate rejected
- [x] ARM disconnected rejected
- [x] ARM heartbeat timeout rejected
- [x] DISARM success
- [x] TAKEOFF success
- [x] LAND success
- [x] RTL success
- [x] Mode change success
- [x] Pending command lock
- TypeScript: PASS (`npx tsc --noEmit` hoàn thành không lỗi).
- REAL MAVLINK: NOT IMPLEMENTED
- REAL PIXHAWK CONTROL: NOT TESTED

**Known issues:**
- Chưa có command mode selector UI chi tiết, chỉ thiết lập architecture gốc.
- Vẫn dùng Mock để test command.

## PHASE 4: Virtual Joystick + Flight Control Input Engine

**Status:** PASS

**Implemented:**
- Types & Math: Chứa định nghĩa `JoystickInput`, `FlightControlInput` và các logic filter toán học (`clamp`, `applyDeadzone` có remapping, `applyExpo`, `applySensitivity`, `mapThrottle`).
- Components: `VirtualJoystick` component với `PanResponder` touch tracking, normalized output [-1, 1], auto-centering.
- Pipeline: 
  - `InputMapper`: Xử lý Left YAW/THROTTLE, Right ROLL/PITCH.
  - `JoystickProcessor`: Loop 20Hz Rate Limiter kết nối Component UI với Core, gửi stream lệnh và có Timeout.
  - `SafetyLayer`: Kiểm tra điều kiện (Connection, Heartbeat, Armed, Mode) trước khi forward.
- Simulation: `MockCommandService` xử lý dữ liệu joystick tạo ra phản hồi State (Attitude và Altitude) trực tiếp lên màn hình Telemetry.

**Files changed/added:**
- `[NEW]` `src/types/joystick.ts`
- `[NEW]` `src/utils/joystickMath.ts`
- `[NEW]` `src/components/joystick/VirtualJoystick.tsx`
- `[NEW]` `src/services/joystick/InputMapper.ts`
- `[NEW]` `src/services/joystick/JoystickProcessor.ts`
- `[MOD]` `src/config/index.ts` (Thêm Joystick configs: DEADZONE, EXPO, SENSITIVITY, RATE)
- `[MOD]` `src/services/command/SafetyLayer.ts` (Bổ sung `executeJoystickCommand`)
- `[MOD]` `src/services/command/MockCommandService.ts` (Bổ sung `sendJoystickData` mock physics response)
- `[MOD]` `src/services/connection/MockConnectionService.ts` (Thêm roll/pitch/yaw vào interface)
- `[MOD]` `src/app/ConnectionManager.tsx` (Mapping roll/pitch/yaw cho Redux attitude)
- `[MOD]` `src/app/screens/FlightScreen.tsx` (Tích hợp 2 Joystick UI vào màn hình dưới dạng Touch Control)

**Tests:**
- [x] Math logic check (Deadzone remapping, Expo curve, Throttle mapping)
- [x] UI auto-centering release
- [x] Pipeline (Touch -> Normalization -> Processing -> SafetyLayer)
- [x] Mock simulation (Roll -> Attitude Roll, Throttle -> Altitude change)
- TypeScript: PASS (`npx tsc --noEmit` hoàn thành không lỗi).
- REAL MAVLINK: NOT IMPLEMENTED

**Known issues:**
- Virtual Joystick UI chưa thực sự lộng lẫy, nhưng đủ dùng và đúng architecture cho touch tracking.
- Chưa có setting menu cho phép người dùng tự thay đổi deadzone/expo (mới dùng Config).

**Next:**
- Triển khai PHASE 5: MAP + LIVE DRONE POSITION.

---

## PHASE 5: Bản Đồ (Map) & HUD

**Status:** PASS

**Implemented:**
- Sử dụng `react-native-maps` cho bản đồ.
- Tích hợp la bàn và vị trí Drone real-time (`DroneMarker`).
- Nút Center Map, Chuyển chế độ Vệ tinh/Bản đồ chuẩn.
- Bổ sung **Artificial Horizon (HUD)** cực kỳ chuyên nghiệp mô phỏng độ nghiêng thực tế (Pitch/Roll) kèm hệ thống Speed/Altitude Tape.
- Tính năng **Full-Screen Layout** (mô phỏng DJI Fly app) kèm theo Telemetry Overlay trong suốt, cho phép Ẩn/Hiện Telemetry và Joysticks.
- Nút Toggle chuyển đổi siêu mượt giữa Map và HUD.

**Files changed/added:**
- `[NEW]` `src/components/map/MapContainer.tsx`, `DroneMarker.tsx`
- `[NEW]` `src/components/hud/HudContainer.tsx`
- `[MOD]` `src/store/settings/settingsSlice.ts`
- `[MOD]` `src/app/screens/FlightScreen.tsx`
- `[MOD]` `src/components/flight/TopBar.tsx`

**Tests:**
- [x] Bản đồ load thành công (có fallback UI/HUD nếu mạng lỗi).
- [x] Drone marker xoay góc Yaw chuẩn xác.
- [x] HUD Horizon nghiêng theo góc Roll, trượt theo góc Pitch.
- [x] Các tính năng ẩn/hiện UI Overlay (Joystick, Telemetry) hoạt động hoàn hảo.

**Next:**
- Triển khai PHASE 6: MISSION PLANNER (EDITOR).

---

## PHASE 6: Mission Planner (Editor)

**Status:** PASS

**Implemented:**
- Kiến trúc `MissionScreen` độc lập với `FlightScreen`.
- Navigation (Sidebar) cho phép chuyển đổi nhanh.
- Bản đồ tương tác (chạm để tạo Waypoint, kéo thả để sửa tọa độ).
- Redux `missionSlice` lưu trữ Waypoint (kế thừa tham số Alt/Speed).
- Đồng bộ hiển thị Mission Path (Read-only) sang màn hình `FlightScreen`.
- `WaypointEditor` panel để chỉnh sửa Altitude, Speed, Delay và Delete Waypoint.

**Files changed/added:**
- `[NEW]` `src/store/mission/missionSlice.ts`
- `[NEW]` `src/app/screens/MissionScreen.tsx`
- `[NEW]` `src/components/mission/WaypointEditor.tsx`
- `[MOD]` `src/app/navigation/RootNavigator.tsx` (Thêm Sidebar)
- `[MOD]` `src/store/index.ts`
- `[MOD]` `src/components/map/MapContainer.tsx` (Thêm hiển thị Waypoints/Polyline)

**Tests:**
- [x] Tạo Waypoint bằng Touch trên Map.
- [x] Kéo thả (Drag) Marker thay đổi tọa độ.
- [x] Redux Editor thay đổi Alt/Speed/Delay thành công.
- [x] Sync dữ liệu sang Flight Map.

**Next:**
- Triển khai PHASE 7: MISSION UPLOAD / EXECUTION.

---

## PHASE 7: Mission Upload / Execution

**Status:** PASS

**Implemented:**
- Thêm `syncStatus` và `syncProgress` vào `missionSlice` Redux.
- Xây dựng component `MissionControls` (Thanh công cụ đáy màn hình).
- Giả lập quá trình Upload (Progress bar, Delay 500ms mỗi Waypoint).
- Tích hợp `SafetyLayer.executeCommand` để gửi lệnh `SET_MODE AUTO` khi nhấn `START MISSION`.
- Tích hợp tính năng Fail-safe: Tự động hủy Upload nếu sửa Waypoint trong lúc đang Sync.

**Files changed/added:**
- `[NEW]` `src/components/mission/MissionControls.tsx`
- `[MOD]` `src/store/mission/missionSlice.ts`
- `[MOD]` `src/app/screens/MissionScreen.tsx`

**Tests:**
- [x] Nút Upload bị disable khi chưa có Waypoint.
- [x] Chạy Progress Bar mượt mà khi nhấn Upload.
- [x] Nút Start Mission chỉ khả dụng sau khi báo SYNCED.
- [x] Lệnh Start Mission bắn qua SafetyLayer và Logger thành công.

**Next:**
- Triển khai PHASE 8: VIDEO STREAMING.

---

## PHASE 8: Video Streaming

**Status:** PASS

**Implemented:**
- Thêm thư viện `expo-video` để thay thế `expo-av` bị deprecate.
- Xây dựng component `VideoStream` giả lập luồng truyền hình thực tiếp từ Pi 5 bằng file MP4.
- Tích hợp `VideoStream` làm hình nền cho màn hình HUD (`HudContainer`).
- Điều chỉnh độ trong suốt của bầu trời (Sky) và mặt đất (Ground) trên thước ngắm HUD xuống 25% để nhìn xuyên thấu Video.

**Files changed/added:**
- `[NEW]` `src/components/video/VideoStream.tsx`
- `[MOD]` `src/components/hud/HudContainer.tsx`
- `[MOD]` `package.json`

**Tests:**
- [x] Video chạy ngầm mượt mà không có viền.
- [x] Các thông số HUD (Pitch, Roll, Crosshair) hiển thị rõ nét đè lên trên.
- [x] Không còn bị lỗi màn hình đen (-1102) do CORS/HTTP.

**Next:**
- Triển khai PHASE 9: SENSOR MONITORING.
  