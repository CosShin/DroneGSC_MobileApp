import * as Location from 'expo-location';
import React from 'react';

export type LocationPermissionStatus = 'UNKNOWN' | 'GRANTED' | 'DENIED';
export interface DevicePosition { latitude: number; longitude: number; accuracy: number | null }
interface DeviceLocationState { permissionStatus: LocationPermissionStatus; position: DevicePosition | null; loading: boolean; error: string | null; requestLocation: () => Promise<void> }
const DeviceLocationContext = React.createContext<DeviceLocationState | null>(null);

export function DeviceLocationProvider({ children }: React.PropsWithChildren) {
  const [permissionStatus, setPermissionStatus] = React.useState<LocationPermissionStatus>('UNKNOWN');
  const [position, setPosition] = React.useState<DevicePosition | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const watcher = React.useRef<Location.LocationSubscription | null>(null);
  const accept = React.useCallback((location: Location.LocationObject) => {
    setPosition({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy });
    setError(null);
  }, []);
  const requestLocation = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPermissionStatus('DENIED'); setPosition(null); setError('Location permission required'); return;
      }
      setPermissionStatus('GRANTED');
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 500 });
      if (cached) accept(cached);
      accept(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      watcher.current?.remove();
      watcher.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 5000 }, accept);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to read device location'); }
    finally { setLoading(false); }
  }, [accept]);
  React.useEffect(() => { requestLocation(); return () => watcher.current?.remove(); }, [requestLocation]);
  const value = React.useMemo(() => ({ permissionStatus, position, loading, error, requestLocation }), [permissionStatus, position, loading, error, requestLocation]);
  return <DeviceLocationContext.Provider value={value}>{children}</DeviceLocationContext.Provider>;
}

export function useDeviceLocation() {
  const value = React.useContext(DeviceLocationContext);
  if (!value) throw new Error('useDeviceLocation must be used inside DeviceLocationProvider');
  return value;
}
