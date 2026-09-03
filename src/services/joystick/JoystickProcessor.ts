import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { JoystickInput, FlightControlInput } from '../../types/joystick';
import { InputMapper } from './InputMapper';
import { AppConfig } from '../../config';
import { safetyLayer } from '../command/SafetyLayer';

export type FlightControlListener = (input: FlightControlInput) => void;

class JoystickProcessor {
  private leftStick: JoystickInput = { x: 0, y: 0, active: false, timestamp: 0 };
  private rightStick: JoystickInput = { x: 0, y: 0, active: false, timestamp: 0 };
  private output: FlightControlInput = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5, timestamp: 0 };
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private listeners: FlightControlListener[] = [];
  private hadActiveInput = false;

  updateLeftStick(x: number, y: number, active: boolean) {
    const wasActive = this.hasActiveInput();
    this.leftStick = { x, y, active, timestamp: Date.now() };
    this.handleActivityTransition(wasActive);
  }

  updateRightStick(x: number, y: number, active: boolean) {
    const wasActive = this.hasActiveInput();
    this.rightStick = { x, y, active, timestamp: Date.now() };
    this.handleActivityTransition(wasActive);
  }

  onProcessedInput(listener: FlightControlListener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(value => value !== listener); };
  }

  start() {
    if (this.intervalId) return;
    this.appState = AppState.currentState;
    this.appStateSubscription = AppState.addEventListener('change', state => {
      this.appState = state;
      if (state !== 'active') this.releaseInputs();
    });
    this.intervalId = setInterval(() => this.tick(), 1000 / AppConfig.JOYSTICK_UPDATE_RATE_HZ);
  }

  stop() {
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
      timestamp: now,
    };
    this.listeners.forEach(listener => listener(this.output));
    safetyLayer.executeJoystickCommand(this.output, { deadmanActive: true });
  }

  private releaseInputs() {
    const now = Date.now();
    this.leftStick = { x: 0, y: 0, active: false, timestamp: now };
    this.rightStick = { x: 0, y: 0, active: false, timestamp: now };
    if (this.hadActiveInput) {
      this.sendNeutralFrame(now);
      return;
    }
    this.output = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5, timestamp: now };
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
    if (this.leftStick.active && now - this.leftStick.timestamp > AppConfig.JOYSTICK_COMMAND_TIMEOUT_MS) {
      this.leftStick = { x: 0, y: 0, active: false, timestamp: now };
    }
    if (this.rightStick.active && now - this.rightStick.timestamp > AppConfig.JOYSTICK_COMMAND_TIMEOUT_MS) {
      this.rightStick = { x: 0, y: 0, active: false, timestamp: now };
    }
  }

  private sendNeutralFrame(timestamp = Date.now()) {
    this.hadActiveInput = false;
    this.output = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5, timestamp };
    this.listeners.forEach(listener => listener(this.output));
    safetyLayer.executeJoystickCommand(this.output, { finalNeutral: true });
  }
}

export const joystickProcessor = new JoystickProcessor();
