import { store } from '../../store';
import {
  setHomeTransaction,
  resetHomeTransaction,
  HomeTargetLocation,
} from '../../store/home/homeSlice';
import { safetyLayer } from '../command/SafetyLayer';
import { universalConnectionService } from '../connection/UniversalConnectionService';
import { calculateDistanceMeters, isValidCoordinate } from '../../utils/geographic';

const HOME_CONFIRMATION_TIMEOUT_MS = 6_000;
const HOME_HORIZONTAL_TOLERANCE_METERS = 15;
const HOME_ALTITUDE_TOLERANCE_METERS = 2;
const CURRENT_POSITION_ALTITUDE_TOLERANCE_METERS = 10;
const VEHICLE_GPS_FRESH_MS = 5_000;

interface ExpectedHomePosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  altitudeToleranceMeters?: number;
}

class HomeService {
  /** Request the vehicle to set Home to its current, confirmed GPS position. */
  async setHomeToVehicle(): Promise<boolean> {
    const state = store.getState();
    const gps = state.telemetry.gps;

    if (!universalConnectionService.isVehicleFresh()) {
      return this.fail('Vehicle is not connected.');
    }
    if (!gps
      || Date.now() - gps.timestamp > VEHICLE_GPS_FRESH_MS
      || !isValidCoordinate(gps.value.latitude, gps.value.longitude)
      || (gps.value.gpsFix ?? 0) < 3) {
      return this.fail('A fresh vehicle 3D GPS position is required to verify Home.');
    }

    const expected: ExpectedHomePosition = {
      latitude: gps.value.latitude,
      longitude: gps.value.longitude,
      altitude: gps.value.altitudeMsl != null && Number.isFinite(gps.value.altitudeMsl)
        ? gps.value.altitudeMsl
        : undefined,
      altitudeToleranceMeters: CURRENT_POSITION_ALTITUDE_TOLERANCE_METERS,
    };
    const targetLocation: HomeTargetLocation = {
      source: 'VEHICLE',
      label: 'Vehicle Current Position',
      latitude: expected.latitude,
      longitude: expected.longitude,
      altitude: expected.altitude,
    };

    store.dispatch(setHomeTransaction({ status: 'WAITING_ACK', error: null, targetLocation }));
    return this.executeAndVerify({ useCurrent: true }, expected);
  }

  /** Request the vehicle to set Home to explicit WGS-84 coordinates and MSL altitude. */
  async setHomeToLocation(
    latitude: number,
    longitude: number,
    altitudeMsl?: number,
    label = 'Selected Location',
    source: 'MAP' | 'PHONE' = 'MAP',
  ): Promise<boolean> {
    if (!isValidCoordinate(latitude, longitude)) {
      return this.fail('Invalid coordinates provided.');
    }
    if (altitudeMsl == null || !Number.isFinite(altitudeMsl)) {
      return this.fail('A valid absolute MSL altitude is required to set Home.');
    }
    if (!universalConnectionService.isVehicleFresh()) {
      return this.fail('Vehicle is not connected.');
    }

    const targetLocation: HomeTargetLocation = {
      source,
      label,
      latitude,
      longitude,
      altitude: altitudeMsl,
    };
    store.dispatch(setHomeTransaction({ status: 'WAITING_ACK', error: null, targetLocation }));

    return this.executeAndVerify(
      { useCurrent: false, latitude, longitude, altitude: altitudeMsl },
      { latitude, longitude, altitude: altitudeMsl },
    );
  }

  /** Request the vehicle to set Home to phone/GCS latitude and longitude. */
  async setHomeToPhone(phonePosition: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitudeMsl?: number | null;
  }): Promise<boolean> {
    if (!isValidCoordinate(phonePosition.latitude, phonePosition.longitude)) {
      return this.fail('Phone GPS location is not available or invalid.');
    }
    if (phonePosition.accuracy != null && phonePosition.accuracy > 50) {
      return this.fail(`Phone GPS accuracy is too low (±${Math.round(phonePosition.accuracy)}m).`);
    }

    const resolvedAltitude = phonePosition.altitudeMsl != null
      && Number.isFinite(phonePosition.altitudeMsl)
      ? phonePosition.altitudeMsl
      : null;
    if (resolvedAltitude == null) {
      return this.fail('Phone Home requires a confirmed MSL altitude from the vehicle.');
    }

    return this.setHomeToLocation(
      phonePosition.latitude,
      phonePosition.longitude,
      resolvedAltitude,
      'Phone / GCS Location',
      'PHONE',
    );
  }

  private async executeAndVerify(
    payload: { useCurrent: boolean; latitude?: number; longitude?: number; altitude?: number },
    expected: ExpectedHomePosition,
  ): Promise<boolean> {
    try {
      const result = await safetyLayer.executeCommand({ type: 'SET_HOME', payload });
      if (!result.success || result.mavResult !== 0 || result.ackAt == null) {
        return this.fail(result.error ?? 'Autopilot did not accept SET_HOME.');
      }

      store.dispatch(setHomeTransaction({ status: 'VERIFYING_HOME', error: null }));

      // Start observing before requesting the message: ArduPilot may emit
      // HOME_POSITION immediately and before the request COMMAND_ACK arrives.
      const verification = this.waitForHomeVerification(result.ackAt, expected);
      void universalConnectionService.requestHomePosition().catch(() => {
        // A fresh HOME_POSITION emitted by SET_HOME can still confirm success.
      });

      if (!await verification) {
        return this.fail('SET_HOME was accepted, but a matching HOME_POSITION was not confirmed.');
      }

      store.dispatch(setHomeTransaction({ status: 'SUCCESS', error: null }));
      const successUpdatedAt = store.getState().home.transaction.updatedAt;
      setTimeout(() => {
        const transaction = store.getState().home.transaction;
        if (transaction.status === 'SUCCESS' && transaction.updatedAt === successUpdatedAt) {
          store.dispatch(resetHomeTransaction());
        }
      }, 2_500);
      return true;
    } catch (error) {
      return this.fail(error instanceof Error ? error.message : 'Set Home failed.');
    }
  }

  /** Wait for a valid HOME_POSITION received after the accepted SET_HOME ACK. */
  private waitForHomeVerification(
    acceptedAt: number,
    expected: ExpectedHomePosition,
  ): Promise<boolean> {
    const deadline = Date.now() + HOME_CONFIRMATION_TIMEOUT_MS;
    return new Promise<boolean>(resolve => {
      const finish = (value: boolean) => {
        clearInterval(interval);
        resolve(value);
      };
      const interval = setInterval(() => {
        if (!universalConnectionService.isVehicleFresh()) {
          finish(false);
          return;
        }

        const currentHome = store.getState().home.position;
        if (currentHome
          && currentHome.updatedAt >= acceptedAt
          && isValidCoordinate(currentHome.latitude, currentHome.longitude)) {
          const horizontalError = calculateDistanceMeters(
            currentHome.latitude,
            currentHome.longitude,
            expected.latitude,
            expected.longitude,
          );
          const altitudeMatches = expected.altitude == null
            || Math.abs(currentHome.altitude - expected.altitude)
              <= (expected.altitudeToleranceMeters ?? HOME_ALTITUDE_TOLERANCE_METERS);
          if (horizontalError <= HOME_HORIZONTAL_TOLERANCE_METERS && altitudeMatches) {
            finish(true);
            return;
          }
        }

        if (Date.now() >= deadline) finish(false);
      }, 100);
    });
  }

  private fail(error: string): false {
    store.dispatch(setHomeTransaction({ status: 'FAILED', error }));
    return false;
  }
}

export const homeService = new HomeService();
