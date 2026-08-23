export interface MavlinkSettings {
  protocol: 'MAVLink 1' | 'MAVLink 2';
  systemId: number;
  componentId: number;
  heartbeatEnabled: boolean;
  heartbeatRateHz: number;
  acceptMavlink1: boolean;
  acceptMavlink2: boolean;
  forwardingEnabled: boolean;
  targetSystem: number | 'AUTO';
  targetComponent: number | 'AUTO';
}
