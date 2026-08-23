# ANITECH GCS — COMMUNICATION & SYSTEM SETTINGS CENTER

(Saved from user prompt)
The user wants to build a complete Settings Center containing categories:
1. Connection
2. MAVLink
3. Raspberry Pi
4. Video
5. Camera
6. Telemetry
7. Joystick
8. Map
9. Mission
10. Safety
11. Logging
12. Diagnostics
13. System

**Architecture requirements:**
```
src/settings/
├── types/
├── defaults/
├── storage/
├── validation/
├── selectors/
└── SettingsService.ts

src/store/settings/settingsSlice.ts
```

**Current Task:**
1. Audit Project (Phase 1-4, UDP architecture)
2. Build Settings Architecture
3. Build Connection + UDP Settings.
