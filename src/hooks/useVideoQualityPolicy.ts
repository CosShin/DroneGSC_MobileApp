import { useAppSelector } from '../store/hooks';
import {
  selectVideoQualityPolicy,
  selectLinkQuality,
  selectLinkQualityScore,
} from '../store/connection/connectionSlice';
import type { VideoQualityPolicy } from '../services/connection/ConnectionHealth';

/**
 * Hook to consume the current VideoQualityPolicy derived from link health.
 *
 * Link Quality → Video Policy:
 *   EXCELLENT / GOOD → NORMAL
 *   DEGRADED         → REDUCED
 *   POOR             → MINIMUM
 *   CRITICAL         → OFF
 *
 * When backend bitrate adaptation is ready, this hook provides the target policy.
 */
export function useVideoQualityPolicy(): {
  policy: VideoQualityPolicy;
  linkQuality: string;
  score: number;
  isDegraded: boolean;
  isSuspended: boolean;
} {
  const policy = useAppSelector(selectVideoQualityPolicy);
  const linkQuality = useAppSelector(selectLinkQuality);
  const score = useAppSelector(selectLinkQualityScore);

  return {
    policy,
    linkQuality,
    score,
    isDegraded: policy === 'REDUCED' || policy === 'MINIMUM',
    isSuspended: policy === 'OFF',
  };
}
