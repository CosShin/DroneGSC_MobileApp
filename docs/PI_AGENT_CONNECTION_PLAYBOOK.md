# ANITECH GCS - hướng dẫn triển khai Raspberry Pi Gateway cho agent

> Đưa nguyên file này cho agent đang thao tác trên Raspberry Pi. Đây là contract tích hợp của app hiện tại, không phải tài liệu thiết kế giả định.

## 1. Mục tiêu hoàn thành

Thiết lập đường truyền ổn định, hai chiều và trung thực:

```text
Pixhawk / ArduPilot
        │ MAVLink binary qua UART hoặc USB
        ▼
  mavlink-routerd trên Raspberry Pi
        │ MAVLink binary qua UDP loopback :14550
        ▼
  ANITECH binary WebSocket gateway
        │ ws://<PI_IP>:8765/mavlink
        ▼
      ANITECH GCS App
```

Video là một đường độc lập:

```text
Camera → encoder H.264 → MediaMTX → WebRTC → ANITECH GCS App
```

Kết quả chỉ được xem là đạt khi app nhận được heartbeat thật, xác định đúng `SYSID/COMPID`, nhận telemetry và gửi lệnh hai chiều tới autopilot. HTTP dashboard mở được hoặc WebSocket mở được chưa có nghĩa là vehicle đã kết nối.

Không thể bảo đảm hệ thống “không bao giờ lỗi”. Mục tiêu là không tạo trạng thái giả, tự phục hồi sau lỗi có thể phục hồi, cô lập lỗi video khỏi MAVLink và cung cấp đủ chẩn đoán để tìm đúng tầng bị lỗi.

## 2. Contract bắt buộc của app

Các yêu cầu dưới đây được đối chiếu trực tiếp từ source hiện tại:

- App mặc định dùng WebSocket URL `ws://192.168.1.247:8765/mavlink`; IP chỉ là mẫu, phải thay bằng IP LAN/VPN thật của Pi. Xem [`src/settings/defaults/connection.ts`](../src/settings/defaults/connection.ts).
- WebSocket nhận và gửi **MAVLink binary nguyên bản**. Text/JSON từ Pi sẽ bị app từ chối với `WEBSOCKET_TEXT_FRAME_REJECTED`. Xem [`src/services/mavlink/WebSocketTransport.ts`](../src/services/mavlink/WebSocketTransport.ts).
- Một WebSocket message có thể chứa một phần frame, đúng một frame hoặc nhiều frame MAVLink. App có bộ đệm stream; Pi chỉ cần giữ nguyên byte và đúng thứ tự.
- App gửi GCS heartbeat MAVLink 2 từ `SYSID=255`, `COMPID=190` mỗi 1 giây. Gateway phải chuyển các byte này ngược về Pixhawk.
- App chỉ coi vehicle là active sau heartbeat thật từ flight controller. Transport mở nhưng chưa có heartbeat phải tiếp tục là `WAITING_HEARTBEAT`.
- Timeout heartbeat mặc định là 3 giây; reconnect WebSocket mặc định bật, bắt đầu từ 1 giây và backoff tới 30 giây.
- Khi nhận heartbeat đầu tiên, app tự yêu cầu message interval cho heartbeat, attitude, position, GPS, battery, RC, distance sensor, optical flow và một số mission message. Pi không được tạo thêm request định kỳ trùng lặp.
- Command, mission, joystick và `COMMAND_ACK` đều đi trên cùng stream MAVLink. Không được lọc bỏ traffic chiều app → vehicle.
- MAVLink 2 signing, nếu người dùng bật trong app, phải được relay nguyên byte. Không log hoặc lưu signing key trên gateway.
- Video live không được dùng để suy ra vehicle connected. MAVLink và video có thể hoạt động hoặc lỗi độc lập.

Gateway mẫu của repo là [`tools/mavlink_bridge.py`](../tools/mavlink_bridge.py). Nó cung cấp:

