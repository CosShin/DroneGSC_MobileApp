# ANITECH GCS Architecture

## 1. Tổng quan hệ thống (System Overview)
Hệ thống bao gồm 3 thành phần chính:
1. **Mobile App (ANITECH GCS):** Ứng dụng điều khiển trên điện thoại (Ground Control Station).
2. **Drone Gateway (Raspberry Pi 5):** Đóng vai trò cầu nối, xử lý MAVLink, Video Streaming, Computer Vision, và giao tiếp mạng.
3. **Flight Controller (Pixhawk/ArduPilot):** Điều khiển bay, xử lý an toàn mức phần cứng (failsafe, sensors, motors).

**Luồng dữ liệu (Data Flow):**
Mobile App <--(WiFi/4G/Internet)--> Raspberry Pi 5 <--(UART/USB)--> Pixhawk <--> Sensors/Motors

## 2. Kiến trúc Mobile App
Do thư mục dự án hiện tại đang trống, chúng ta sẽ khởi tạo dự án mới với 스택 công nghệ:
- **Framework:** React Native (Expo Managed Workflow) - Giúp phát triển nhanh và dễ dàng build trên iOS/Android.
- **Ngôn ngữ:** TypeScript - Đảm bảo an toàn kiểu dữ liệu (strongly typed).
- **State Management:** Redux Toolkit - Quản lý state phức tạp (Telemetry, Drone State, Mission, Settings).
- **Navigation:** React Navigation (Native Stack/Bottom Tabs).
- **Styling:** StyleSheet thuần hoặc StyleSheet mở rộng (tránh các library quá cồng kềnh, tập trung vào dark theme, UI/UX chuyên nghiệp).
- **Network/Transport:** Hỗ trợ đa giao thức (WebSocket, UDP/TCP).

### Cấu trúc thư mục dự kiến:
```text
src/
├── app/
│   ├── navigation/        # Cấu hình React Navigation
│   └── screens/           # Các màn hình chính (Flight, Mission, Settings...)
├── components/            # UI components tái sử dụng
│   ├── flight/            # Flight Dashboard widgets
│   ├── joystick/          # Virtual Joystick
│   ├── telemetry/         # Telemetry widgets
│   ├── map/               # Bản đồ
│   ├── mission/           # Mission Planner widgets
│   ├── video/             # Video stream component
│   └── common/            # Nút bấm, modal, indicator...
├── services/              # Xử lý logic và giao tiếp external
│   ├── connection/        # Quản lý WebSocket/TCP/UDP clients
│   ├── mavlink/           # (Tùy chọn) parse MAVLink nếu Gateway gửi raw
│   ├── telemetry/         # Xử lý dữ liệu telemetry
│   ├── command/           # Xử lý lệnh điều khiển
│   ├── mission/           # Quản lý upload/download mission
│   └── video/             # Quản lý luồng video
├── store/                 # Redux Toolkit Slices
│   ├── drone/             # State của drone (armed, mode, battery)
│   ├── telemetry/         # Data realtime của sensors
│   ├── mission/           # Danh sách waypoint
│   ├── connection/        # Trạng thái kết nối Pi/Pixhawk
│   └── settings/          # Cài đặt app
├── hooks/                 # Custom React hooks
├── utils/                 # Hàm tiện ích (format, math)
├── types/                 # TypeScript interfaces/types
└── config/                # Cấu hình chung (IP, Port, Timeouts)
```

## 3. Kiến trúc Connection Layer
UI không bao giờ giao tiếp trực tiếp với Flight Controller. Thay vào đó, luồng dữ liệu đi qua Service Layer và Redux Store:

- **Command Flow:** `UI -> Command Service -> Connection Layer -> Pi Gateway -> Pixhawk`
- **Telemetry Flow:** `Pixhawk -> Pi Gateway -> Connection Layer -> Telemetry Service -> Redux Store -> UI`

**Mock Drone Mode:** Một `MockConnectionService` sẽ được xây dựng để giả lập tín hiệu MAVLink/Telemetry khi phát triển (không cần drone thật).

## 4. Cơ chế an toàn (Safety Considerations)
- **Failsafe Tự Động:** App không thay thế failsafe của Pixhawk (RTL/Land khi mất sóng, pin yếu).
- **Heartbeat & Connection Watchdog:** 
  - GCS phải liên tục gửi và nhận Heartbeat.
  - Nếu quá `CONNECTION_TIMEOUT` không có Heartbeat, UI sẽ hiển thị MẤT KẾT NỐI và dừng gửi Command.
- **Virtual Joystick Safety:**
  - Thiết kế `Touch Release Safety`: Thả tay là tự reset về Neutral.
  - Có `Command Timeout`: Nếu mất sóng, Joystick Command phải ngừng gửi để Pixhawk kích hoạt failsafe (RC Loss).
- **Validation:** 
  - Mọi thao tác nguy hiểm (ARM, TAKEOFF) phải trải qua bước kiểm tra điều kiện (GPS lock, Mode hợp lệ, Battery ok).
  - Mission Upload phải validate tọa độ, độ cao trước khi gửi.
