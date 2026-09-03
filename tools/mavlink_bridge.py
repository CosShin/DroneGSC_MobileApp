#!/usr/bin/env python3
"""
ANITECH GCS - Binary MAVLink Bridge (TCP/UDP to WebSocket)
Connects directly to ArduPilot SITL (TCP 5760/5762/5763) or listens on UDP (14550/14551)
and relays untouched MAVLink frames to ANITECH GCS App on /mavlink.
"""

import asyncio
import socket
import struct
import json
import logging
import time
import os
from aiohttp import web

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MAVLinkBridge")

WS_PORT = int(os.environ.get("ANITECH_MAVLINK_WS_PORT", "8765"))
SITL_HOST = "127.0.0.1"
SITL_PORTS = [5760, 5762, 5763]

connected_clients = set()
sitl_writer = None
udp_socket = None
udp_peer = None
mavlink_sequence = 0

drone_state = {
    "latitude": None,
    "longitude": None,
    "altitude": None,
    "speed": None,
    "battery": None,
    "voltage": None,
    "current": None,
    "mode": "UNKNOWN",
    "armed": False,
    "roll": None,
    "pitch": None,
    "yaw": None,
    "heading": None,
    "satellites": None,
    "hdop": None,
    "vehicleType": "GENERIC",
    "vehicleName": "NO VEHICLE",
    "autopilot": "UNKNOWN",
    "bytesRx": 0,
    "bytesTx": 0,
    "packetsPerSec": 0,
    "latencyMs": None,
    "timestamp": 0
    ,"lastHeartbeatAt": 0
    ,"systemId": None
    ,"componentId": None
}

def parse_mavlink(data: bytes):
    """Parses binary MAVLink v1 / v2 packet stream."""
    global drone_state
    if not data or len(data) < 6:
        return

    drone_state["bytesRx"] += len(data)
    drone_state["timestamp"] = int(time.time() * 1000)

    idx = 0
    while idx < len(data):
        magic = data[idx]
        if magic == 0xFE and idx + 8 <= len(data): # MAVLink v1
            length = data[idx + 1]
            if idx + 8 + length > len(data):
                break
            msgid = data[idx + 5]
            sysid, compid = data[idx + 3], data[idx + 4]
            payload = data[idx + 6 : idx + 6 + length]
            handle_msg(msgid, payload, sysid, compid)
            idx += 8 + length
        elif magic == 0xFD and idx + 12 <= len(data): # MAVLink v2
            length = data[idx + 1]
            signature_length = 13 if data[idx + 2] & 1 else 0
            if idx + 12 + length + signature_length > len(data):
                break
            msgid = struct.unpack("<I", data[idx + 7 : idx + 10] + b"\x00")[0]
            sysid, compid = data[idx + 5], data[idx + 6]
            payload = data[idx + 10 : idx + 10 + length]
            handle_msg(msgid, payload, sysid, compid)
            idx += 12 + length + signature_length
        else:
            idx += 1

def handle_msg(msgid: int, payload: bytes, sysid: int, compid: int):
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
        drone_state["systemId"] = sysid
        drone_state["componentId"] = compid
        drone_state["vehicleName"] = f"MAVLink SYS {sysid}"
        drone_state["vehicleType"] = "COPTER" if type_id == 2 else "GENERIC"
        drone_state["autopilot"] = "ARDUPILOT" if ap_id == 3 else "UNKNOWN"
        drone_state["lastHeartbeatAt"] = int(time.time() * 1000)

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
        time_usec, fix_type, lat, lon, alt, eph, epv, vel, cog, satellites_visible = struct.unpack("<QBiiiHHHHB", payload[:30])
        drone_state["satellites"] = satellites_visible
        drone_state["hdop"] = round(eph / 100.0, 2)

    # COMMAND_ACK (#77)
    elif msgid == 77 and len(payload) >= 3:
        command, result = struct.unpack("<HB", payload[:3])
        logger.info("COMMAND_ACK command=%s result=%s", command, result)

def x25_crc(data: bytes, extra: int) -> int:
    crc = 0xFFFF
    for byte in data + bytes([extra]):
        tmp = byte ^ (crc & 0xFF)
        tmp ^= (tmp << 4) & 0xFF
        crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
    return crc

def encode_command_long(command: int, params) -> bytes:
    global mavlink_sequence
    values = list(params[:7]) + [0.0] * (7 - len(params[:7]))
    target_system = drone_state["systemId"]
    target_component = drone_state["componentId"]
    if target_system is None or target_component is None:
        raise RuntimeError("NO_VEHICLE")
    payload = struct.pack("<7fHBBB", *values, command, target_system, target_component, 0)
    header = struct.pack("<BBBBBB", len(payload), 0, 0, mavlink_sequence, 255, 190) + bytes([76, 0, 0])
    mavlink_sequence = (mavlink_sequence + 1) & 0xFF
    checksum = x25_crc(header + payload, 152)
    return b"\xFD" + header + payload + struct.pack("<H", checksum)

