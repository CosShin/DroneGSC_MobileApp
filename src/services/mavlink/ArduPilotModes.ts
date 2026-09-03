const COPTER_MODES: Readonly<Record<number, string>> = {
  0: 'STABILIZE',
  1: 'ACRO',
  2: 'ALT_HOLD',
  3: 'AUTO',
  4: 'GUIDED',
  5: 'LOITER',
  6: 'RTL',
  9: 'LAND',
  16: 'POSHOLD',
};

export function getArduCopterModeName(customMode: number) {
  return COPTER_MODES[customMode] ?? `MODE_${customMode}`;
}