- `ws://0.0.0.0:8765/mavlink`: endpoint binary cho app;
- `http://0.0.0.0:8765/health`: health JSON;
- UDP input/output tại `0.0.0.0:14550`;
- alias `/ws` và text command chỉ để tương thích tooling cũ, không phải contract của app.

## 3. Những điều tuyệt đối không làm

- Không gửi telemetry JSON/text vào `/mavlink`.
- Không decode rồi tạo lại packet MAVLink nếu chỉ làm gateway; phải relay raw bytes.
- Không tự phát heartbeat giả mang `SYSID` của drone.
- Không tự tạo `COMMAND_ACK`, không báo thành công chỉ vì `send()` thành công.
- Không thay phone GPS bằng vehicle GPS, không tạo battery/GPS/mode mặc định.
- Không để QGroundControl, MAVProxy và nhiều process cùng mở độc quyền một UART.
- Không route vòng UDP làm một packet quay lại chính nguồn và nhân traffic vô hạn.
- Không public port `8765`, `14550`, `8889`, `8189` trực tiếp ra Internet. Dùng LAN tin cậy hoặc VPN; dùng WSS khi đi qua mạng không tin cậy.
- Không thử ARM/TAKEOFF/joystick với cánh quạt đang lắp.

## 4. Giai đoạn A - khảo sát Pi trước khi thay đổi

Agent phải chạy và lưu kết quả các lệnh sau:

```bash
cat /etc/os-release
uname -a
cat /proc/device-tree/model 2>/dev/null
hostname -I
ip -br address
ip route
ls -l /dev/serial* /dev/ttyAMA* /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
systemctl list-unit-files | grep -E 'mavlink|anitech|mediamtx'
sudo ss -lntup
```

Xác định trước khi triển khai:

1. Model Pi và Raspberry Pi OS version.
2. Pixhawk nối bằng GPIO UART hay USB.
3. Device thật, ưu tiên đường ổn định như `/dev/serial/by-id/...` nếu dùng USB.
4. Cổng TELEM nào của Pixhawk và tham số `SERIALx_*` tương ứng.
5. Baud ở hai đầu.
6. IP LAN và IP VPN nếu có.
7. Process nào hiện đang sở hữu serial/UDP/TCP port.
8. App sẽ dùng WebSocket hay UDP trực tiếp. Playbook này ưu tiên WebSocket gateway.

Không sửa cấu hình trước khi có các thông tin trên.

## 5. Giai đoạn B - phần cứng và UART

### 5.1 An toàn điện

- Tháo toàn bộ cánh quạt trước bench test.
- Cấp nguồn Pi riêng; không lấy nguồn 5 V của cổng TELEM để nuôi Pi.
- Nối chung GND, nối chéo Pixhawk TX → Pi RX và Pixhawk RX ← Pi TX.
- Kiểm tra pinout theo đúng model flight controller/cáp; không dựa vào màu dây.
- GPIO của Pi là 3.3 V. Không đưa tín hiệu 5 V vào UART Pi.

### 5.2 ArduPilot

Ví dụ khi dùng TELEM2 trên Pixhawk:

```text
SERIAL2_PROTOCOL = 2       # MAVLink 2
SERIAL2_BAUD     = 921     # 921600 baud
```

Nếu đường dây không ổn định, bắt đầu với 115200 ở cả hai đầu (`SERIAL2_BAUD=115`). Tên `SERIAL2` chỉ là ví dụ; phải xác minh đúng cổng trên flight controller đang dùng.

### 5.3 Raspberry Pi 5

Không mặc định rằng `/dev/serial0` là GPIO14/15. Trên Pi 5, primary UART có thể trỏ tới debug UART; GPIO UART khác cần overlay phù hợp với board/OS. Agent phải:

```bash
readlink -f /dev/serial0
grep -E '^(enable_uart|dtoverlay=.*uart)' /boot/firmware/config.txt 2>/dev/null
dtoverlay -a | grep uart
```

