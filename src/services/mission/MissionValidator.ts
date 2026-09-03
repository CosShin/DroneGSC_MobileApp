import { getCommandDefinition } from './MissionCommandRegistry';
import { MissionEditorItem, MissionItemInt, MissionValidationResult, MissionVerificationResult } from './MissionTypes';

/**
 * Validates high-level mission editor items before compiling and uploading.
 * Returns valid status and exact item-level error details.
 */
export function validateMission(items: MissionEditorItem[]): MissionValidationResult {
  const errors: MissionValidationResult['errors'] = [];

  if (!items.length) {
    errors.push({
      itemIndex: -1,
      itemId: '',
      field: 'mission',
      message: 'Mission is empty. Add at least one waypoint or takeoff command.',
    });
    return { valid: false, errors };
  }

  items.forEach((item, index) => {
    const def = getCommandDefinition(item.command);

    // Location validation
    if (def.hasLocation) {
      if (item.lat === undefined || !Number.isFinite(item.lat) || item.lat < -90 || item.lat > 90) {
        errors.push({
          itemIndex: index,
          itemId: item.id,
          field: 'lat',
          message: `Item #${index + 1} (${def.label}) has invalid latitude: ${item.lat}`,
        });
      }
      if (item.lng === undefined || !Number.isFinite(item.lng) || item.lng < -180 || item.lng > 180) {
        errors.push({
          itemIndex: index,
          itemId: item.id,
          field: 'lng',
          message: `Item #${index + 1} (${def.label}) has invalid longitude: ${item.lng}`,
        });
      }
    }

    // Altitude validation
    if (def.hasAltitude) {
      if (item.alt === undefined || !Number.isFinite(item.alt)) {
        errors.push({
          itemIndex: index,
          itemId: item.id,
          field: 'alt',
          message: `Item #${index + 1} (${def.label}) has invalid altitude: ${item.alt}`,
        });
      }
    }

    // Speed validation (if set)
    if (item.speed !== undefined && (!Number.isFinite(item.speed) || item.speed < 0 || item.speed > 50)) {
      errors.push({
        itemIndex: index,
        itemId: item.id,
        field: 'speed',
        message: `Item #${index + 1} (${def.label}) has invalid target speed: ${item.speed} m/s`,
      });
    }

    // Delay validation
    if (item.delay !== undefined && (!Number.isFinite(item.delay) || item.delay < 0)) {
      errors.push({
        itemIndex: index,
        itemId: item.id,
        field: 'delay',
        message: `Item #${index + 1} (${def.label}) has negative delay/hold time: ${item.delay} s`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Performs semantic comparison between uploaded wire items and downloaded wire items
 */
export function verifyRoundTrip(
  uploaded: MissionItemInt[],
  downloaded: MissionItemInt[]
): MissionVerificationResult {
  const diffs: MissionVerificationResult['diffs'] = [];

  if (uploaded.length !== downloaded.length) {
    diffs.push({
      seq: -1,
      field: 'count',
      uploadedValue: `${uploaded.length} items`,
      downloadedValue: `${downloaded.length} items`,
    });
  }

  const checkCount = Math.min(uploaded.length, downloaded.length);
  for (let i = 0; i < checkCount; i++) {
    const up = uploaded[i];
    const dn = downloaded[i];

    if (up.command !== dn.command) {
      diffs.push({
        seq: i,
        field: 'command',
        uploadedValue: up.command,
        downloadedValue: dn.command,
      });
    }

    if (up.frame !== dn.frame) {
      diffs.push({
        seq: i,
        field: 'frame',
        uploadedValue: up.frame,
        downloadedValue: dn.frame,
      });
    }

    if (up.x !== dn.x) {
      diffs.push({
        seq: i,
        field: 'x (lat)',
        uploadedValue: (up.x / 1e7).toFixed(6),
        downloadedValue: (dn.x / 1e7).toFixed(6),
      });
    }

    if (up.y !== dn.y) {
      diffs.push({
        seq: i,
        field: 'y (lng)',
        uploadedValue: (up.y / 1e7).toFixed(6),
        downloadedValue: (dn.y / 1e7).toFixed(6),
      });
    }

    if (Math.abs(up.z - dn.z) > 0.01) {
      diffs.push({
        seq: i,
        field: 'z (alt)',
        uploadedValue: up.z.toFixed(2),
        downloadedValue: dn.z.toFixed(2),
      });
    }

    if (Math.abs(up.param1 - dn.param1) > 0.01) {
      diffs.push({
        seq: i,
        field: 'param1',
        uploadedValue: up.param1,
        downloadedValue: dn.param1,
      });
    }

    if (Math.abs(up.param2 - dn.param2) > 0.01) {
      diffs.push({
        seq: i,
        field: 'param2',
        uploadedValue: up.param2,
        downloadedValue: dn.param2,
      });
    }
  }

  return {
    match: diffs.length === 0,
    uploadedCount: uploaded.length,
    downloadedCount: downloaded.length,
    diffs,
  };
}
