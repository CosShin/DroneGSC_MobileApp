#!/usr/bin/env python3
"""
ANITECH GCS - Universal MAVLink Bridge (TCP/UDP to WebSocket)
Connects directly to ArduPilot SITL (TCP 5760/5762/5763) or listens on UDP (14550/14551)
and bridges telemetry to ANITECH GCS App via WebSockets on port 8088.
"""

import asyncio
import socket
import struct
import json
import logging
from aiohttp import web

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MAVLinkBridge")

WS_PORT = 8088
SITL_HOST = "127.0.0.1"
SITL_PORTS = [5760, 5762, 5763]

connected_clients = set()
sitl_writer = None

drone_state = {
    "latitude": 10.823099,
    "longitude": 106.629664,
    "altitude": 0.0,
    "speed": 0.0,
    "battery": 100,
    "voltage": 16.4,
    "current": 0.0,
    "mode": "STABILIZE",
    "armed": False,
    "roll": 0.0,
    "pitch": 0.0,
    "yaw": 0.0,
    "heading": 0,
    "satellites": 18,
    "hdop": 0.8,
    "vehicleType": "COPTER",
    "vehicleName": "ArduCopter SITL V4.6",
    "autopilot": "ARDUPILOT",
    "bytesRx": 0,
    "bytesTx": 0,
    "packetsPerSec": 20,
    "latencyMs": 8,
    "timestamp": 0
}

def parse_mavlink(data: bytes):
    """Parses binary MAVLink v1 / v2 packet stream."""
    global drone_state
    if not data or len(data) < 6:
        return

    drone_state["bytesRx"] += len(data)

    idx = 0
    while idx < len(data):
        magic = data[idx]
        if magic == 0xFE and idx + 8 <= len(data): # MAVLink v1
            length = data[idx + 1]
            if idx + 8 + length > len(data):
                break
            msgid = data[idx + 5]
            payload = data[idx + 6 : idx + 6 + length]
            handle_msg(msgid, payload)
            idx += 8 + length
        elif magic == 0xFD and idx + 12 <= len(data): # MAVLink v2
            length = data[idx + 1]
            if idx + 12 + length > len(data):
                break
            msgid = struct.unpack("<I", data[idx + 7 : idx + 10] + b"\x00")[0]
            payload = data[idx + 10 : idx + 10 + length]
            handle_msg(msgid, payload)
            idx += 12 + length
        else:
            idx += 1

def handle_msg(msgid: int, payload: bytes):
    global drone_state
    import math

    # HEARTBEAT (#0)
    if msgid == 0 and len(payload) >= 9:
        custom_mode, type_id, ap_id, base_mode, system_status = struct.unpack("<IBBBBB", payload[:9])
        drone_state["armed"] = bool(base_mode & 128)
        copter_modes = {
            0: "STABILIZE", 1: "ACRO", 2: "ALT_HOLD", 3: "AUTO", 4: "GUIDED",
            5: "LOITER", 6: "RTL", 7: "CIRCLE", 9: "LAND", 11: "DRIFT", 16: "POSHOLD"
        }
        drone_state["mode"] = copter_modes.get(custom_mode, f"MODE_{custom_mode}")

    # ATTITUDE (#30)
    elif msgid == 30 and len(payload) >= 16:
        time_boot, roll, pitch, yaw = struct.unpack("<Ifff", payload[:16])
        drone_state["roll"] = round(math.degrees(roll), 2)
        drone_state["pitch"] = round(math.degrees(pitch), 2)
        drone_state["yaw"] = round((math.degrees(yaw) + 360) % 360, 2)
        drone_state["heading"] = int(drone_state["yaw"])

    # GLOBAL_POSITION_INT (#33)
    elif msgid == 33 and len(payload) >= 28:
        time_boot, lat, lon, alt, relative_alt, vx, vy, vz, hdg = struct.unpack("<IiiiihhhH", payload[:28])
        drone_state["latitude"] = lat / 1e7
        drone_state["longitude"] = lon / 1e7
        drone_state["altitude"] = round(relative_alt / 1000.0, 2)
        ground_speed = ((vx**2 + vy**2) ** 0.5) / 100.0
        drone_state["speed"] = round(ground_speed, 2)

    # SYS_STATUS (#1)
    elif msgid == 1 and len(payload) >= 19:
        sensors_present, sensors_enabled, sensors_health, load, vbat, current_bat, bat_remaining = struct.unpack("<IIIHHhB", payload[:19])
        drone_state["voltage"] = round(vbat / 1000.0, 2)
        drone_state["current"] = round(current_bat / 100.0, 2)
        if bat_remaining <= 100:
            drone_state["battery"] = bat_remaining

    # GPS_RAW_INT (#24)
    elif msgid == 24 and len(payload) >= 30:
        time_usec, fix_type, lat, lon, alt, eph, epv, vel, cog, satellites_visible = struct.unpack("<QBiifHHHBB", payload[:30])
        drone_state["satellites"] = satellites_visible
        drone_state["hdop"] = round(eph / 100.0, 2)