Nếu dùng GPIO UART, tắt serial login shell nhưng bật serial hardware bằng `sudo raspi-config`, reboot rồi xác minh lại device và pin mapping. Nếu không chắc pin mapping trên Pi 5, ưu tiên USB-to-serial 3.3 V chất lượng tốt hoặc USB trực tiếp từ Pixhawk với `/dev/serial/by-id/...`; không đoán overlay.

User chạy serial phải thuộc group `dialout`:

```bash
sudo usermod -aG dialout <service-user>
```

Đăng xuất/đăng nhập hoặc reboot sau khi đổi group.

## 6. Giai đoạn C - một chủ sở hữu serial, nhiều endpoint

Dùng `mavlink-routerd` làm process duy nhất đọc/ghi Pixhawk. Cài từ package Raspberry Pi OS nếu có, nếu không build từ repository chính thức. Ghi lại version:

```bash
mavlink-routerd --version || mavlink-routerd --help
```

Tạo cấu hình phù hợp với version đang cài. Với syntax hiện tại hỗ trợ `Mode = Normal` và `Mode = Server`, cấu hình đề xuất là:

```ini
[General]
TcpServerPort = 0
ReportStats = true

[UartEndpoint flight_controller]
Device = /dev/serial/by-id/REPLACE_WITH_PIXHAWK_DEVICE
Baud = 115200
FlowControl = false

[UdpEndpoint anitech_ws_bridge]
Mode = Normal
Address = 127.0.0.1
Port = 14550
```

Thay device và baud bằng giá trị đã khảo sát. `Mode = Normal` chủ động gửi telemetry tới gateway đang bind `127.0.0.1:14550`; packet chiều ngược từ gateway sẽ trở lại đúng UDP endpoint và được route về UART.

Nếu binary gateway chạy trong container hoặc máy khác, không dùng `127.0.0.1`; khai báo địa chỉ thực và firewall phù hợp. Không vừa tạo endpoint `Normal` vừa tạo endpoint `Server` cùng port.

Kiểm tra service name thật trước khi restart:

```bash
systemctl list-unit-files | grep mavlink-router
sudo systemctl restart mavlink-router
sudo systemctl status mavlink-router --no-pager
sudo journalctl -u mavlink-router -n 100 --no-pager
```

Chỉ một process được mở device:

```bash
sudo fuser -v /dev/serial/by-id/usb-Pixhawk_example
```

## 7. Giai đoạn D - triển khai ANITECH binary WebSocket gateway

### 7.1 Cài runtime cô lập

Ví dụ layout:

```text
/opt/anitech-gcs/
├── tools/mavlink_bridge.py
└── .venv/
```

Tạo service user và thư mục nếu máy chưa có. Nếu policy vận hành đã có user riêng thì dùng user đó, không tạo trùng:

```bash
id anitech >/dev/null 2>&1 || sudo useradd --system --home-dir /opt/anitech-gcs --shell /usr/sbin/nologin anitech
sudo install -d -o anitech -g anitech /opt/anitech-gcs /opt/anitech-gcs/tools
```

Copy gateway vào `/opt/anitech-gcs/tools/mavlink_bridge.py`, đặt owner là `anitech:anitech`, rồi thiết lập virtual environment:

```bash
sudo -u anitech python3 -m venv /opt/anitech-gcs/.venv
sudo -u anitech /opt/anitech-gcs/.venv/bin/python -m pip install --upgrade pip
sudo -u anitech /opt/anitech-gcs/.venv/bin/python -m pip install aiohttp
```

Copy đúng [`tools/mavlink_bridge.py`](../tools/mavlink_bridge.py) từ cùng revision với app. Không dùng hai Python bridge JSON cũ nếu còn sót trên Pi.

### 7.2 Hardening bắt buộc cho production Pi

Gateway hiện tại đồng thời thử kết nối SITL TCP `127.0.0.1:5760/5762/5763` và nghe UDP `14550`. Trên Pi thật, agent phải cấu hình hoặc sửa bản deploy để chạy **UDP source only**; không được để một SITL process xuất hiện sau này và chiếm đường gửi command thay cho Pixhawk.

