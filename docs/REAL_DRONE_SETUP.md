# ANITECH GCS - ket noi UDP voi drone that

## Gioi han hien tai

- App dung `react-native-udp`, vi vay phai chay bang native development build. Expo Go khong chua native module nay.
- Android co the build truc tiep tren Windows. iPhone can development build duoc ky boi Apple; Windows khong the tu build iOS local.
- Telemetry, trang thai va ket qua lenh trong app chi den tu MAVLink that. Mo duoc socket UDP khong dong nghia da ket noi vehicle; app chi hien `CONNECTED` sau khi nhan `HEARTBEAT` cua flight controller.
- Video chua nam trong quy trinh kiem thu nay.
- Ban do dung Leaflet + Esri World Imagery trong WebView, khong dung Google Maps Android SDK va khong can nhung API key vao APK. Can Internet de tai Leaflet va map tiles; tile offline chua duoc trien khai.

## 1. An toan truoc khi thu

1. Thao tat ca canh quat.
2. Cap nguon Raspberry Pi rieng. Khong cap nguon Pi tu chan 5V cua cong TELEM.
3. Xac minh pinout dung cua day/cong Pixhawk 2.4.8; khong dua vao mau day.
4. Lan dau chi kiem tra telemetry, doi mode va ARM/DISARM khi da bao dam an toan. Khong thu TAKEOFF hay joystick tren ban.

## 2. Noi Pixhawk voi Raspberry Pi 5

Dung TELEM2 cua Pixhawk:

| Pixhawk TELEM2 | Raspberry Pi UART |
| --- | --- |
| TX | RX, GPIO15, physical pin 10 |
| RX | TX, GPIO14, physical pin 8 |
| GND | GND, physical pin 6 |

Tai Mission Planner dat:

```text
SERIAL2_PROTOCOL = 2
SERIAL2_BAUD = 921
```

`SERIAL2_BAUD=921` nghia la 921600 baud. Neu duong day khong on dinh, co the thu 115200 bang cach dat `SERIAL2_BAUD=115` va doi baud phia Pi cung thanh 115200. Hai dau bat buoc trung nhau. Tham khao [ArduPilot Raspberry Pi via MAVLink](https://ardupilot.org/dev/docs/raspberry-pi-via-mavlink.html) va [Telemetry port setup](https://ardupilot.org/copter/docs/common-telemetry-port-setup.html).

## 3. Bat UART tren Raspberry Pi

```bash
sudo raspi-config
```

Trong `Interface Options > Serial Port`: tat login shell tren serial, bat serial hardware, sau do reboot. Kiem tra device thuc te tren Pi 5:

```bash
readlink -f /dev/serial0
ls -l /dev/serial0
sudo usermod -aG dialout "$USER"
```

Dang xuat/dang nhap lai sau khi them group. Khong hard-code ten UART neu `/dev/serial0` tren may dang tro den device khac; xem [tai lieu UART cua Raspberry Pi](https://www.raspberrypi.com/documentation/computers/configuration.html#configure-uarts).

## 4. Cau hinh mavlink-router

Voi ban `mavlink-router` hien tai ho tro `Mode = Server`, tao `/etc/mavlink-router/main.conf`:

```ini
[General]
TcpServerPort = 0
ReportStats = true

[UartEndpoint flight_controller]
Device = /dev/serial0
Baud = 921600
FlowControl = false

[UdpEndpoint anitech_mobile]
Mode = Server
Address = 0.0.0.0
Port = 14550
```

App gui GCS heartbeat 1 Hz den Pi, nhờ do UDP server hoc endpoint cua dien thoai va route heartbeat/telemetry cua Pixhawk quay lai. Kiem tra cu phap cua ban cai dat voi `mavlink-routerd --help`; cau hinh mau moi chi dinh cac mode `normal` va `server`: [mavlink-router sample config](https://github.com/mavlink-router/mavlink-router/blob/master/examples/config.sample).

```bash
sudo systemctl restart mavlink-router
sudo systemctl status mavlink-router --no-pager
sudo journalctl -u mavlink-router -f
sudo ss -lunp | grep 14550
```

Neu Pi dung firewall, chi mo UDP 14550 cho mang Wi-Fi LAN tin cay. Khong forward cong nay truc tiep ra Internet.

## 5. Chay app Android

PC va dien thoai/Pi phai truy cap duoc nhau tren cung LAN. Trong app dat:

```text
Remote host = 255.255.255.255 hoac IP Wi-Fi/VPN cua Raspberry Pi
Remote port = 14550
Local port  = 14550
```

Che do mac dinh la `UDP AUTO`: app tu bind local port 14550 khi khoi dong, gui GCS heartbeat discovery, sau do hoc IP/port nguon tu heartbeat autopilot hop le. Neu broadcast bi chan hoac ket noi qua VPN, thay Remote host bang IP Pi/VPN cu the. QGroundControl dang nhan telemetry tren PC khong tu dong relay packet vao Android emulator.

Tren PC:

```powershell
npx expo start --dev-client --clear --port 8081
```

Neu chua cai APK development:

```powershell
npx expo run:android --device
```

## 6. Kiem thu bench

1. Mo app; socket tu bind UDP 14550 nhung UI van doi vehicle. Nut CONNECT dung de ngat/noi lai thu cong.
2. Bat Pixhawk va Pi. Khi nhan heartbeat that, app phai hien `CONNECTED`, SYSID, mode va arm state.
3. GPS/battery chua co message phai hien `--`, khong duoc hien gia tri 0 gia.
4. Doi sang mot mode an toan; UI chi xac nhan thanh cong sau `COMMAND_ACK` va heartbeat phan anh mode moi.
5. Thu ARM khi da thao canh quat. Pre-arm check co the tu choi; app phai hien noi dung ACK/STATUSTEXT thay vi gia thanh cong.
6. Tat Pi hoac rut UART: sau timeout app phai bao heartbeat lost/stale va khoa lenh nguy hiem.

De khoanh vung loi tren Pi:

```bash
sudo tcpdump -ni any udp port 14550
```

Neu co GCS heartbeat tu dien thoai nhung khong co heartbeat tu Pixhawk, kiem tra UART, baud, `SERIAL2_PROTOCOL` va log `mavlink-router`. Neu Pi co ca hai chieu nhung app khong nhan, kiem tra Wi-Fi client isolation va firewall.

## 7. iPhone va ket noi tu xa

UDP native tren iPhone van can development build duoc Apple ky; quet bang Expo Go khong the nap `react-native-udp`. Sau khi co Apple Developer registration, tao iOS development build va dung cung cau hinh Pi o tren.

Neu sau nay dung Tailscale, thay Remote host bang IP Tailscale cua Pi va gioi han firewall vao interface Tailscale. Thu LAN on dinh truoc khi them VPN.
