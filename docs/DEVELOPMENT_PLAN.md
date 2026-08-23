# ============================================================
# ANITECH GCS
# MASTER DEVELOPMENT PLAN
# PHASE 5 → PHASE 9
# ============================================================

PROJECT:
ANITECH GCS

MỤC TIÊU CUỐI CÙNG:

Xây dựng một Mobile Ground Control Station cho drone,
lấy tư duy từ Mission Planner / QGroundControl nhưng
tối ưu cho điện thoại landscape và bổ sung:

- Virtual Joystick
- Manual Flight Control
- Mission Planner
- Real-time Telemetry
- Real MAVLink
- Raspberry Pi 5 Gateway
- Pixhawk / ArduPilot
- Map
- Flight Path
- Mission Upload
- Mission Download
- Camera / Video
- Precision Landing framework
- Safety / Failsafe
- Flight Logging

============================================================
CURRENT STATUS
============================================================

PHASE 1 = PASS
Connection Layer & Setup

PHASE 2 = PASS
Redux + Flight Dashboard

PHASE 3 = PASS
Flight Control Command Layer + Safety Layer

PHASE 4 = PASS
Virtual Joystick + Input Engine

HIỆN TẠI:
Mock Drone đang hoạt động.
MockConnectionService đang tạo telemetry.
MockCommandService đang xử lý command.
JoystickProcessor đang xử lý manual input.
SafetyLayer đang bảo vệ command.

============================================================
IMPORTANT CURRENT UI REQUIREMENT
============================================================

Flight UI:
LANDSCAPE-FIRST
Không thiết kế primary UI dạng portrait.

Mục tiêu:
MOBILE DRONE COCKPIT

Bố cục:
LEFT / CENTER:
MAP

BOTTOM:
LEFT JOYSTICK
RIGHT JOYSTICK

RIGHT:
TELEMETRY + COMMANDS

HEADER:
CONNECTION
MODE
ARM
GPS
BATTERY

Người dùng cầm điện thoại ngang bằng hai tay.

Ngón cái trái:
THROTTLE / YAW

Ngón cái phải:
PITCH / ROLL

Mắt:
MAP + TELEMETRY

============================================================
GLOBAL ARCHITECTURE
============================================================

UI
 ↓
Redux / State
 ↓
Application Services
 ↓
Safety Layer
 ↓
Command Gateway
 ↓
Transport Layer
 ↓
Raspberry Pi 5
 ↓
MAVLink
 ↓
Pixhawk / ArduPilot
 ↓
Drone

Telemetry:
Pixhawk
 ↓
MAVLink
 ↓
Raspberry Pi 5
 ↓
Gateway
 ↓
Mobile App
 ↓
Redux
 ↓
UI

Camera:
Camera
 ↓
Raspberry Pi 5
 ↓
Video Encoder
 ↓
Network
 ↓
Mobile App

============================================================
GLOBAL RULES
============================================================

1. Không phá Phase 1–4.
2. Không duplicate Redux state.
3. Không bypass SafetyLayer.
4. Không để UI gửi MAVLink trực tiếp.
5. UI không biết MAVLink packet structure.
6. UI không biết serial protocol.
7. UI không biết Pixhawk UART.
8. Pi Gateway chịu trách nhiệm MAVLink.
9. Transport Layer tách khỏi MAVLink.
10. Mock và Real implementation phải dùng cùng interface.

Ví dụ:
IConnectionService
IMavlinkService
ICommandService
ITelemetryService
IVideoService

============================================================
MOCK / REAL STRATEGY
============================================================

Mọi service quan trọng phải có:
Mock implementation
và:
Real implementation

Ví dụ:
MockConnectionService
RealConnectionService

MockCommandService
MavlinkCommandService

MockTelemetryService
MavlinkTelemetryService

UI không được biết đang dùng Mock hay Real.

Config quyết định:
MODE = MOCK
hoặc:
MODE = REAL

============================================================
PHASE 5
============================================================

# LIVE MAP + DRONE POSITION + FLIGHT PATH

============================================================

MỤC TIÊU:
Biến Map Placeholder thành Live Map.