Giữ nguyên các đặc tính sau khi hardening:

- một UDP reader duy nhất;
- raw MAVLink byte-for-byte theo cả hai chiều;
- WebSocket outbound luôn là binary;
- giữ thứ tự packet;
- client đóng kết nối phải được xóa ngay;
- queue/buffer phải có giới hạn; client chậm phải bị ngắt thay vì làm nghẽn tất cả client;
- lỗi một WebSocket client không được dừng UART/router/gateway;
- không tích lũy backlog telemetry cũ để phát lại sau reconnect;
- shutdown phải đóng socket, task và client sạch;
- log metadata/rate/error, không dump vô hạn payload và không log signing key.

Parser nhỏ trong gateway chỉ dùng cho health/dashboard, không phải source of truth. Bản hiện tại parse theo từng UDP/TCP chunk nên có thể bỏ lỡ một heartbeat bị chia chunk; tuyệt đối không sửa hay bỏ raw packet chỉ vì helper parser không hiểu. Nếu cần health chính xác, dùng parser stream có buffer hoặc `pymavlink` chỉ để quan sát bản sao dữ liệu.

`/health` hiện trả `ok: true` khi process HTTP còn sống. Điều đó không chứng minh vehicle active. Vehicle chỉ active khi có heartbeat mới:

```text
vehicleDetected == true
AND heartbeatAgeMs != null
AND heartbeatAgeMs <= 3000
```

Nên bổ sung field riêng `vehicleActive` theo điều kiện trên và reset metadata vehicle khi session/source thay đổi. App không phụ thuộc health endpoint để điều khiển bay, nên health không được can thiệp stream MAVLink.

### 7.3 Chạy thử foreground

```bash
cd /opt/anitech-gcs
ANITECH_MAVLINK_WS_PORT=8765 .venv/bin/python tools/mavlink_bridge.py
```

Ở terminal khác:

```bash
curl -fsS http://127.0.0.1:8765/health | python3 -m json.tool
sudo ss -lntup | grep -E ':8765|:14550'
sudo tcpdump -ni lo udp port 14550
```

Phải thấy UDP từ `mavlink-routerd` tới gateway. Sau khi app kết nối, phải thấy traffic UDP chiều ngược đều đặn do GCS heartbeat 1 Hz.

### 7.4 Systemd

Tạo `/etc/systemd/system/anitech-mavlink-gateway.service` sau khi xác minh đúng user và đường dẫn:

```ini
[Unit]
Description=ANITECH binary MAVLink WebSocket gateway
Wants=network-online.target
After=network-online.target mavlink-router.service

[Service]
Type=simple
User=anitech
Group=anitech
WorkingDirectory=/opt/anitech-gcs
Environment=PYTHONUNBUFFERED=1
Environment=ANITECH_MAVLINK_WS_PORT=8765
ExecStart=/opt/anitech-gcs/.venv/bin/python /opt/anitech-gcs/tools/mavlink_bridge.py
Restart=always
RestartSec=2
TimeoutStopSec=10
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Nếu service `mavlink-router` trên máy có tên khác, sửa `After=` cho đúng. Gateway không trực tiếp mở serial nên không cần chạy root. Sau đó:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now anitech-mavlink-gateway
sudo systemctl status anitech-mavlink-gateway --no-pager
sudo journalctl -u anitech-mavlink-gateway -n 100 --no-pager
```

Kiểm tra restart thật bằng cách restart service và power-cycle Pi; không chỉ chạy foreground một lần.

## 8. Giai đoạn E - cấu hình app

Trong `Settings → Connection`:

```text
Transport:          WEBSOCKET
Binary WebSocket:   ws://<PI_LAN_IP>:8765/mavlink
Auto reconnect:     ON
Reconnect delay:    1000 ms
Connection timeout: 5000 ms
Heartbeat timeout:  3000 ms
```

Quy tắc URL:

