#!/usr/bin/env python3
"""
================================================================================
ANITECH GCS - MAVLink Interactive Flight Test Server (Pure Python)
================================================================================
Zero-dependency MAVLink simulation & telemetry server.
Allows full end-to-end testing of ANITECH GCS App without any physical drone.
"""

import asyncio
import json
import time
import math
import sys
import socket
import struct
import os
from aiohttp import web

WS_PORT = int(os.environ.get("ANITECH_MAVLINK_TEST_PORT", "8765"))
CRC_EXTRA = {0: 50, 1: 124, 24: 24, 30: 39, 33: 104, 69: 243, 76: 152, 77: 143}
MODE_NUMBER = {"STABILIZE": 0, "ALT_HOLD": 2, "AUTO": 3, "GUIDED": 4, "LOITER": 5, "RTL": 6, "LAND": 9, "POSHOLD": 16, "TAKEOFF": 4}
MODE_NAME = {value: key for key, value in MODE_NUMBER.items()}
mavlink_sequence = 0

# Flight Simulation State
sim_state = {
    "latitude": 10.823099,
    "longitude": 106.629664,
    "altitude": 0.0,
    "target_alt": 0.0,
    "speed": 0.0,
    "battery": 98.5,
    "voltage": 16.2,
    "current": 0.8,
    "mode": "LOITER",
    "armed": False,
    "roll": 0.0,
    "pitch": 0.0,
    "yaw": 0.0,
    "heading": 0,
    "satellites": 18,
    "hdop": 0.7,
    "vehicleType": "COPTER",
    "vehicleName": "ArduCopter V4.5.1 (Python SITL)",
    "autopilot": "ARDUPILOT",
    "bytesRx": 0,
    "bytesTx": 0,
    "packetsPerSec": 20,
    "latencyMs": 12,
    "timestamp": 0
}

connected_clients = set()
total_cmds_received = 0

def log_event(tag, msg):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{tag}] {msg}", flush=True)

def x25_crc(data: bytes, extra: int) -> int:
    crc = 0xFFFF
    for byte in data + bytes([extra]):
        tmp = byte ^ (crc & 0xFF)
        tmp ^= (tmp << 4) & 0xFF
        crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
    return crc

def encode_frame(message_id: int, payload: bytes) -> bytes:
    global mavlink_sequence
    extra = CRC_EXTRA[message_id]
    header = bytes([
        len(payload), 0, 0, mavlink_sequence & 0xFF, 1, 1,
        message_id & 0xFF, (message_id >> 8) & 0xFF, (message_id >> 16) & 0xFF,
    ])
    mavlink_sequence = (mavlink_sequence + 1) & 0xFF
    crc = x25_crc(header + payload, extra)
    return b"\xFD" + header + payload + struct.pack("<H", crc)

def encode_ack(command: int, result: int = 0) -> bytes:
    return encode_frame(77, struct.pack("<HBBiBB", command, result, 100, 0, 255, 190))

def telemetry_packet(tick: int, hover_roll: float, hover_pitch: float) -> bytes:
    frames = []
    boot_ms = tick * 50
    attitude = struct.pack(
        "<Iffffff", boot_ms, math.radians(hover_roll), math.radians(hover_pitch),
        math.radians(sim_state["yaw"]), 0.0, 0.0, 0.0,
    )
    frames.append(encode_frame(30, attitude))

    if tick % 4 == 0:
        heading = int(sim_state["heading"] * 100) % 36000
        speed_cms = int(sim_state["speed"] * 100)
        position = struct.pack(
            "<IiiiihhhH", boot_ms, int(sim_state["latitude"] * 1e7),
            int(sim_state["longitude"] * 1e7), int(sim_state["altitude"] * 1000),
            int(sim_state["altitude"] * 1000), speed_cms, 0, 0, heading,
        )
        frames.append(encode_frame(33, position))

    if tick % 10 == 0:
        sensors = 0x2000000 | 0x20 | 0x01 | 0x02 | 0x04 | 0x08
        battery = max(0, min(100, round(sim_state["battery"])))
        status = struct.pack(
            "<IIIHHhb", sensors, sensors, sensors, 200,
            int(sim_state["voltage"] * 1000), int(sim_state["current"] * 100), battery,
        ) + bytes(12)
        frames.append(encode_frame(1, status))
        gps = struct.pack(
            "<QiiiHHHHBB", int(time.time() * 1_000_000), int(sim_state["latitude"] * 1e7),
            int(sim_state["longitude"] * 1e7), int(sim_state["altitude"] * 1000),
            int(sim_state["hdop"] * 100), 100, int(sim_state["speed"] * 100),
            int(sim_state["heading"] * 100) % 36000, 3, sim_state["satellites"],
        )
        frames.append(encode_frame(24, gps))

    if tick % 20 == 0:
        base_mode = 0x80 if sim_state["armed"] else 0
        heartbeat = struct.pack(
            "<IBBBBB", MODE_NUMBER.get(sim_state["mode"], 5), 2, 3, base_mode, 4, 3,
        )
        frames.append(encode_frame(0, heartbeat))
    return b"".join(frames)

