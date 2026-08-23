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
from aiohttp import web

WS_PORT = 8088

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
        sim_state["bytesTx"] += 140

        if connected_clients:
            telemetry_payload = json.dumps({
                "type": "TELEMETRY",
                "data": {
                    **sim_state,
                    "roll": round(hover_roll, 1),
                    "pitch": round(hover_pitch, 1),
                }
            })

            for ws in list(connected_clients):
                try:
                    await ws.send_str(telemetry_payload)
                except Exception:
                    pass

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    connected_clients.add(ws)
    client_ip = request.remote
    log_event("CLIENT CONNECTED", f"ANITECH GCS App connected from {client_ip}!")

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                await handle_client_message(msg.data)
    finally:
        connected_clients.remove(ws)
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
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/", lambda r: web.Response(text="ANITECH GCS MAVLink Test Server Running OK"))
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", WS_PORT)
    await site.start()

    local_ip = get_local_ip()
    print("=" * 70, flush=True)
    print("ANITECH GCS - MAVLINK INTERACTIVE FLIGHT TEST SERVER", flush=True)
    print("=" * 70, flush=True)
    print(f"WebSocket Server Address : ws://{local_ip}:{WS_PORT}/ws", flush=True)
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
