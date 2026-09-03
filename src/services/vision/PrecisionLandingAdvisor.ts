export interface PrecisionLandingTargetState {
  targetFound: boolean;
  tagId?: number | null;
  offsetXCentimeters?: number | null;
  offsetYCentimeters?: number | null;
  altitudeMeters?: number | null;
  confidence?: number | null;
  timestamp: number;
}

export class PrecisionLandingAdvisor {
  private lastState: PrecisionLandingTargetState = {
    targetFound: false,
    timestamp: Date.now(),
  };

  updateTargetState(state: Partial<PrecisionLandingTargetState>) {
    this.lastState = {
      ...this.lastState,
      ...state,
      timestamp: Date.now(),
    };
  }

  getTargetState(): PrecisionLandingTargetState {
    return { ...this.lastState };
  }

  /**
   * Formulates a truthful, clear spoken/text explanation for the pilot.
   * Does NOT control the aircraft; advisory feedback only.
   */
  getAdvisoryDescription(language: 'vi-VN' | 'en-US' = 'vi-VN'): string {
    const s = this.lastState;
    if (!s.targetFound) {
      return language === 'vi-VN'
        ? 'Chưa phát hiện landing marker trong tầm nhìn camera.'
        : 'Landing marker not currently detected by vision system.';
    }

    const tagStr = s.tagId != null ? ` #${s.tagId}` : '';
    const x = s.offsetXCentimeters ?? 0;
    const y = s.offsetYCentimeters ?? 0;
    const alt = s.altitudeMeters != null ? `${s.altitudeMeters.toFixed(1)}m` : '--';

    if (language === 'vi-VN') {
      const xDesc = x > 5 ? `lệch ${Math.abs(Math.round(x))}cm sang phải` : x < -5 ? `lệch ${Math.abs(Math.round(x))}cm sang trái` : 'trung tâm';
      const yDesc = y > 5 ? `tiến ${Math.abs(Math.round(y))}cm` : y < -5 ? `lùi ${Math.abs(Math.round(y))}cm` : 'chuẩn trục';
      return `Đã khóa landing marker${tagStr}. Vị trí ${xDesc}, ${yDesc}. Độ cao ${alt}.`;
    } else {
      const xDesc = x > 5 ? `${Math.abs(Math.round(x))}cm right` : x < -5 ? `${Math.abs(Math.round(x))}cm left` : 'centered';
      return `Locked landing marker${tagStr}. Target offset ${xDesc}. Altitude ${alt}.`;
    }
  }
}

export const precisionLandingAdvisor = new PrecisionLandingAdvisor();