Map phải hiển thị:
- Drone
- Home
- GPS
- Heading
- Flight Path
- Altitude
- Speed
- Follow
- Center
- Zoom

============================================================
PHASE 5.1 MAP
============================================================
Sử dụng map library tương thích Expo hiện tại.
Ưu tiên:
react-native-maps
Nhưng trước khi cài:
kiểm tra Expo SDK compatibility.
Không cài dependency mù quáng.

============================================================
PHASE 5.2 DRONE MARKER
============================================================
Drone marker:
- latitude
- longitude
- yaw
- heading
- armed state

Marker xoay theo:
Yaw

Ví dụ:
0° North
90° East
180° South
270° West

============================================================
PHASE 5.3 HOME
============================================================
Hiển thị:
HOME
Home lấy từ telemetry/navigation state.
Không tự tạo Home giả khi chưa có Home.

============================================================
PHASE 5.4 FLIGHT PATH
============================================================
Lưu:
latitude
longitude
timestamp

Có:
MAX_FLIGHT_PATH_POINTS
Không lưu vô hạn.

Có sampling:
FLIGHT_PATH_SAMPLE_INTERVAL
hoặc:
FLIGHT_PATH_MIN_DISTANCE

============================================================
PHASE 5.5 FOLLOW
============================================================
Button:
FOLLOW

Khi ON:
camera follow drone.

User pan:
FOLLOW tự OFF.
Không để camera jump.

============================================================
PHASE 5.6 CENTER
============================================================
CENTER DRONE
CENTER HOME
Camera animation phải được throttle.

============================================================
PHASE 5.7 GPS STATUS
============================================================
Hiển thị:
FIX
SAT
HDOP

Trạng thái:
NO FIX
FIX
STALE

============================================================
PHASE 5.8 TELEMETRY OVERLAY
============================================================
Map có thể hiển thị:
ALT
SPD
HEADING
nhưng không duplicate toàn bộ telemetry panel.

============================================================
PHASE 5.9 ERROR
============================================================
Nếu map fail:
MAP UNAVAILABLE
App không crash.
Telemetry vẫn hoạt động.

============================================================
PHASE 5.10 TEST
============================================================
Test:
[ ] Map
[ ] Drone marker
[ ] Home
[ ] Heading
[ ] Flight path
[ ] Follow
[ ] Center drone
[ ] Center home
[ ] GPS
[ ] Stale
[ ] Connection lost
[ ] Mock movement
[ ] No memory leak
[ ] No excessive rerender

============================================================
PHASE 5 DEFINITION OF DONE
============================================================
PASS khi:
Map hoạt động.
Drone marker realtime.
Home hoạt động.
Flight path hoạt động.
Follow hoạt động.
Center hoạt động.
GPS status hoạt động.
Mock test PASS.
TypeScript PASS.
Lint PASS.
Tests PASS.

============================================================
STOP
============================================================
Không bắt đầu Phase 6 nếu Phase 5 chưa PASS.

============================================================
PHASE 6
============================================================
# MISSION PLANNER
============================================================

MỤC TIÊU:
Xây dựng Mission Planner tương tự tư duy Mission Planner/QGroundControl.

User có thể:
- tạo waypoint
- sửa waypoint
- xóa waypoint
- kéo waypoint
- đặt altitude
- đặt speed
- đặt yaw
- chọn action
- reorder waypoint
- preview mission
- validate mission
- save mission
- load mission

============================================================
PHASE 6.1 MISSION DATA MODEL
============================================================
Tạo:
Mission
Waypoint
MissionItem
MissionAction

Ví dụ:
Waypoint:
id
latitude
longitude
altitude
speed
yaw
holdTime

============================================================
PHASE 6.2 WAYPOINT CREATION
============================================================
User:
Tap Map
→ tạo waypoint.

Hiển thị:
WP1
WP2
WP3

Đường nối:
HOME
 ↓
WP1
 ↓
WP2
 ↓
WP3

============================================================
PHASE 6.3 WAYPOINT EDIT
============================================================
Tap waypoint:
mở editor.

