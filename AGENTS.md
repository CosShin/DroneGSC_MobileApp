# AGENTS.md — ANITECH GCS

## 1. Project Identity

Project: ANITECH GCS

ANITECH GCS is a mobile Ground Control Station for real UAV/drone operation.

Primary target:

- ArduPilot
- Pixhawk
- Raspberry Pi companion computer
- Android
- iOS
- Landscape-first mobile UI

The application is NOT a demo dashboard.

It may control real aircraft.

Changes affecting vehicle commands, MAVLink, joystick output, missions,
failsafes, connection state, or telemetry must be treated as safety-critical.

---

# 2. Read Before Editing

Before modifying code:

1. Inspect the existing implementation.
2. Understand the current architecture.
3. Find the real source of truth.
4. Search for existing services/components before creating new ones.
5. Preserve existing behavior unless the task explicitly requires changing it.
6. Never rewrite a working subsystem just because another design looks cleaner.
7. Run typecheck/tests/build after meaningful changes.

Do not guess architecture from filenames.

Read the code.

---

# 3. Core Engineering Rules

## 3.1 Truthful Telemetry

The UI must NEVER display fake or default flight data.

Do not hardcode values such as:

- CONNECTED
- GPS 17
- Battery 99%
- STABILIZE
- LOITER
- 0.0 m
- Heading 000°
- Link 100%

unless those values were actually received from the vehicle.

Unknown telemetry must use states such as:

- null
- UNKNOWN
- --
- NO FIX
- NO VEHICLE
- WAITING

Example:

If heading has never been received:

show:

--°

NOT:

000°

If battery has never been received:

show:

--

NOT:

0%
or
100%.

---

# 4. Connection State Must Be Layered

Do not treat all connection states as the same thing.

Maintain independent concepts:

## Transport

- DISCONNECTED
- CONNECTING
- CONNECTED
- ERROR

Examples:

- UDP socket
- TCP socket
- WebSocket
- USB Serial

## MAVLink

- WAITING
- ACTIVE
- ERROR

## Vehicle

- NO_VEHICLE
- HEARTBEAT_ACTIVE
- HEARTBEAT_LOST

## Video

- OFFLINE
- CONNECTING
- LIVE
- ERROR

Important:

Transport CONNECTED does NOT mean Vehicle CONNECTED.

Example:

WebSocket connected
+
No HEARTBEAT

must display:

Gateway Connected
Vehicle Waiting

not:

Drone Connected.

---

# 5. MAVLink Architecture

There must be ONE MAVLink core.

All transports must feed bytes into the same MAVLink parser.

Expected architecture:

Transport
    ↓
MAVLink Parser
    ↓
Vehicle / Telemetry / Commands / Mission
    ↓
Redux / Application State
    ↓
UI

Outgoing:

UI
    ↓
Safety Layer
    ↓
Command Service
    ↓
MAVLink Encoder
    ↓
Transport

Do NOT create separate MAVLink implementations for:

- UDP
- TCP
- Serial
- WebSocket

Transport handles byte movement.

MAVLink Core handles MAVLink.

---

# 6. Supported Vehicle Transports

Target transport architecture:

- WebSocket / WSS
- UDP
- TCP
- USB Serial

Existing Pi Gateway support must remain compatible.

Network technologies such as:

- Wi-Fi
- Ethernet
- 4G
- Tailscale
- WireGuard
- VPN

are NOT MAVLink protocols.

They are network paths underneath transports.

Do not create a "4G MAVLink protocol".

---

# 7. Video Architecture

Video is independent from MAVLink.

Supported/planned video providers:

- WebRTC
- RTSP

Architecture:

VideoManager
    ├── WebRTC Provider
    └── RTSP Provider

Do not derive:

Vehicle Connected

from:

Video Live.

Valid combinations include:

MAVLink ACTIVE + Video LIVE
MAVLink ACTIVE + Video OFFLINE
MAVLink OFFLINE + Video LIVE
MAVLink OFFLINE + Video OFFLINE

---

# 8. Flight View

Fly uses an adaptive Flight View.

Primary views:

- FLIGHT
- MAP

FLIGHT contains:

- HUD
- VIDEO

Behavior:

If no camera/video stream exists:
→ HUD remains fully usable.

If video is available:
→ VIDEO is available.

The user must be able to manually switch:

HUD ↔ VIDEO

Do not make camera availability mandatory for operating the GCS.

Video failure must never leave the user with an unusable black control screen.

Fallback to HUD where appropriate.

---

# 9. WebRTC Lifecycle

Do not reconnect WebRTC unnecessarily.

Switching:

HUD → VIDEO
VIDEO → HUD
VIDEO → MAP
MAP → VIDEO

must not recreate the peer connection unless technically necessary.

Do not mount/unmount the video transport just because a UI tab changed.