async def handle_binary_message(packet: bytes, ws):
    global total_cmds_received
    total_cmds_received += 1
    sim_state["bytesRx"] += len(packet)
    offset = 0
    while offset + 12 <= len(packet):
        if packet[offset] != 0xFD:
            offset += 1
            continue
        payload_length = packet[offset + 1]
        frame_length = 12 + payload_length + (13 if packet[offset + 2] & 1 else 0)
        if offset + frame_length > len(packet):
            break
        message_id = packet[offset + 7] | packet[offset + 8] << 8 | packet[offset + 9] << 16
        payload = packet[offset + 10:offset + 10 + payload_length]
        if message_id == 76 and len(payload) >= 33:
            params = struct.unpack("<7f", payload[:28])
            command = struct.unpack("<H", payload[28:30])[0]
            if command == 400:
                sim_state["armed"] = params[0] >= 0.5
            elif command == 22:
                sim_state["target_alt"] = max(0.0, params[6])
                sim_state["mode"] = "TAKEOFF"
            elif command == 21:
                sim_state["mode"] = "LAND"
                sim_state["target_alt"] = 0.0
            elif command == 20:
                sim_state["mode"] = "RTL"
            elif command == 176:
                sim_state["mode"] = MODE_NAME.get(round(params[1]), sim_state["mode"])
            if command != 511:
                log_event("MAVLink CMD", f"COMMAND_LONG {command} accepted")
            await ws.send_bytes(encode_ack(command))
        elif message_id == 69 and len(payload) >= 11 and sim_state["armed"]:
            pitch, roll, throttle, yaw, _buttons, _target = struct.unpack("<hhhhHB", payload[:11])
            sim_state["pitch"] = pitch / 1000 * 35
            sim_state["roll"] = roll / 1000 * 35
            sim_state["yaw"] = (sim_state["yaw"] + yaw / 1000 * 4) % 360
            sim_state["heading"] = round(sim_state["yaw"])
            if throttle > 550:
                sim_state["altitude"] += (throttle / 1000 - 0.5) * 0.8
            elif throttle < 450:
                sim_state["altitude"] = max(0.0, sim_state["altitude"] - (0.5 - throttle / 1000) * 0.8)
            sim_state["speed"] = math.hypot(pitch, roll) / 1000 * 12
        offset += frame_length

async def handle_client_message(data_str: str):
    global sim_state, total_cmds_received
    total_cmds_received += 1
    sim_state["bytesRx"] += len(data_str)

    try:
        msg = json.loads(data_str)
    except Exception:
        return

    msg_type = msg.get("type")
    
    # 1. Flight Commands (ARM / DISARM / TAKEOFF / LAND / RTL / SET_MODE)
    if msg_type == "COMMAND":
        cmd = msg.get("command")
        payload = msg.get("payload", {})
        
        if cmd == "ARM":
            sim_state["armed"] = True
            log_event("MAVLink CMD", "ARM RECEIVED -> Motors Armed! (Ready for Flight)")
        elif cmd == "DISARM":
            sim_state["armed"] = False
            sim_state["speed"] = 0.0
            log_event("MAVLink CMD", "DISARM RECEIVED -> Motors Stopped.")
        elif cmd == "TAKEOFF":
            target = payload.get("altitude", 10.0) if isinstance(payload, dict) else 10.0
            sim_state["target_alt"] = float(target)
            sim_state["mode"] = "TAKEOFF"
            sim_state["armed"] = True
            log_event("MAVLink CMD", f"TAKEOFF RECEIVED -> Climbing to {target}m...")
        elif cmd == "LAND":
            sim_state["mode"] = "LAND"
            sim_state["target_alt"] = 0.0
            log_event("MAVLink CMD", "LAND RECEIVED -> Descending to ground...")
        elif cmd == "RTL":
            sim_state["mode"] = "RTL"
            sim_state["target_alt"] = 15.0
            log_event("MAVLink CMD", "RTL (RETURN TO LAUNCH) RECEIVED -> Returning to Home...")
        elif cmd == "SET_MODE":
            new_mode = payload.get("mode", "LOITER") if isinstance(payload, dict) else "LOITER"
            sim_state["mode"] = new_mode
            log_event("MAVLink CMD", f"FLIGHT MODE CHANGED -> {new_mode}")
        elif cmd == "JOYSTICK":
            input_data = payload.get("input", {}) if isinstance(payload, dict) else {}
            pitch_val = input_data.get("pitch", 0.0)
            roll_val = input_data.get("roll", 0.0)
            yaw_val = input_data.get("yaw", 0.0)
            thr_val = input_data.get("throttle", 0.5)

            # Apply stick physics to attitude
            sim_state["pitch"] = round(pitch_val * 35.0, 1)
            sim_state["roll"] = round(roll_val * 35.0, 1)
            
            # Integrate yaw
            sim_state["yaw"] = round(((sim_state["yaw"] + yaw_val * 4.0) % 360 + 360) % 360, 1)
            sim_state["heading"] = int(sim_state["yaw"])

            # Throttle altitude change
            if thr_val > 0.55:
                sim_state["altitude"] = round(sim_state["altitude"] + (thr_val - 0.5) * 0.8, 1)
            elif thr_val < 0.45:
                sim_state["altitude"] = max(0.0, round(sim_state["altitude"] - (0.5 - thr_val) * 0.8, 1))

            stick_mag = math.sqrt(pitch_val**2 + roll_val**2)
            sim_state["speed"] = round(max(0.0, stick_mag * 12.0), 1)

            # Log periodic stick updates (throttled in console)
            if total_cmds_received % 10 == 0:
                log_event("JOYSTICK RC", f"Pitch: {sim_state['pitch']} deg | Roll: {sim_state['roll']} deg | Heading: {sim_state['heading']} deg | Alt: {sim_state['altitude']}m | Thr: {int(thr_val*100)}%")