Cho phép chỉnh:
Latitude
Longitude
Altitude
Speed
Yaw
Hold Time

============================================================
PHASE 6.4 DRAG WAYPOINT
============================================================
User có thể:
drag waypoint.
Mission path update realtime.

============================================================
PHASE 6.5 WAYPOINT ACTION
============================================================
Hỗ trợ framework:
TAKEOFF
WAYPOINT
LOITER
LAND
RTL
Không gửi command thật trong Phase 6.

============================================================
PHASE 6.6 MISSION VALIDATOR
============================================================
Validate:
- Home tồn tại
- GPS hợp lệ
- waypoint hợp lệ
- altitude hợp lệ
- speed hợp lệ
- mission order hợp lệ
- duplicate waypoint
- invalid coordinates

Nếu lỗi:
MISSION INVALID
Hiển thị lý do.

============================================================
PHASE 6.7 MISSION PREVIEW
============================================================
Hiển thị:
Total distance
Estimated time
Waypoint count
Max altitude
Max speed
Mission path

============================================================
PHASE 6.8 SAVE / LOAD
============================================================
Cho phép:
Save Mission
Load Mission
Export JSON
Import JSON
Chưa upload Pixhawk.

============================================================
PHASE 6.9 MISSION UI
============================================================
Landscape:
MAP lớn bên trái.
MISSION PANEL bên phải.

Ví dụ:
MAP
│
├── HOME
├── WP1
├── WP2
└── WP3

Right:
MISSION

WP1
ALT 20m
SPD 5m/s

WP2
ALT 30m
SPD 6m/s

[ADD]
[EDIT]
[DELETE]
[SAVE]

============================================================
PHASE 6.10 TEST
============================================================
[ ] Create waypoint
[ ] Edit
[ ] Delete
[ ] Drag
[ ] Reorder
[ ] Altitude
[ ] Speed
[ ] Yaw
[ ] Hold
[ ] Actions
[ ] Validate
[ ] Save
[ ] Load
[ ] Import
[ ] Export
[ ] Preview

============================================================
PHASE 6 DEFINITION OF DONE
============================================================
Mission Planner hoạt động hoàn chỉnh trên Mock.
Không gửi MAVLink thật.
TypeScript PASS.
Tests PASS.
UI PASS.

============================================================
STOP
============================================================
Không upload mission thật nếu Phase 6 chưa PASS.

============================================================
PHASE 7
============================================================
# RASPBERRY PI 5 + REAL MAVLINK GATEWAY
============================================================

MỤC TIÊU:
Kết nối:
Mobile App
 ↓
Network
 ↓
Raspberry Pi 5
 ↓
MAVLink
 ↓
Pixhawk
 ↓
ArduPilot

============================================================
PHASE 7 ARCHITECTURE
============================================================
Mobile:
ANITECH GCS
↓
Network Transport
↓
Pi 5 Gateway
↓
MAVLink Router / MAVLink Service
↓
Pixhawk

============================================================
PHASE 7.1 TRANSPORT
============================================================
Thiết kế transport abstraction:
ITransport

Có thể hỗ trợ:
WebSocket
TCP
UDP

Ưu tiên transport ổn định và dễ debug cho mobile.
Không để UI biết transport protocol.

============================================================
PHASE 7.2 PI GATEWAY
============================================================
Tạo một gateway service chạy trên Raspberry Pi 5.
Gateway chịu trách nhiệm:
- MAVLink connection
- telemetry forwarding
- command forwarding
- heartbeat
- connection state
- system discovery
- logging

============================================================
PHASE 7.3 MAVLINK
============================================================
Gateway phải hỗ trợ các nhóm MAVLink:
HEARTBEAT
SYS_STATUS
GPS_RAW_INT
GLOBAL_POSITION_INT
ATTITUDE
VFR_HUD
BATTERY_STATUS
RC_CHANNELS
COMMAND_ACK
STATUSTEXT
HOME_POSITION
MISSION messages

Không hard-code MAVLink logic vào React Native.

============================================================
PHASE 7.4 VEHICLE DISCOVERY
============================================================
App phải biết:
System ID
Component ID
Vehicle type
Autopilot
Firmware