- Dùng đúng `ws://` hoặc `wss://`.
- Dùng dấu `/`, không dùng `\`.
- Endpoint chính là `/mavlink`, không phải `/`, `/health` hoặc dashboard.
- Trên điện thoại thật, `127.0.0.1` là điện thoại, không phải Pi.
- Android emulator dùng alias riêng của host PC, nhưng Pi trong LAN vẫn nên dùng IP LAN thật.
- Nếu đổi Wi-Fi làm IP Pi thay đổi, dùng DHCP reservation hoặc hostname LAN đã kiểm chứng.

Diễn giải trạng thái đúng:

| App hiển thị | Ý nghĩa |
| --- | --- |
| Transport connected / waiting | WS mở, chưa có heartbeat flight controller |
| Vehicle connected | Heartbeat MAVLink thật còn mới |
| Heartbeat lost / stale | WS có thể còn mở nhưng vehicle không còn đáng tin |
| Video live | Chỉ camera hoạt động; không nói gì về MAVLink |

## 9. Giai đoạn F - MediaMTX/WebRTC độc lập

App mặc định dùng:

```text
Scheme:      http
Host:        <PI_IP>
Port:        8889
Stream path: landing-cam
Browser URL: http://<PI_IP>:8889/landing-cam
```

Config mẫu repo tại [`tools/streamer/mediamtx/mediamtx.yml`](../tools/streamer/mediamtx/mediamtx.yml) bật:

```yaml
rtsp: yes
rtspAddress: :8554
webrtc: yes
webrtcAddress: :8889
webrtcLocalUDPAddress: :8189
webrtcLocalTCPAddress: ''
webrtcIPsFromInterfaces: yes
webrtcAdditionalHosts: []
```

Trên Pi, thêm IP LAN/VPN thật vào `webrtcAdditionalHosts` hoặc biến môi trường tương ứng. Firewall LAN cần TCP `8889` và UDP `8189`. RTSP publish nội bộ dùng `127.0.0.1:8554` thì không cần public port `8554`.

Publisher phải tạo H.264 browser-compatible, không B-frame, ưu tiên baseline/low-latency. Ví dụ định hướng cho Raspberry Pi Camera; agent phải điều chỉnh theo camera và tool thực tế:

```bash
rpicam-vid -t 0 --inline --codec h264 --profile baseline \
  --width 1280 --height 720 --framerate 30 -o - \
| ffmpeg -fflags nobuffer -f h264 -i pipe:0 -c:v copy \
  -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/landing-cam
```

Test `http://<PI_IP>:8889/landing-cam` trong Safari/Chrome trên chính điện thoại trước khi debug app. Video failure không được restart hoặc thay đổi MAVLink gateway.

## 10. Quy trình kiểm thử bắt buộc

### T0 - process và port

- `mavlink-routerd`, gateway và MediaMTX (nếu dùng video) có service riêng.
- Chỉ gateway listen TCP `8765`.
- Chỉ một process sở hữu serial.
- Không có restart loop trong `journalctl`.

### T1 - Pixhawk → router → gateway

Tháo cánh quạt, bật Pixhawk và kiểm tra:

```bash
sudo journalctl -u mavlink-router -f
sudo tcpdump -ni lo -X udp port 14550
curl -fsS http://127.0.0.1:8765/health | python3 -m json.tool
```

PASS khi packet tăng và `heartbeatAgeMs` liên tục trở về giá trị nhỏ. `vehicleDetected=true` với heartbeat cũ không đủ để PASS.

### T2 - gateway → app

Từ một máy cùng LAN, kết nối `ws://<PI_IP>:8765/mavlink` bằng client có binary support. PASS khi message nhận được là binary và stream chứa magic byte MAVLink `0xFD` hoặc `0xFE`. Không chuyển bytes sang UTF-8 để kiểm tra.

Trong app mở MAVLink Inspector. PASS khi:

- RX packet/rate tăng;
- có heartbeat từ autopilot `SYSID/COMPID` thật;
- MAVLink chuyển `WAITING` → `ACTIVE`;
- mode, armed, GPS, battery chỉ hiện khi message thật tới;
- CRC error không tăng liên tục;
- reconnect không nhân đôi packet rate.

