import type { RootState } from '../../store';
import { buildFlightContext } from './FlightContextBuilder';

export type AniToolName =
  | 'get_flight_context'
  | 'get_weather'
  | 'web_search'
  | 'get_vehicle_status'
  | 'get_battery_status'
  | 'get_gps_status'
  | 'get_flight_mode'
  | 'get_home_position'
  | 'request_arm'
  | 'request_disarm'
  | 'request_takeoff'
  | 'request_land'
  | 'request_rtl'
  | 'request_change_mode'
  | 'request_goto'
  | 'request_start_mission'
  | 'request_pause_mission'
  | 'request_resume_mission';

export const ANI_ALLOWED_TOOLS: readonly AniToolName[] = [
  'get_flight_context',
  'get_weather',
  'web_search',
  'get_vehicle_status',
  'get_battery_status',
  'get_gps_status',
  'get_flight_mode',
  'get_home_position',
  'request_arm',
  'request_disarm',
  'request_takeoff',
  'request_land',
  'request_rtl',
  'request_change_mode',
  'request_goto',
  'request_start_mission',
  'request_pause_mission',
  'request_resume_mission',
];

interface WeatherLocation {
  label: string;
  latitude: number;
  longitude: number;
}

interface WeatherToolResult {
  ok: boolean;
  summary: string;
  error?: string;
}