Ví dụ:
ARDUPILOT
COPTER

============================================================
PHASE 7.5 REAL TELEMETRY
============================================================
Real telemetry phải map về cùng Redux model đang dùng Mock.

Ví dụ:
MAVLink
 ↓
MavlinkTelemetryAdapter
 ↓
TelemetryModel
 ↓
Redux

UI không thay đổi.

============================================================
PHASE 7.6 COMMAND
============================================================
Flow:
UI
 ↓
SafetyLayer
 ↓
CommandValidator
 ↓
MavlinkCommandService
 ↓
Pi
 ↓
MAVLink
 ↓
Pixhawk

Không được:
UI → MAVLink trực tiếp.

============================================================
PHASE 7.7 COMMAND ACK
============================================================
Theo dõi:
PENDING
SUCCESS
REJECTED
TIMEOUT

Dựa trên:
COMMAND_ACK
Không giả lập SUCCESS khi dùng Real Mode.

============================================================
PHASE 7.8 HEARTBEAT
============================================================
Heartbeat thật phải cập nhật:
Connection State

Nếu timeout:
CONNECTION LOST
Command bị khóa.
Joystick về Neutral.

============================================================
PHASE 7.9 CONFIG
============================================================
Không hard-code IP.
Config:
PI_HOST
PI_PORT
TRANSPORT
TIMEOUT
HEARTBEAT_TIMEOUT

Có UI:
Connection Settings

============================================================
PHASE 7.10 DEBUG
============================================================
Tạo:
Connection Diagnostics

Hiển thị:
PING
LATENCY
HEARTBEAT
PACKET RATE
RX
TX
LINK QUALITY

============================================================
PHASE 7.11 LOGGING
============================================================
Pi log:
connection
MAVLink
commands
errors

Mobile log:
connection state
command state
telemetry stale
Không log sensitive data không cần thiết.

============================================================
PHASE 7.12 MOCK / REAL SWITCH
============================================================
Phải có:
MOCK MODE
REAL MODE
Mock không được phá.

============================================================
PHASE 7.13 TEST
============================================================
Test trước bằng:
SITL / simulated vehicle
Không bắt đầu bằng flight thật.

Test:
[ ] Pi connection
[ ] MAVLink heartbeat
[ ] Telemetry
[ ] GPS
[ ] Attitude
[ ] Battery
[ ] Command ACK
[ ] Connection lost
[ ] Reconnect
[ ] Latency
[ ] Packet loss
[ ] Mock fallback

============================================================
PHASE 7 DEFINITION OF DONE
============================================================
PASS khi:
Mobile ↔ Pi 5 ↔ MAVLink
hoạt động ổn định với simulated vehicle.
Không cần cất cánh drone thật.

============================================================
STOP
============================================================
Không flight test thật ngay.

============================================================
PHASE 8
============================================================
# REAL FLIGHT CONTROL + MISSION EXECUTION + SAFETY
============================================================

MỤC TIÊU:
Đưa ANITECH GCS từ:
Telemetry viewer
thành:
REAL FLIGHT GROUND CONTROL STATION
nhưng ưu tiên safety.

============================================================
PHASE 8.1 REAL COMMANDS
============================================================
Hỗ trợ:
ARM
DISARM
TAKEOFF
LAND
RTL
SET MODE
Thông qua:
SafetyLayer
và:
MAVLinkCommandService

============================================================
PHASE 8.2 FLIGHT MODE
============================================================
Hiển thị:
STABILIZE
ALT_HOLD
LOITER
AUTO
RTL
LAND
Không cho UI hiển thị trạng thái sai với vehicle thật.

============================================================
PHASE 8.3 MANUAL JOYSTICK
============================================================
Flow:
Joystick
 ↓
JoystickProcessor
 ↓
SafetyLayer
 ↓
ManualControlService
 ↓
MAVLink
 ↓
Pixhawk
Không gửi raw touch.

============================================================
PHASE 8.4 MANUAL CONTROL
============================================================
Joystick phải có:
Neutral
Timeout
Auto-center
Rate limit
Connection check
Heartbeat check
Mode validation
Armed check