### T3 - app → gateway → Pixhawk

App phải gửi GCS heartbeat 1 Hz ngay sau transport ready. Kiểm tra UDP loopback có traffic chiều gateway → router. Sau đó, vẫn tháo cánh quạt:

1. Gửi một command an toàn hoặc request message.
2. Xác nhận packet đi tới UART.
3. Xác nhận app nhận `COMMAND_ACK` thật đúng `SYSID/COMPID`.
4. Không đánh dấu PASS nếu chỉ thấy WebSocket `send()` thành công.

### T4 - reconnect/lifecycle

Lặp ít nhất 10 lần:

1. connect app;
2. xác nhận heartbeat active;
3. disconnect app;
4. connect lại.

Sau đó lần lượt:

- restart gateway;
- restart `mavlink-routerd`;
- power-cycle Pixhawk;
- đổi Wi-Fi hoặc ngắt mạng ngắn;
- background/foreground app.

PASS khi app mất heartbeat thì báo stale/khóa lệnh, tự reconnect theo cấu hình, phục hồi một session sạch và packet rate không tăng theo số lần reconnect.

### T5 - video

- MAVLink active + video offline vẫn điều khiển HUD được.
- Video live + MAVLink offline vẫn phải báo vehicle offline.
- Đổi HUD/VIDEO/MAP không restart MAVLink service.
- Stop/start MediaMTX không ảnh hưởng gateway `8765`.

### T6 - test an toàn cuối

Thứ tự bắt buộc:

1. parser/unit test của repo;
2. ArduPilot SITL;
3. Pixhawk bench, tháo cánh quạt;
4. kiểm tra ARM/DISARM, mode và ACK có kiểm soát;
5. chỉ bay thật sau khi toàn bộ bench test đạt.

## 11. Bảng chẩn đoán nhanh

| Hiện tượng | Tầng cần kiểm tra | Kiểm tra đầu tiên |
| --- | --- | --- |
| Mở được dashboard nhưng app chờ vehicle | MAVLink input/heartbeat | `/health`, UDP `14550`, UART baud/protocol |
| WS mở rồi app báo text frame rejected | Gateway protocol | Bắt buộc `send_bytes`, không JSON |
| RX app bằng 0 | Pi → phone | URL `/mavlink`, firewall TCP `8765`, Wi-Fi isolation |
| RX có packet nhưng không heartbeat | Router/source/parser | `SYSID/COMPID`, CRC, MAVLink version, UART framing |
| Telemetry có nhưng command timeout | Chiều phone → Pi → UART | GCS heartbeat, UDP reverse, router route, `COMMAND_ACK` |
| Packet rate tăng sau mỗi reconnect | Leak/route loop | duplicate client/task/listener, UDP loop |
| Pin hiện `--` | Message chưa tới/stale | tìm `SYS_STATUS #1` và `BATTERY_STATUS #147` trong Inspector |
| Pin nhảy 0% | Dữ liệu vehicle hoặc bridge khác | kiểm tra raw #1/#147; không tự thay missing bằng 0 |
| Video live nhưng màn hình chính nói chưa kết nối | Không nhất thiết là lỗi | MAVLink heartbeat và video là hai kết nối độc lập |
| Safari xem video được, app không xem được | App/WebView/network policy | scheme, local-network permission, HTTP/HTTPS/WSS |
| WebRTC signaling được nhưng hình đen | ICE/codec | UDP `8189`, ICE candidate, H.264, B-frame, publisher |
| Pi 5 không có data ở GPIO UART | Device/pin mapping | `readlink`, overlay `uart*-pi5`, serial console |

## 12. Firewall và vận hành

Trong LAN tin cậy, chỉ mở những port thực sự dùng:

