import type { FloatingControlPosition } from '../common/DraggableFloatingControl';

export interface FloatingPositionRatio {
  xRatio: number;
  yRatio: number;
}

interface Size {
  width: number;
  height: number;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface AnchoredPanelPlacement extends FloatingControlPosition {
  opensRight: boolean;
  opensDown: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function positionFromRatio(
  ratio: FloatingPositionRatio | null,
  viewport: Size,
  controlSize: Size,
  fallback: FloatingControlPosition,
): FloatingControlPosition {
  const maxX = Math.max(0, viewport.width - controlSize.width);
  const maxY = Math.max(0, viewport.height - controlSize.height);
  if (!ratio) {
    return { x: clamp(fallback.x, 0, maxX), y: clamp(fallback.y, 0, maxY) };
  }
  return {
    x: clamp(ratio.xRatio, 0, 1) * maxX,
    y: clamp(ratio.yRatio, 0, 1) * maxY,
  };
}

export function positionToRatio(
  position: FloatingControlPosition,
  viewport: Size,
  controlSize: Size,
): FloatingPositionRatio {
  const maxX = Math.max(1, viewport.width - controlSize.width);
  const maxY = Math.max(1, viewport.height - controlSize.height);
  return {
    xRatio: clamp(position.x / maxX, 0, 1),
    yRatio: clamp(position.y / maxY, 0, 1),
  };
}

export function placePanelBesideControl(
  control: FloatingControlPosition,
  controlSize: Size,
  panelSize: Size,
  viewport: Size,
  insets: Insets,
  gap = 10,
): AnchoredPanelPlacement {
  const controlCenterX = control.x + controlSize.width / 2;
  const controlCenterY = control.y + controlSize.height / 2;
  const opensRight = controlCenterX <= viewport.width / 2;
  const opensDown = controlCenterY <= viewport.height / 2;
  const minX = insets.left + 8;
  const maxX = Math.max(minX, viewport.width - insets.right - panelSize.width - 8);
  const minY = insets.top + 8;
  const maxY = Math.max(minY, viewport.height - insets.bottom - panelSize.height - 8);

  return {
    x: clamp(
      opensRight ? control.x + controlSize.width + gap : control.x - panelSize.width - gap,
      minX,
      maxX,
    ),
    y: clamp(
      opensDown ? control.y : control.y + controlSize.height - panelSize.height,
      minY,
      maxY,
    ),
    opensRight,
    opensDown,
  };
}
