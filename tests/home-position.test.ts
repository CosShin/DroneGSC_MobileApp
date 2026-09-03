import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDistanceMeters,
  calculateBearingDegrees,
  formatDistance,
  formatBearing,
  isValidCoordinate,
} from '../src/utils/geographic';
import {
  homeSlice,
  setHomePosition,
  clearHomePosition,
  setSelectingOnMap,
  setPreviewPosition,
  setHomeTransaction,
  resetHomeTransaction,
} from '../src/store/home/homeSlice';
import {
  buildSetHomeCommandParams,
  resolveSetHomeAltitudeMsl,
} from '../src/services/home/HomeProtocol';

test('Geographic calculations: Haversine distance and bearing', () => {
  // Point A: Ho Chi Minh City (10.7769, 106.7009)
  // Point B: Hanoi (21.0285, 105.8542)
  const dist = calculateDistanceMeters(10.7769, 106.7009, 21.0285, 105.8542);
  // Expected distance ~1140 km (1,140,000 meters)
  assert.ok(dist > 1130000 && dist < 1160000, `Distance ${dist} should be around 1140km`);

  const bearing = calculateBearingDegrees(10.7769, 106.7009, 21.0285, 105.8542);
  // Heading from HCM to Hanoi is almost due North slightly West (~355.6°)
  assert.ok(bearing > 350 && bearing < 360, `Bearing ${bearing} should be ~355.6°`);

  // Short distance test: 100 meters due north
  // 1 degree latitude is approx 111,139 meters -> 0.0009 deg ~ 100m
  const shortDist = calculateDistanceMeters(10.0, 106.0, 10.0009, 106.0);
  assert.ok(shortDist > 90 && shortDist < 110, `Short distance ${shortDist} should be ~100m`);
  const northBearing = calculateBearingDegrees(10.0, 106.0, 10.0009, 106.0);
  assert.ok(Math.abs(northBearing - 0) < 1e-4, `North bearing should be 0°`);
});

test('Geographic formatting: formatDistance and formatBearing', () => {
  assert.equal(formatDistance(null), '--');
  assert.equal(formatDistance(undefined), '--');
  assert.equal(formatDistance(-5), '--');
  assert.equal(formatDistance(45.2), '45 m');
  assert.equal(formatDistance(999), '999 m');
  assert.equal(formatDistance(1000), '1.00 km');
  assert.equal(formatDistance(1240), '1.24 km');

  assert.equal(formatBearing(null), '--°');
  assert.equal(formatBearing(undefined), '--°');
  assert.equal(formatBearing(0), '000°');
  assert.equal(formatBearing(45), '045°');
  assert.equal(formatBearing(278.4), '278°');
  assert.equal(formatBearing(360), '000°');
});

test('Geographic coordinate validation', () => {
  assert.equal(isValidCoordinate(null, null), false);
  assert.equal(isValidCoordinate(0, 0), false, 'Null island (0,0) is rejected');
  assert.equal(isValidCoordinate(95, 100), false, 'Lat > 90 is rejected');
  assert.equal(isValidCoordinate(10, 190), false, 'Lon > 180 is rejected');
  assert.equal(isValidCoordinate(NaN, 106), false);
  assert.equal(isValidCoordinate(10.7769, 106.7009), true);
});

test('HomeSlice Redux state transitions', () => {
  const reducer = homeSlice.reducer;
  let state = reducer(undefined, { type: '@@INIT' });

  assert.equal(state.status, 'UNKNOWN');
  assert.equal(state.position, null);
  assert.equal(state.selectingOnMap, false);
  assert.equal(state.previewPosition, null);

  // Set home position from telemetry
  const homeData = {
    latitude: 10.81234,
    longitude: 106.71234,
    altitude: 15.5,
    updatedAt: 1700000000000,
  };
  state = reducer(state, setHomePosition(homeData));
  assert.equal(state.status, 'SET');
  assert.deepEqual(state.position, homeData);

  // Toggle map selection
  state = reducer(state, setSelectingOnMap(true));
  assert.equal(state.selectingOnMap, true);

  // Set preview position
  state = reducer(state, setPreviewPosition({ latitude: 10.815, longitude: 106.715 }));
  assert.deepEqual(state.previewPosition, { latitude: 10.815, longitude: 106.715 });
  assert.deepEqual(state.position, homeData, 'preview must not replace official vehicle Home');

  // Update transaction status
  state = reducer(
    state,
    setHomeTransaction({
      status: 'VERIFYING_HOME',
      targetLocation: { source: 'MAP', label: 'Map Location', latitude: 10.815, longitude: 106.715 },
    }),
  );
  assert.equal(state.transaction.status, 'VERIFYING_HOME');
  assert.equal(state.transaction.targetLocation?.label, 'Map Location');

  // Clear home position on vehicle disconnect
  state = reducer(state, clearHomePosition());
  assert.equal(state.status, 'UNKNOWN');
  assert.equal(state.position, null);
  assert.equal(state.selectingOnMap, false);
  assert.equal(state.previewPosition, null);
  assert.equal(state.transaction.status, 'IDLE');
});

test('MAV_CMD_DO_SET_HOME params preserve coordinate units and require MSL altitude', () => {
  const current = buildSetHomeCommandParams({ useCurrent: true });
  assert.equal(current[0], 1);
  assert.ok(Number.isNaN(current[3]), 'yaw must be unspecified, not forced to north');
  assert.deepEqual(current.slice(4), [0, 0, 0]);

  const explicit = buildSetHomeCommandParams({
    useCurrent: false,
    latitude: 10.7769123,
    longitude: 106.7009456,
    altitude: 18.75,
  });
  assert.equal(explicit[0], 0);
  assert.ok(Number.isNaN(explicit[3]));
  assert.equal(explicit[4], 10.7769123, 'COMMAND_LONG latitude is degrees, not degE7');
  assert.equal(explicit[5], 106.7009456, 'COMMAND_LONG longitude is degrees, not degE7');
  assert.equal(explicit[6], 18.75, 'COMMAND_LONG altitude is metres MSL');

  assert.throws(
    () => buildSetHomeCommandParams({ useCurrent: false, latitude: 0, longitude: 0, altitude: 0 }),
    /INVALID_SET_HOME_LOCATION/,
  );
  assert.throws(
    () => buildSetHomeCommandParams({ useCurrent: false, latitude: 10, longitude: 106 }),
    /INVALID_SET_HOME_LOCATION/,
  );
});

test('explicit Home altitude uses confirmed MSL data and never phone ellipsoid altitude', () => {
  assert.equal(resolveSetHomeAltitudeMsl(12.5, 99, true), 12.5);
  assert.equal(resolveSetHomeAltitudeMsl(null, 8.25, false), 8.25);
  assert.equal(resolveSetHomeAltitudeMsl(null, 8.25, true), null);
  assert.equal(resolveSetHomeAltitudeMsl(null, null, false), null);
});
