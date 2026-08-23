export const AppConfig = {
  // Network
  DRONE_GATEWAY_HOST: '192.168.1.100',
  DRONE_GATEWAY_PORT: 5000,
  VIDEO_STREAM_URL: 'http://192.168.1.100:8080/stream',
  
  // Timeouts
  CONNECTION_TIMEOUT: 5000, // 5 seconds without heartbeat -> disconnected
  TELEMETRY_TIMEOUT: 2000, // 2 seconds without telemetry -> stale
  COMMAND_TIMEOUT: 1000, // 1 second without new command -> neutralize
  COMMAND_DUPLICATE_WINDOW_MS: 1000, // Reject duplicate commands within 1 second
  
  // Joystick
  JOYSTICK_RATE: 50, // 50ms per command (20Hz)
  JOYSTICK_DEADZONE: 0.05,
  JOYSTICK_EXPO: 0.3,
  JOYSTICK_SENSITIVITY: 1.0,
  JOYSTICK_UPDATE_RATE_HZ: 20,
  JOYSTICK_COMMAND_TIMEOUT_MS: 500,
  
  // Warnings
  LOW_BATTERY_THRESHOLD: 20, // 20%
};