const KNOWN_CITY_LOCATIONS: WeatherLocation[] = [
  { label: 'Ho Chi Minh City', latitude: 10.8231, longitude: 106.6297 },
  { label: 'Hanoi', latitude: 21.0278, longitude: 105.8342 },
  { label: 'Da Nang', latitude: 16.0471, longitude: 108.2068 },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function cityFromPrompt(prompt: string): WeatherLocation | null {
  const text = normalize(prompt);
  if (text.includes('hcm') || text.includes('ho chi minh') || text.includes('sai gon') || text.includes('saigon')) {
    return KNOWN_CITY_LOCATIONS[0];
  }
  if (text.includes('ha noi') || text.includes('hanoi')) return KNOWN_CITY_LOCATIONS[1];
  if (text.includes('da nang') || text.includes('danang')) return KNOWN_CITY_LOCATIONS[2];
  return null;
}

function droneLocationFromState(prompt: string, state: RootState | null): WeatherLocation | null {
  if (!state) return null;
  const text = normalize(prompt);
  if (!text.includes('drone') && !text.includes('may bay') && !text.includes('dang bay')) return null;
  const context = buildFlightContext(state);
  const lat = context.gps?.latitude;
  const lon = context.gps?.longitude;
  if (lat == null || lon == null) return null;
  return { label: 'khu vực drone', latitude: lat, longitude: lon };
}

function formatWeatherResponse(label: string, data: any): WeatherToolResult {
  const current = data?.current;
  if (!current) {
    return { ok: false, summary: 'Chưa nhận được dữ liệu thời tiết hợp lệ từ weather tool.', error: 'WEATHER_EMPTY_RESULT' };
  }

  const temp = typeof current.temperature_2m === 'number' ? `${Math.round(current.temperature_2m)}°C` : '--';
  const wind = typeof current.wind_speed_10m === 'number' ? `${Math.round(current.wind_speed_10m)} km/h` : '--';
  const rain = typeof current.precipitation === 'number' ? `${current.precipitation.toFixed(1)} mm` : '--';
  const dailyRainChance = data?.daily?.precipitation_probability_max?.[0];
  const chance = typeof dailyRainChance === 'number' ? `, xác suất mưa cao nhất khoảng ${Math.round(dailyRainChance)}%` : '';

  return {
    ok: true,
    summary: `${label} hiện khoảng ${temp}, gió ${wind}, lượng mưa hiện tại ${rain}${chance}.`,
  };
}

export async function getWeatherForAni(prompt: string, state: RootState | null): Promise<WeatherToolResult> {
  const location = droneLocationFromState(prompt, state) ?? cityFromPrompt(prompt);
  if (!location) {
    return {
      ok: false,
      summary: 'ANI cần bạn nói rõ địa điểm, ví dụ “thời tiết HCM” hoặc “thời tiết khu vực drone”. Hiện app chưa có vị trí điện thoại trong AI context nên ANI không đoán.',
      error: 'WEATHER_LOCATION_REQUIRED',
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&current=temperature_2m,precipitation,wind_speed_10m&daily=precipitation_probability_max&timezone=auto`;
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return {
        ok: false,
        summary: `Weather tool chưa lấy được dữ liệu cho ${location.label} (HTTP ${response.status}). ANI sẽ không tự đoán thời tiết realtime.`,
        error: `WEATHER_HTTP_${response.status}`,
      };
    }
    const data = await response.json();
    return formatWeatherResponse(location.label, data);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'UNKNOWN_WEATHER_ERROR';
    return {
      ok: false,
      summary: `Weather tool đang không truy cập được (${reason}). ANI không bịa dữ liệu thời tiết realtime.`,
      error: reason,
    };
  }
}

export function getWebSearchUnavailableMessage(prompt: string): string {
  return `Yêu cầu này cần dữ liệu web realtime: “${prompt}”. Hiện ANITECH GCS chưa cấu hình web search tool trong app, nên ANI không tự bịa. Bạn có thể bật web tool/proxy sau, lúc đó ANI sẽ dùng kết quả tìm kiếm rồi trả lời tự nhiên.`;
}

export interface SanitizedFlightContextResult {
  ok: boolean;
  context: {
    timestamp: number;
    connection: {
      networkStatus: string;
      transportStatus: string;
      mavlinkStatus: string;
      vehicleStatus: string;
      vehicleConnected: boolean;
      heartbeatAgeMs: number | null;
      linkQuality: string | null;
    };
    vehicle: {
      connected: boolean;
      name: string;
      mode: string;
      armed: boolean;
      systemStatus: string;
    };
    battery: {
      available: boolean;
      voltage: number | null;
      current: number | null;
      percentage: number | null;
      remainingPercent: number | null;
    } | null;
    gps: {
      available: boolean;
      fix: boolean;
      fixType: number | null;
      fixDescription: string;
      satellites: number | null;
      hdop: number | null;
      latitude: number | null;
      longitude: number | null;
      altitude: number | null;
    } | null;
    sensors: {
      available: boolean;
      count: number;
      ekf: { available: boolean; healthy: boolean | null; message?: string };
      opticalFlow: { available: boolean; quality?: number | null };
      rangefinder: { available: boolean; distance?: number | null };
      items: Array<{ name: string; health: string; value?: string; message?: string }>;
    };
    flight: {
      altitude: number | null;
      groundSpeed: number | null;
      verticalSpeed: number | null;
      heading: number | null;
      roll: number | null;
      pitch: number | null;
      yaw: number | null;
    };
    home: {
      isSet: boolean;
      distanceMeters: number | null;
      bearingDegrees: number | null;
    };
    warnings: string[];
  };
}

export function getFlightContextTool(state?: RootState | null): SanitizedFlightContextResult {
  let resolvedState = state;
  if (!resolvedState) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../store');
      resolvedState = mod.store?.getState ? mod.store.getState() : mod.default?.store?.getState ? mod.default.store.getState() : null;
    } catch {
      resolvedState = null;
    }
  }
  if (!resolvedState) {
    throw new Error('No Redux state available for get_flight_context');
  }

  const raw = buildFlightContext(resolvedState);
  return {
    ok: true,
    context: {
      timestamp: raw.timestamp,
      connection: {
        networkStatus: raw.connection.networkState,
        transportStatus: raw.connection.transport,
        mavlinkStatus: raw.connection.mavlinkState,
        vehicleStatus: raw.connection.vehicleState,
        vehicleConnected: raw.vehicle.connected,
        heartbeatAgeMs: raw.connection.heartbeatAgeMs,
        linkQuality: (resolvedState.connection as any)?.linkQuality ?? null,
      },
      vehicle: {
        connected: raw.vehicle.connected,
        name: raw.vehicle.name,
        mode: raw.vehicle.mode,
        armed: raw.vehicle.armed,
        systemStatus: raw.vehicle.systemStatus,
      },
      battery: raw.battery ? {
        available: true,
        voltage: raw.battery.voltage,
        current: raw.battery.current,
        percentage: raw.battery.percentage,
        remainingPercent: raw.battery.percentage,
      } : null,
      gps: raw.gps ? {
        available: true,
        fix: raw.gps.fix ?? ((raw.gps.fixType ?? 0) >= 3),
        fixType: raw.gps.fixType,
        fixDescription: raw.gps.fixDescription ?? (raw.gps.fixType == null ? 'UNKNOWN' : (raw.gps.fixType >= 3 ? '3D FIX' : raw.gps.fixType === 2 ? '2D FIX' : 'NO FIX')),
        satellites: raw.gps.satellites,
        hdop: raw.gps.hdop,
        latitude: raw.gps.latitude,
        longitude: raw.gps.longitude,
        altitude: raw.gps.altitude,
      } : null,
      sensors: {
        available: raw.sensors.length > 0,
        count: raw.sensors.length,
        ekf: raw.ekf ?? { available: false, healthy: null },
        opticalFlow: raw.opticalFlow ?? { available: false, quality: null },
        rangefinder: raw.rangefinder ?? { available: false, distance: null },
        items: raw.sensors,
      },
      flight: raw.flight,
      home: {
        isSet: raw.home.isSet,
        distanceMeters: raw.home.distanceMeters,
        bearingDegrees: raw.home.bearingDegrees,
      },
      warnings: raw.warnings,
    },
  };
}