Telemetry state updates must not reconnect video.

---

# 10. Map Lifecycle

Do not recreate the map on every telemetry update.

Do not reset:

- zoom
- center
- selected waypoint
- mission route

when switching between HUD / VIDEO / MAP unless explicitly requested.

Phone location and Vehicle location are different data sources.

Never use phone position as vehicle position.

---

# 11. Flight Commands

The following are safety-critical:

- ARM
- DISARM
- TAKEOFF
- LAND
- RTL
- SET_MODE
- Mission Start
- Joystick control

Never bypass safety validation.

Never mark a command successful just because:

socket.send()

or equivalent succeeds.

Command success must follow the existing command/ACK/state-confirmation architecture.

Where MAVLink COMMAND_ACK applies, honor it.

---

# 12. Mode Changes

Do not optimistically change the UI mode just because the user pressed a mode button.

Example:

User presses LOITER.

Do not immediately treat the vehicle as LOITER unless the vehicle confirms the state through the expected MAVLink state/heartbeat behavior.

---

# 13. Joystick Safety

Joystick commands are safety-critical.

Verify behavior for:

- finger release
- touch cancel
- app background
- connection loss
- screen changes
- component unmount
- orientation changes

Never leave stale joystick commands active.

Do not change joystick MAVLink mapping unless explicitly requested.

Visual joystick opacity/fade must never change actual control output.

---

# 14. Mission Protocol

Do not treat the mission editor model as identical to MAVLink Mission Items.

Use clear separation between:

Editor Model

and

MAVLink Mission Model.

Mission upload must correctly use the MAVLink mission transaction.

Expected flow:

MISSION_COUNT
→ MISSION_REQUEST_INT
→ MISSION_ITEM_INT
→ ...
→ MISSION_ACK

Do not display Upload Success until the mission transaction is actually accepted.

Mission download must use the corresponding mission protocol.

---

# 15. Mission Speed

Important:

ArduCopter NAV_WAYPOINT does not simply contain a generic per-waypoint speed field.

If the editor supports:

Speed from this point

the mission compiler must represent it using the appropriate MAVLink command, such as:

MAV_CMD_DO_CHANGE_SPEED

where applicable.

Do not keep a UI-only `speed` property and pretend the autopilot will use it.

---

# 16. MAVLink Inspector

Vehicle contains/plans a MAVLink Inspector.

The inspector is READ-ONLY diagnostics by default.

It may observe:

- RX packets
- TX packets
- message names
- SYSID
- COMPID
- command packets
- ACK
- mission traffic
- CRC/parser errors
- packet rates

It must NOT generate additional MAVLink traffic merely to display diagnostics.

Packet buffers must be bounded.

Do not store unlimited packet history.

---

# 17. Telemetry Traffic

Do not blindly reduce MAVLink traffic because packet rate appears high.

Example:

160 packets/s is not automatically an error.

Investigate:

- RX rate
- TX rate
- parser rate
- queue depth
- event loop lag
- duplicate SET_MESSAGE_INTERVAL
- duplicate listeners
- reconnect leaks

Reconnect must not multiply message subscriptions.

Test connect/disconnect multiple times where connection work is modified.

---

# 18. Notification / Connection Separation

Notifications, toasts, warnings and UI overlays must never own the vehicle connection lifecycle.

ConnectionManager / transport services must remain persistent and headless.

Opening:

- warning
- modal
- Vehicle
- Settings
- dialog

must not unintentionally:

- disconnect socket
- remove MAVLink listeners
- reset telemetry
- remount ConnectionManager

---

# 19. Battery / Telemetry Freshness

Different messages arrive at different rates.

Do not apply one tiny stale timeout to all telemetry.

Example:

ATTITUDE may arrive around tens of Hz.

BATTERY_STATUS may arrive much slower.

Battery should not flicker to `--` merely because one short update interval was missed.

Stale thresholds must be message-appropriate.

Do not hide genuine stale data either.

---

# 20. Mobile Platform Rules

Primary targets:

- Android
- iOS

Test landscape layouts.

Important iOS concerns:

- safe area
- notch
- Dynamic Island
- WebKit stacking contexts
- backdrop-filter
- z-index
- pointer-events

Global navigation/logo must remain accessible on all screens.

Do not solve platform bugs with random:

z-index: 999999

or user-agent hacks unless absolutely necessary and justified.

Fix the actual layout/lifecycle issue.

---

# 21. Global Navigation

ANITECH logo is the persistent navigation entry point.

Navigation includes:

- Fly
- Plan
- Vehicle
- Settings

The logo must remain accessible on:

- Fly
- Plan
- Vehicle
- Settings
- configuration panels
- diagnostic screens

Do not create a dead-end screen.

---

# 22. UI Design Language

Current ANITECH visual direction:

