import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { JoystickInput, FlightControlInput } from '../../types/joystick';
import { InputMapper } from './InputMapper';
import { AppConfig } from '../../config';
import { safetyLayer } from '../command/SafetyLayer';
import { buildReleasedStickNeutralFrame, type JoystickSide } from './JoystickNeutralFrames';
import { createDevDiagnostics } from '../../utils/devDiagnostics';

export type FlightControlListener = (input: FlightControlInput) => void;

const devLog = createDevDiagnostics('JOYSTICK', { minIntervalMs: 250, maxPerKey: 240 });

export class JoystickProcessor {
  private leftStick: JoystickInput = { x: 0, y: 0, active: false, timestamp: 0 };
  private rightStick: JoystickInput = { x: 0, y: 0, active: false, timestamp: 0 };
  private output: FlightControlInput = {
    roll: 0,
    pitch: 0,
    yaw: 0,
    throttle: 0.5,
    validAxes: { roll: false, pitch: false, yaw: false, throttle: false },
    timestamp: 0,
  };
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private listeners: FlightControlListener[] = [];
  private hadActiveInput = false;
  private txWindowStartedAt = Date.now();
  private txPacketsInWindow = 0;
  private lastTxAt = 0;

  updateLeftStick(x: number, y: number, active: boolean) {
    const wasActive = this.hasActiveInput();
    const releasedWhileRightActive = this.leftStick.active && !active && this.rightStick.active;
    this.leftStick = { x, y, active, timestamp: Date.now() };
    devLog('left-input', { yawRaw: x, throttleRaw: y, active, rightActive: this.rightStick.active });
    if (releasedWhileRightActive) this.sendReleasedStickNeutralFrame('LEFT');
    this.handleActivityTransition(wasActive);
  }

  updateRightStick(x: number, y: number, active: boolean) {
    const wasActive = this.hasActiveInput();
    const releasedWhileLeftActive = this.rightStick.active && !active && this.leftStick.active;
    this.rightStick = { x, y, active, timestamp: Date.now() };
    devLog('right-input', { rollRaw: x, pitchRaw: -y, active, leftActive: this.leftStick.active });
    if (releasedWhileLeftActive) this.sendReleasedStickNeutralFrame('RIGHT');
    this.handleActivityTransition(wasActive);
  }

  onProcessedInput(listener: FlightControlListener) {
    this.listeners.push(listener);
    devLog('listener-add', { count: this.listeners.length });
    return () => {
      this.listeners = this.listeners.filter(value => value !== listener);
      devLog('listener-remove', { count: this.listeners.length });
    };
  }

  start() {
    if (this.intervalId) return;
    this.appState = AppState.currentState;
    devLog('start', { updateRateHz: AppConfig.JOYSTICK_UPDATE_RATE_HZ, appState: this.appState });
    this.appStateSubscription = AppState.addEventListener('change', state => {
      devLog('appstate', { previous: this.appState, next: state });
      this.appState = state;
      if (state !== 'active') this.releaseInputs();
    });
    this.intervalId = setInterval(() => this.tick(), 1000 / AppConfig.JOYSTICK_UPDATE_RATE_HZ);
  }

  stop() {
    devLog('stop', { txPacketsInWindow: this.txPacketsInWindow, lastTxAgeMs: this.lastTxAt ? Date.now() - this.lastTxAt : null });
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.releaseInputs();
  }

  private tick() {
    const now = Date.now();
    if (this.appState !== 'active') {
      this.releaseInputs();
      return;
    }

    this.expireStaleStickInputs(now);
    if (!this.hasActiveInput()) {
      if (this.hadActiveInput) this.sendNeutralFrame();
      return;
    }
    this.hadActiveInput = true;

    const target = InputMapper.mapInputs(this.leftStick, this.rightStick);
    const alpha = 0.35;
    this.output = {
      roll: this.output.roll + (target.roll - this.output.roll) * alpha,
      pitch: this.output.pitch + (target.pitch - this.output.pitch) * alpha,
      yaw: this.output.yaw + (target.yaw - this.output.yaw) * alpha,
      throttle: this.output.throttle + (target.throttle - this.output.throttle) * alpha,
      validAxes: target.validAxes,
      timestamp: now,
    };
    this.listeners.forEach(listener => listener(this.output));
    this.executeJoystickCommand(this.output, { deadmanActive: true }, 'deadman');
  }

