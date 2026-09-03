export const HEADING_TICK_STEP = 15;
export const HEADING_TICK_WIDTH = 34;

export interface HeadingTapeTick {
  value: number;
  label: string;
  major: boolean;
}

export interface HeadingTapeModel {
  heading: number;
  cardinal: string;
  ticks: HeadingTapeTick[];
  translateX: number;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function normalizeHeading(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
}

export function headingCardinal(value: number): string {
  const heading = normalizeHeading(value);
  return CARDINALS[Math.round(heading / 45) % CARDINALS.length];
}

function tickLabel(value: number) {
  if (value % 90 === 0) return CARDINALS[(value / 45) % CARDINALS.length];
  if (value % 45 === 0) return CARDINALS[(value / 45) % CARDINALS.length];
  return value.toString().padStart(3, '0');
}

export function buildHeadingTape(value: number, tickCount = 9): HeadingTapeModel {
  const heading = normalizeHeading(value);
  const center = Math.round(heading / HEADING_TICK_STEP) * HEADING_TICK_STEP;
  const half = Math.floor(tickCount / 2);
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const tickValue = normalizeHeading(center + (index - half) * HEADING_TICK_STEP);
    return {
      value: tickValue,
      label: tickLabel(tickValue),
      major: tickValue % 45 === 0,
    };
  });

  return {
    heading,
    cardinal: headingCardinal(heading),
    ticks,
    translateX: -((heading - center) / HEADING_TICK_STEP) * HEADING_TICK_WIDTH,
  };
}

export function clampAttitude(value: number, limit = 45): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, value));
}

export function formatSignedAngle(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}°`;
}