- light
- translucent
- frosted glass
- white / light blue
- clean aviation UI
- minimal
- modern
- professional

Avoid:

- heavy navy surfaces
- gaming UI
- cyberpunk UI
- giant opaque bars
- unnecessary shadows

Map/video should remain visually dominant.

UI overlays should float above them.

---

# 23. Glass Components

Reuse design tokens/components.

Prefer reusable abstractions such as:

- GlassBar
- GlassPill
- GlassPanel
- GlassActionBar
- GlassSegmentedControl
- GlassIconButton

Do not duplicate different rgba/blur values everywhere.

Readability is more important than transparency.

---

# 24. Performance Rules

High-frequency telemetry must not cause the entire application to rerender.

Isolate components such as:

- AttitudeIndicator
- BatteryIndicator
- GPSIndicator
- HeadingIndicator
- VideoRenderer
- MapRenderer

Do not cause:

ATTITUDE 20 Hz
→ entire Fly screen render
→ Video render
→ Map render
→ navigation render

Optimize selectors and component boundaries.

---

# 25. Resource Cleanup

Whenever modifying sockets, video, map or telemetry:

verify cleanup of:

- listeners
- intervals
- timers
- sockets
- WebRTC peer connections
- subscriptions

Test repeated:

connect/disconnect
screen switching
HUD/VIDEO/MAP switching

Do not introduce resource leaks.

---

# 26. USB Serial

USB Serial support must be truthful.

Android may support USB OTG through native implementation.

Do not claim identical support on iOS without evidence.

Unsupported capability should display:

UNSUPPORTED

or:

NOT AVAILABLE

not a fake working control.

---

# 27. Native / Expo Constraints

Do not assume every networking API works in Expo Go.

Before adding:

UDP
TCP
USB Serial
RTSP

verify whether the project requires:

- Expo development build
- custom native module
- native dependency

Document native requirements.

Do not add UI claiming a feature is available if the runtime cannot execute it.

---

# 28. MAVLink 2 Signing

MAVLink signing keys are sensitive.

Never:

- log signing keys
- store them in Redux
- expose them in diagnostics
- include them in screenshots
- commit them to the repository

Use secure platform storage where available.

MAVLink signing is not the same as:

WSS
TLS
VPN

Keep these security layers separate.

---

# 29. Secrets

Never commit:

- signing keys
- API keys
- private credentials
- passwords
- production tokens

Use environment variables and secure storage.

Before committing, inspect the diff for secrets.

---

# 30. File Changes

Prefer the smallest safe change.

Do not modify unrelated files.

Before deleting a file:

verify it is truly unused.

Do not leave:

- duplicate services
- abandoned components
- unused imports
- dead experiments

after refactoring.

---

# 31. Tests Required

At minimum after code changes:

- TypeScript/typecheck
- lint if available
- relevant unit tests
- production build where practical

For transport changes:

also test lifecycle.

For flight safety changes:

prefer:

1. unit test
2. SITL
3. bench Pixhawk with props removed
4. controlled real flight only after validation

Never use real flight as the first test.

---

# 32. Test Result Language

Use:

PASS
FAIL
PARTIAL
NOT TESTED
BLOCKED
UNSUPPORTED

Do not report PASS when something was only inspected statically.

Do not claim real-device support without real-device evidence.

---

# 33. Git Rules

Before large changes:

inspect git status.

Do not destroy unrelated user changes.

Do not:

git reset --hard

unless the user explicitly approves it.

Keep changes scoped.

Commit messages should describe actual work.

---

# 34. Multi-Agent Workflow

When operating as an implementation agent:

read:

AGENTS.md

and any assigned task under:

.ai/tasks/

Only implement the assigned task.

Do not redesign unrelated systems.

When operating as reviewer/auditor:

do not modify production source unless explicitly authorized.

Reviewer output should include:

- issue
- severity
- evidence
- root cause
- recommended fix
- files involved
- acceptance test

---

# 35. Definition of Done

A task is not complete merely because the UI looks correct.

A task is complete when:

- implementation matches requirements
- no fake state introduced
- safety behavior preserved
- lifecycle handled correctly
- no obvious resource leak
- tests pass
- build passes where required
- platform limitations are documented truthfully

For connection features:

Socket Open

is NOT enough.

Expected chain:

Transport Connected
→ MAVLink bytes received
→ valid frames parsed
→ HEARTBEAT received
→ SYSID/COMPID resolved
→ telemetry received

Only then can the vehicle connection be considered active.

---

# 36. Final Rule

This application can control a real aircraft.

When uncertain between:

"make the UI look connected"

and

"report the real state"

always report the real state.

When uncertain between:

"make command look successful"

and

"wait for actual vehicle confirmation"

wait for actual vehicle confirmation.

Safety and truthfulness override cosmetic convenience.