async def physics_and_broadcast_loop():
    """Simulates realistic flight physics & broadcasts 20Hz MAVLink telemetry."""
    tick = 0
    while True:
        await asyncio.sleep(0.05) # 20 Hz
        tick += 1

        # Smooth takeoff/landing physics
        if sim_state["mode"] == "TAKEOFF" and sim_state["armed"]:
            if sim_state["altitude"] < sim_state["target_alt"]:
                sim_state["altitude"] = round(min(sim_state["target_alt"], sim_state["altitude"] + 0.35), 1)
                sim_state["speed"] = 2.8
            else:
                sim_state["mode"] = "LOITER"
                log_event("FLIGHT STATE", f"Reached target altitude {sim_state['altitude']}m. Hovering in LOITER.")
        elif sim_state["mode"] == "LAND":
            if sim_state["altitude"] > 0:
                sim_state["altitude"] = round(max(0.0, sim_state["altitude"] - 0.25), 1)
                sim_state["speed"] = 1.2
            else:
                sim_state["armed"] = False
                sim_state["speed"] = 0.0
                sim_state["mode"] = "LOITER"
                log_event("FLIGHT STATE", "Touchdown! Landed successfully and Disarmed.")

        # In flight: slight natural gentle hovering motion (+-0.5 deg)
        hover_roll = sim_state["roll"]
        hover_pitch = sim_state["pitch"]
        if sim_state["armed"] and sim_state["altitude"] > 0:
            hover_roll += math.sin(tick * 0.08) * 0.6
            hover_pitch += math.cos(tick * 0.06) * 0.4
            # Advance GPS position forward with heading & speed
            hdg_rad = math.radians(sim_state["yaw"])
            sim_state["latitude"] += math.cos(hdg_rad) * sim_state["speed"] * 0.0000003
            sim_state["longitude"] += math.sin(hdg_rad) * sim_state["speed"] * 0.0000003

        # Battery discharge simulation
        if sim_state["armed"]:
            sim_state["battery"] = max(5.0, round(sim_state["battery"] - 0.003, 1))

        sim_state["timestamp"] = int(time.time() * 1000)
        packet = telemetry_packet(tick, hover_roll, hover_pitch)
        sim_state["bytesTx"] += len(packet)

        if connected_clients:
            for ws in list(connected_clients):
                try:
                    await ws.send_bytes(packet)
                except Exception:
                    connected_clients.discard(ws)

async def websocket_handler(request):
    ws = web.WebSocketResponse(max_msg_size=1024 * 1024)
    await ws.prepare(request)
    connected_clients.add(ws)
    client_ip = request.remote
    log_event("CLIENT CONNECTED", f"ANITECH GCS App connected from {client_ip}!")

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                await handle_binary_message(bytes(msg.data), ws)
            elif msg.type == web.WSMsgType.TEXT:
                await handle_client_message(msg.data)
    finally:
        connected_clients.discard(ws)
        log_event("CLIENT DISCONNECTED", f"App disconnected ({client_ip})")
    return ws

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

async def main():
    app = web.Application()
    app.router.add_get("/mavlink", websocket_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/health", lambda r: web.json_response({"ok": True, "clients": len(connected_clients)}))
    app.router.add_get("/", lambda r: web.Response(text="ANITECH GCS Binary MAVLink Test Server Running OK"))
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", WS_PORT)
    await site.start()

    local_ip = get_local_ip()
    print("=" * 70, flush=True)
    print("ANITECH GCS - MAVLINK INTERACTIVE FLIGHT TEST SERVER", flush=True)
    print("=" * 70, flush=True)
    print(f"Binary WebSocket Address : ws://{local_ip}:{WS_PORT}/mavlink", flush=True)
    print(f"For Real Phone / Tablet  : Enter '{local_ip}' in App Settings -> CONNECTION", flush=True)
    print(f"For Android Emulator     : Enter '10.0.2.2' in App Settings -> CONNECTION", flush=True)
    print("=" * 70, flush=True)
    print("Waiting for ANITECH GCS connection... (Press Ctrl+C to stop)\n", flush=True)

    await physics_and_broadcast_loop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped.")