============================================================
PHASE 8.5 CONNECTION LOSS
============================================================
Nếu mất connection:
Joystick → Neutral
Command → Block
UI → CONNECTION LOST
Không được tiếp tục gửi manual command.

============================================================
PHASE 8.6 HEARTBEAT LOSS
============================================================
Heartbeat timeout:
manual control STOP
command STOP
warning.
Không giả định drone đang an toàn.

============================================================
PHASE 8.7 BATTERY SAFETY
============================================================
Hiển thị:
Battery percentage
Voltage
Current
Warning levels configurable.
Không hard-code logic vào UI.

============================================================
PHASE 8.8 GPS SAFETY
============================================================
Theo dõi:
GPS Fix
Satellites
HDOP
Nếu GPS không đủ điều kiện:
cảnh báo.
Các mode phụ thuộc GPS phải được UI phản ánh chính xác.

============================================================
PHASE 8.9 GEOFENCE
============================================================
Framework:
Geofence

Có:
max radius
max altitude
min altitude

Nếu mission vượt giới hạn:
MISSION INVALID
Không upload mission invalid.

============================================================
PHASE 8.10 MISSION UPLOAD
============================================================
Sau khi mission validator PASS:
Mission
↓
MAVLink Mission Protocol
↓
Pixhawk

Theo dõi:
UPLOAD START
UPLOAD PROGRESS
UPLOAD SUCCESS
UPLOAD FAILED

============================================================
PHASE 8.11 MISSION DOWNLOAD
============================================================
Pixhawk
↓
MAVLink
↓
Pi
↓
Mobile

Mission Planner hiển thị mission hiện tại.

============================================================
PHASE 8.12 MISSION ACK
============================================================
Không giả lập success.
Phải xác nhận:
Mission accepted

============================================================
PHASE 8.13 FLIGHT LOG
============================================================
Mobile/Pi lưu:
timestamp
mode
armed
GPS
position
altitude
speed
battery
commands
warnings
connection state

Có:
Flight Log

============================================================
PHASE 8.14 FLIGHT DATA
============================================================
Có thể xem:
Track
Altitude graph
Speed graph
Battery graph
GPS status
Command events

============================================================
PHASE 8.15 PRE-FLIGHT CHECK
============================================================
Trước khi ARM:
Preflight checklist.

Ví dụ:
Connection
Heartbeat
GPS
Battery
Mode
Telemetry
RC
Vehicle status

Không tự ARM.
User phải xác nhận.

============================================================
PHASE 8.16 SAFETY UI
============================================================
Flight screen phải luôn hiển thị:
CONNECTION
HEARTBEAT
MODE
ARM
BATTERY
GPS
Không để các thông tin này bị hidden.

============================================================
PHASE 8.17 SIMULATION FIRST
============================================================
BẮT BUỘC:
SITL / simulator trước.

Test:
ARM
TAKEOFF
LOITER
LAND
RTL
MISSION
JOYSTICK
FAILSAFE
Không bắt đầu bằng drone thật.

============================================================
PHASE 8 DEFINITION OF DONE
============================================================
PASS khi:
Real telemetry PASS
Real commands PASS trong simulator
Joystick PASS trong simulator
Mission upload/download PASS
Safety PASS
Connection loss PASS
Heartbeat loss PASS
Battery warning PASS
GPS warning PASS
Flight logging PASS

============================================================
PHASE 9
============================================================
# CAMERA + VIDEO + PRECISION LANDING + PRODUCTION GCS
============================================================

MỤC TIÊU:
Tích hợp Raspberry Pi 5 camera/video vào GCS.

Kiến trúc:
Camera
 ↓
Raspberry Pi 5
 ↓
Video Pipeline
 ↓
Network
 ↓
ANITECH GCS

============================================================
PHASE 9.1 VIDEO
============================================================
Tạo:
VideoService
VideoScreen
VideoOverlay
Không để video logic nằm trong FlightScreen.

============================================================
PHASE 9.2 STREAM
============================================================
Ưu tiên:
low latency
stable frame rate
adaptive quality
Không ưu tiên bitrate cao hơn latency.

