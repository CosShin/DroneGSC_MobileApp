import { MavlinkSettings } from '../types/mavlink';

export const DEFAULT_MAVLINK_CONFIG: MavlinkSettings = {
  protocol: 'MAVLink 2',
  systemId: 255,
  componentId: 1,
  heartbeatEnabled: true,
  heartbeatRateHz: 1,
  acceptMavlink1: true,
  acceptMavlink2: true,
  forwardingEnabled: false,
  targetSystem: 'AUTO',
  targetComponent: 'AUTO'
};
