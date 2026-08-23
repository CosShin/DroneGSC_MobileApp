import { AppConfig } from '../config';

/**
 * Kiểm tra xem dữ liệu telemetry có bị cũ (stale) hay không
 * @param timestamp Thời điểm nhận dữ liệu (tính bằng ms)
 * @returns true nếu quá khoảng TELEMETRY_TIMEOUT, ngược lại false
 */
export function isTelemetryStale(timestamp: number | null): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > AppConfig.TELEMETRY_TIMEOUT;
}