============================================================
PHASE 9.3 VIDEO STATES
============================================================
Hiển thị:
CONNECTING
LIVE
BUFFERING
DISCONNECTED
ERROR

============================================================
PHASE 9.4 VIDEO OVERLAY
============================================================
Overlay:
FPS
Latency
Resolution
Connection

Có thể hiển thị:
ALT
MODE
ARM
GPS
nhưng không che vùng nhìn quan trọng.

============================================================
PHASE 9.5 CAMERA CONTROL
============================================================
Nếu camera/gimbal hỗ trợ:
pan
tilt
zoom

Thiết kế:
CameraControlService
Không gửi camera command trực tiếp từ UI.

============================================================
PHASE 9.6 LANDING TARGET
============================================================
Chuẩn bị architecture cho:
Landing Target Detection

Có thể hỗ trợ:
AprilTag
ArUco
QR

Detection chạy trên:
Raspberry Pi 5
không chạy heavy computer vision trực tiếp trong React Native.

============================================================
PHASE 9.7 TARGET DATA
============================================================
Pi gửi:
target detected
target center x
target center y
target size
confidence
timestamp

Mobile chỉ visualization.

============================================================
PHASE 9.8 PRECISION LANDING FRAMEWORK
============================================================
Architecture:
Camera
 ↓
Vision Detector
 ↓
Landing Target Service
 ↓
Safety Validator
 ↓
Flight Control

Không cho vision tự ý điều khiển drone.

Phải có:
ENABLE
DISABLE
TARGET LOST
CONFIDENCE LOW
ABORT

============================================================
PHASE 9.9 TARGET LOST
============================================================
Nếu target mất:
Vision state:
TARGET LOST
Không tiếp tục sử dụng stale detection.
Có timeout.

============================================================
PHASE 9.10 LANDING SAFETY
============================================================
Precision landing phải có:
Target confidence threshold
Target timeout
Altitude limit
Horizontal error limit
Abort condition
Manual override

Không tự động land chỉ vì:
"đã thấy tag".

============================================================
PHASE 9.11 VIDEO + MAP
============================================================
Flight UI có thể chuyển:
MAP VIEW
VIDEO VIEW
SPLIT VIEW

Ví dụ:
┌──────────────────────────────┬───────────────┐
│                              │               │
│          VIDEO               │   TELEMETRY   │
│                              │               │
│                              │               │
├──────────────────────────────┤               │
│          MAP                 │   COMMANDS    │
└──────────────────────────────┴───────────────┘

============================================================
PHASE 9.12 RECORDING
============================================================
Nếu cần:
Start Recording
Stop Recording

Lưu:
video
timestamp
flight log
Không làm recording gây lag control.

============================================================
PHASE 9.13 PRODUCTION DIAGNOSTICS
============================================================
Dashboard:
Connection
MAVLink
GPS
Battery
Video
Pi
Camera
Heartbeat
Latency
Packet loss

============================================================
PHASE 9.14 CRASH RECOVERY
============================================================
Nếu:
App crash
Pi restart
Network reconnect
Camera restart
phải có recovery strategy.
Không làm drone command tự động tiếp tục khi app reconnect.

============================================================
PHASE 9.15 SECURITY
============================================================
Network communication nên có:
authentication
session
device identification
Không để bất kỳ thiết bị trong mạng LAN tự do gửi flight commands.

============================================================
PHASE 9.16 AUDIT LOG
============================================================
Ghi:
ARM
DISARM
TAKEOFF
LAND
RTL
MODE CHANGE
MISSION UPLOAD
MISSION START
MISSION ABORT
MANUAL CONTROL ENABLE
PRECISION LANDING ENABLE
Có timestamp.

============================================================
PHASE 9 DEFINITION OF DONE
============================================================
PASS khi:
[ ] Video
[ ] Low latency stream
[ ] Video status
[ ] Camera controls
[ ] Vision framework
[ ] Target detection
[ ] Target lost handling
[ ] Precision landing safety
[ ] Manual override
[ ] Map/video switching
[ ] Diagnostics
[ ] Recovery
[ ] Security
[ ] Audit log

