export interface JoystickSettings {
  deadzone: number; // 0.0 to 1.0
  expo: number; // 0.0 to 1.0 (Curve)
  sensitivity: number; // 0.1 to 2.0
  maxOutput: number; // 0.1 to 1.0
  updateRateHz: number; // e.g. 20Hz
  
  // Note: Safety rules in SETTINGS_PLAN forbid disabling autoCenter and timeouts, 
  // so we don't expose them as booleans here (they are always true in the engine).
}