  private releaseInputs() {
    const now = Date.now();
    this.leftStick = { x: 0, y: 0, active: false, timestamp: now };
    this.rightStick = { x: 0, y: 0, active: false, timestamp: now };
    if (this.hadActiveInput) {
      this.sendNeutralFrame(now);
      return;
    }
    this.output = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      throttle: 0.5,
      validAxes: { roll: false, pitch: false, yaw: false, throttle: false },
      timestamp: now,
    };
    this.listeners.forEach(listener => listener(this.output));
  }

  private hasActiveInput() {
    return this.leftStick.active || this.rightStick.active;
  }

  private handleActivityTransition(wasActive: boolean) {
    if (this.hasActiveInput()) {
      this.hadActiveInput = true;
    } else if (wasActive && this.hadActiveInput) {
      this.sendNeutralFrame();
    }
  }

  private expireStaleStickInputs(now: number) {
    const leftExpired = this.leftStick.active && now - this.leftStick.timestamp > AppConfig.JOYSTICK_COMMAND_TIMEOUT_MS;
    const rightExpired = this.rightStick.active && now - this.rightStick.timestamp > AppConfig.JOYSTICK_COMMAND_TIMEOUT_MS;
    const rightStillActive = this.rightStick.active && !rightExpired;
    const leftStillActive = this.leftStick.active && !leftExpired;

    if (leftExpired) {
      this.leftStick = { x: 0, y: 0, active: false, timestamp: now };
      if (rightStillActive) this.sendReleasedStickNeutralFrame('LEFT', now);
    }
    if (rightExpired) {
      this.rightStick = { x: 0, y: 0, active: false, timestamp: now };
      if (leftStillActive) this.sendReleasedStickNeutralFrame('RIGHT', now);
    }
  }

  private sendReleasedStickNeutralFrame(side: JoystickSide, timestamp = Date.now()) {
    const neutralFrame = buildReleasedStickNeutralFrame(this.output, side, timestamp);
    const hasReleasedAxis = Object.values(neutralFrame.validAxes).some(Boolean);
    if (!hasReleasedAxis) return;
    if (side === 'LEFT') {
      this.output = {
        ...this.output,
        yaw: 0,
        throttle: 0.5,
        validAxes: { ...this.output.validAxes, yaw: false, throttle: false },
        timestamp,
      };
    } else {
      this.output = {
        ...this.output,
        roll: 0,
        pitch: 0,
        validAxes: { ...this.output.validAxes, roll: false, pitch: false },
        timestamp,
      };
    }
    this.listeners.forEach(listener => listener(neutralFrame));
    this.executeJoystickCommand(neutralFrame, { finalNeutral: true }, `neutral-${side.toLowerCase()}`);
  }

  private sendNeutralFrame(timestamp = Date.now()) {
    this.hadActiveInput = false;
    // Neutralise exactly the axes that were previously commanded. MAVLink's
    // INT16_MAX means "ignore this axis"; using it for every release would not
    // overwrite the aircraft's last accepted values.
    const releasedAxes = { ...this.output.validAxes };
    this.output = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      throttle: 0.5,
      validAxes: releasedAxes,
      timestamp,
    };
    this.listeners.forEach(listener => listener(this.output));
    this.executeJoystickCommand(this.output, { finalNeutral: true }, 'neutral-all');
  }

  private executeJoystickCommand(
    input: FlightControlInput,
    options: { deadmanActive?: boolean; finalNeutral?: boolean },
    reason: string,
  ) {
    const now = Date.now();
    if (now - this.txWindowStartedAt >= 1000) {
      this.txWindowStartedAt = now;
      this.txPacketsInWindow = 0;
    }
    this.txPacketsInWindow++;
    this.lastTxAt = now;
    devLog('tx', {
      reason,
      roll: input.roll,
      pitch: input.pitch,
      yaw: input.yaw,
      throttle: input.throttle,
      validAxes: input.validAxes,
      txPps: this.txPacketsInWindow,
      lastPacketAgeMs: 0,
      listeners: this.listeners.length,
      options,
    });
    safetyLayer.executeJoystickCommand(input, options);
  }
}

export const joystickProcessor = new JoystickProcessor();