============================================================
GLOBAL TEST STRATEGY
============================================================
MỌI PHASE:
1. Unit Test
2. Integration Test
3. Mock Test
4. Simulator Test
5. Network Failure Test
6. Timeout Test
7. Reconnect Test
8. UI Test
9. Performance Test
10. TypeScript
11. Lint

============================================================
HARDWARE TEST ORDER
============================================================
TUYỆT ĐỐI KHÔNG:
Code xong → cắm drone → bay ngay.

Thứ tự:
STEP 1 Mock
STEP 2 Unit tests
STEP 3 Integration tests
STEP 4 SITL / simulator
STEP 5 Pixhawk bench test
STEP 6 Motors disabled / safe bench
STEP 7 Real telemetry
STEP 8 Real command validation
STEP 9 Controlled flight test
STEP 10 Mission test
STEP 11 Video test
STEP 12 Precision landing test

============================================================
GLOBAL FAILSAFE RULE
============================================================
Nếu connection mất:
Joystick → Neutral
Commands → Block
UI → Warning

Nếu heartbeat mất:
Manual control → STOP

Nếu telemetry stale:
UI → STALE

Nếu GPS invalid:
GPS-dependent operation → warning/block according to configured safety policy.

Nếu target lost:
Precision landing → ABORT / SAFE STATE
Không dùng dữ liệu stale.

============================================================
GLOBAL CODE QUALITY
============================================================
Không tạo:
God Component
God Service
God Redux Slice

Không tạo:
FlightScreen.tsx 3000 dòng.
MavlinkService.ts 3000 dòng.

Tách:
UI
State
Domain
Service
Transport
Safety
Protocol
Hardware

============================================================
DIRECTORY TARGET
============================================================
src/
├── app/
├── components/
│   ├── flight/
│   ├── joystick/
│   ├── map/
│   ├── mission/
│   ├── telemetry/
│   ├── command/
│   └── video/
├── config/
├── domain/
├── services/
├── transport/
├── safety/
├── store/
├── utils/
└── types/

============================================================
DOCUMENTATION
============================================================
Sau mỗi Phase cập nhật:
docs/PROGRESS.md
docs/ARCHITECTURE.md
docs/DEVELOPMENT_PLAN.md

============================================================
PHASE STATE
============================================================
Mỗi Phase chỉ được:
PASS
khi toàn bộ Definition of Done đạt.
Nếu chưa:
PARTIAL
Nếu bị block:
BLOCKED
Không được tự ghi PASS.

============================================================
IMPORTANT EXECUTION RULE
============================================================
Agent phải làm:
PHASE 5 → TEST → FIX → PASS
PHASE 6 → TEST → FIX → PASS
...

KHÔNG được làm tất cả cùng lúc.

============================================================
CURRENT TASK
============================================================
Đầu tiên:
1. Đọc docs/PROGRESS.md
2. Đọc docs/ARCHITECTURE.md
3. Audit Phase 1–4
4. Kiểm tra Landscape Flight Cockpit UI
5. Nếu UI refactor chưa PASS:
   FIX UI trước.
6. Sau khi UI PASS:
   bắt đầu Phase 5.

KHÔNG bắt đầu Phase 6/7/8/9
khi Phase trước chưa PASS.

============================================================
FINAL PRODUCT
============================================================
ANITECH GCS cuối cùng phải có:
┌─────────────────────────────────────────────┐
│              ANITECH GCS                    │
├─────────────────────────────┬───────────────┤
│                             │ TELEMETRY     │
│             MAP             │ GPS           │
│                             │ BATTERY       │
│             🚁              │ ALTITUDE      │
│                             │ SPEED         │
│                             │ ATTITUDE      │
│                             │ COMMANDS      │
├─────────────────────────────┴───────────────┤
│   LEFT JOYSTICK             RIGHT JOYSTICK │
├─────────────────────────────────────────────┤
│ CONNECTION | HEARTBEAT | RC | MAVLINK | GPS│
└─────────────────────────────────────────────┘
============================================================
END MASTER PLAN
============================================================