async def send_to_vehicle(packet: bytes):
    global sitl_writer, udp_socket, udp_peer
    if sitl_writer is not None:
        sitl_writer.write(packet)
        await sitl_writer.drain()
    elif udp_socket is not None and udp_peer is not None:
        await asyncio.get_running_loop().sock_sendto(udp_socket, packet, udp_peer)
    else:
        raise RuntimeError("NO_MAVLINK_ENDPOINT")
    drone_state["bytesTx"] += len(packet)

async def broadcast_binary(packet: bytes):
    """Relays the exact MAVLink wire bytes; the mobile parser owns validation."""
    for ws in list(connected_clients):
        try:
            await ws.send_bytes(packet)
        except Exception:
            connected_clients.discard(ws)

async def connect_sitl_tcp():
    """Connects to ArduPilot SITL TCP port with auto-reconnect."""
    global sitl_writer
    while True:
        for port in SITL_PORTS:
            writer = None
            try:
                reader, writer = await asyncio.open_connection(SITL_HOST, port)
                sitl_writer = writer
                logger.info(f"CONNECTED TO ARDUPILOT SITL ({SITL_HOST}:{port})!")

                while True:
                    data = await reader.read(4096)
                    if not data:
                        break
                    parse_mavlink(data)
                    await broadcast_binary(data)
            except (ConnectionRefusedError, OSError):
                continue
            except Exception as e:
                logger.warning("SITL bridge error on port %s: %s", port, e)
                break
            finally:
                if writer is not None:
                    if sitl_writer is writer:
                        sitl_writer = None
                    writer.close()
                    try:
                        await writer.wait_closed()
                    except Exception:
                        pass
        await asyncio.sleep(2)

async def listen_udp():
    """Listens on UDP with SO_REUSEADDR."""
    global udp_socket, udp_peer
    loop = asyncio.get_running_loop()
    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    udp_socket.bind(("0.0.0.0", 14550))
    udp_socket.setblocking(False)
    logger.info("Listening for MAVLink UDP packets on port 14550")
    while True:
        data, peer = await loop.sock_recvfrom(udp_socket, 4096)
        if data:
            udp_peer = peer
            parse_mavlink(data)
            await broadcast_binary(data)

async def websocket_handler(request):
    ws = web.WebSocketResponse(max_msg_size=1024 * 1024)
    await ws.prepare(request)
    connected_clients.add(ws)
    logger.info(f"ANITECH GCS App connected from {request.remote}")

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                try:
                    await send_to_vehicle(bytes(msg.data))
                except Exception as error:
                    logger.error("Binary MAVLink forward failed: %s", error)
            elif msg.type == web.WSMsgType.TEXT:
                # Compatibility for old tooling only. The mobile app uses binary.
                try:
                    payload = json.loads(msg.data)
                    if payload.get("type") == "COMMAND_LONG":
                        command = int(payload["command"])
                        logger.info("COMMAND SENT command=%s", command)
                        await send_to_vehicle(encode_command_long(command, payload.get("params", [])))
                except Exception as e:
                    logger.error(f"Error handling app message: {e}")
    finally:
        connected_clients.discard(ws)
        logger.info(f"App disconnected: {request.remote}")
    return ws

async def health_handler(_request):
    heartbeat_age_ms = None
    if drone_state["lastHeartbeatAt"]:
        heartbeat_age_ms = int(time.time() * 1000) - drone_state["lastHeartbeatAt"]
    return web.json_response({
        "ok": True,
        "websocketClients": len(connected_clients),
        "vehicleDetected": drone_state["systemId"] is not None,
        "heartbeatAgeMs": heartbeat_age_ms,
        "udpPeer": list(udp_peer) if udp_peer else None,
    })

async def main():
    # 1. Start WebSocket Server for App
    app = web.Application()
    app.router.add_get("/mavlink", websocket_handler)
    app.router.add_get("/ws", websocket_handler)  # legacy alias
    app.router.add_get("/health", health_handler)
    app.router.add_get("/", lambda r: web.Response(text="ANITECH GCS Binary MAVLink Bridge Running OK"))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", WS_PORT)
    await site.start()
    logger.info(f"WebSocket Bridge running on ws://0.0.0.0:{WS_PORT}/mavlink")

    # 2. Run the vehicle transports. Each received chunk is relayed as binary.
    await asyncio.gather(
        connect_sitl_tcp(),
        listen_udp(),
    )

if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    print("=========================================================")
    print("ANITECH GCS - MAVLink Bridge Server")
    print(f"Connecting to ArduPilot SITL: {SITL_HOST}:5760/5762/5763")
    print(f"Listening on UDP ports: 14550/14551/14555")
    print(f"Serving binary WebSocket for Mobile App: ws://0.0.0.0:{WS_PORT}/mavlink")
    print("=========================================================")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBridge stopped.")