| Port | Protocol | Mục đích |
| --- | --- | --- |
| 8765 | TCP | Binary WebSocket và health HTTP |
| 8889 | TCP | MediaMTX WebRTC signaling/player |
| 8189 | UDP | WebRTC ICE media |
| 8554 | TCP | Chỉ khi publisher RTSP ở máy khác |
| 14550 | UDP | Nên giữ loopback nếu router và gateway cùng Pi |

Khi dùng Tailscale/WireGuard, dùng IP VPN thật trong app và ICE candidate. VPN chỉ là đường mạng, không phải MAVLink protocol. Không expose signing key, password hoặc token trong repository, environment log hay dashboard.

## 13. Tiêu chí nghiệm thu

Agent chỉ báo `PASS` khi cung cấp đủ bằng chứng:

- [ ] Device serial và baud đã xác minh, không đoán.
- [ ] Một process duy nhất sở hữu serial.
- [ ] MAVLink raw binary đi đủ hai chiều.
- [ ] `/mavlink` chỉ gửi binary cho app.
- [ ] Heartbeat autopilot thật còn mới dưới timeout.
- [ ] App xác định đúng vehicle `SYSID/COMPID`.
- [ ] Telemetry thật cập nhật; unknown vẫn là `--/UNKNOWN`.
- [ ] Command test nhận `COMMAND_ACK` thật.
- [ ] Restart Pi tự khởi động lại router/gateway.
- [ ] Reconnect 10 lần không nhân listener/task/packet rate.
- [ ] Mất Pixhawk làm app báo stale, không báo connected giả.
- [ ] Video và MAVLink lỗi/phục hồi độc lập.
- [ ] Không có secret trong diff hoặc log.
- [ ] Chưa bay thật; bench test thực hiện khi đã tháo cánh quạt.

Báo cáo bàn giao phải có đúng các mục:

```text
PI MODEL / OS:
PI LAN/VPN IP:
PIXHAWK DEVICE / BAUD:
ARDUPILOT SERIALx CONFIG:
MAVLINK-ROUTER VERSION / CONFIG PATH:
GATEWAY REVISION / SERVICE:
APP WEBSOCKET URL:
VIDEO URL (nếu có):

TESTS:
- T0: PASS/FAIL + evidence
- T1: PASS/FAIL + evidence
- T2: PASS/FAIL + evidence
- T3: PASS/FAIL + evidence
- T4: PASS/FAIL + evidence
- T5: PASS/FAIL/NOT TESTED + evidence

FILES CHANGED:
REMAINING ISSUES:
FINAL: PASS / PARTIAL / BLOCKED
```

Không ghi `PASS` cho real-device nếu mới chỉ đọc source hoặc chạy mock/SITL.

## 14. Nguồn đối chiếu

- App transport: [`src/services/mavlink/WebSocketTransport.ts`](../src/services/mavlink/WebSocketTransport.ts)
- MAVLink core: [`src/services/mavlink/MavlinkManager.ts`](../src/services/mavlink/MavlinkManager.ts), [`src/services/mavlink/MavlinkProtocol.ts`](../src/services/mavlink/MavlinkProtocol.ts)
- Connection lifecycle: [`src/services/connection/UniversalConnectionService.ts`](../src/services/connection/UniversalConnectionService.ts)
- Gateway mẫu: [`tools/mavlink_bridge.py`](../tools/mavlink_bridge.py)
- Video config: [`src/video/VideoConfig.ts`](../src/video/VideoConfig.ts), [`tools/streamer/mediamtx/mediamtx.yml`](../tools/streamer/mediamtx/mediamtx.yml)
- [ArduPilot - Raspberry Pi via MAVLink](https://ardupilot.org/dev/docs/raspberry-pi-via-mavlink.html)
- [ArduPilot - Telemetry port setup](https://ardupilot.org/copter/docs/common-telemetry-port-setup.html)
- [Raspberry Pi - UART configuration](https://www.raspberrypi.com/documentation/computers/configuration.html#configure-uarts)
- [mavlink-router official repository and config](https://github.com/mavlink-router/mavlink-router)
- [MediaMTX WebRTC documentation](https://mediamtx.org/docs/usage/read-a-stream#webrtc)