async def connect_sitl_tcp():
    """Connects to ArduPilot SITL TCP port with auto-reconnect."""
    global sitl_writer
    while True:
        for port in SITL_PORTS:
            try:
                reader, writer = await asyncio.open_connection(SITL_HOST, port)
                sitl_writer = writer
                logger.info(f"CONNECTED TO ARDUPILOT SITL ({SITL_HOST}:{port})!")

                while True:
                    data = await reader.read(4096)
                    if not data:
                        break
                    parse_mavlink(data)
            except (ConnectionRefusedError, OSError):
                continue
            except Exception as e:
                break
        await asyncio.sleep(2)

async def listen_udp():
    """Listens on UDP with SO_REUSEADDR."""
    loop = asyncio.get_running_loop()
    for port in [14550, 14551, 14555]:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("0.0.0.0", port))
            sock.setblocking(False)
            logger.info(f"Listening for MAVLink UDP packets on port {port}...")
            
            while True:
                data = await loop.sock_recv(sock, 4096)
                if data:
                    parse_mavlink(data)
        except Exception:
            continue

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    connected_clients.add(ws)
    logger.info(f"ANITECH GCS App connected from {request.remote}")

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    payload = json.loads(msg.data)
                    logger.info(f"Received Command from App: {payload}")
                except Exception as e:
                    logger.error(f"Error handling app message: {e}")
    finally:
        connected_clients.remove(ws)
        logger.info(f"App disconnected: {request.remote}")
    return ws

async def telemetry_broadcast_loop():
    """Broadcasts 20Hz MAVLink telemetry to all connected mobile apps."""
    import time
    while True:
        await asyncio.sleep(0.05) # 20 Hz
        if not connected_clients:
            continue

        drone_state["timestamp"] = int(time.time() * 1000)
        msg_json = json.dumps({"type": "TELEMETRY", "data": drone_state})
        
        for ws in list(connected_clients):
            try:
                await ws.send_str(msg_json)
            except Exception:
                pass

async def main():
    # 1. Start WebSocket Server for App
    app = web.Application()
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/", lambda r: web.Response(text="ANITECH GCS MAVLink Bridge Running OK"))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", WS_PORT)
    await site.start()
    logger.info(f"WebSocket Bridge running on ws://0.0.0.0:{WS_PORT}/ws")

    # 2. Run SITL Connection Task, UDP Listener, and Telemetry Loop
    await asyncio.gather(
        connect_sitl_tcp(),
        listen_udp(),
        telemetry_broadcast_loop()
    )

if __name__ == "__main__":
    print("=========================================================")
    print("ANITECH GCS - MAVLink Bridge Server")
    print(f"Connecting to ArduPilot SITL: {SITL_HOST}:5760/5762/5763")
    print(f"Listening on UDP ports: 14550/14551/14555")
    print(f"Serving WebSocket for Mobile App: ws://0.0.0.0:{WS_PORT}/ws")
    print("=========================================================")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge stopped.")
