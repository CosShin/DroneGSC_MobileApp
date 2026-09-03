import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectWaypoints } from '../../store/mission/missionSlice';
import { selectGps, selectYaw } from '../../store/telemetry/telemetrySlice';
import {
  selectHomePosition,
  selectIsSelectingHomeOnMap,
  selectHomePreviewPosition,
  setPreviewPosition,
  setHomeTransaction,
  setSelectingOnMap,
} from '../../store/home/homeSlice';
import { OpenStreetMap, MapPosition } from './OpenStreetMap';
import { HomeControlPanel } from './HomeControlPanel';
import { SetHomeConfirmationModal } from './SetHomeConfirmationModal';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { selectIsArmed } from '../../store/drone/droneSlice';
import { resolveSetHomeAltitudeMsl } from '../../services/home/HomeProtocol';
import { isValidCoordinate } from '../../utils/geographic';
import { glass, glassShadow, layers, radius, colors } from '../../theme/gcsTheme';
import { GlassSurface } from '../gcs/GlassSurface';

/** Keeps the Leaflet WebView mounted even before GPS is available. */
export const MapContainer = React.memo(function MapContainer() {
  const dispatch = useAppDispatch();
  const waypoints = useAppSelector(selectWaypoints);
  const device = useDeviceLocation();
  const gps = useAppSelector(selectGps);
  const isArmed = useAppSelector(selectIsArmed);
  const yaw = useAppSelector(selectYaw);
  const home = useAppSelector(selectHomePosition);
  const isSelectingHome = useAppSelector(selectIsSelectingHomeOnMap);
  const previewHome = useAppSelector(selectHomePreviewPosition);
  const altitudeMsl = resolveSetHomeAltitudeMsl(home?.altitude, gps?.value.altitude, isArmed);

  const [follow, setFollow] = React.useState(true);
  const [centerHomeTick, setCenterHomeTick] = React.useState(0);
  const [confirmModalVisible, setConfirmModalVisible] = React.useState(false);

  const vehiclePosition: MapPosition | null =
    gps && (gps.value.gpsFix ?? 0) >= 3
      ? { latitude: gps.value.latitude, longitude: gps.value.longitude }
      : null;

  const phonePosition = device.position
    ? {
        latitude: device.position.latitude,
        longitude: device.position.longitude,
        accuracy: device.position.accuracy,
      }
    : null;

  const homePosition: MapPosition | null = home
    ? { latitude: home.latitude, longitude: home.longitude }
    : null;

  const previewHomePosition: MapPosition | null = previewHome
    ? { latitude: previewHome.latitude, longitude: previewHome.longitude }
    : null;

  const handleMapPress = (coord: MapPosition) => {
    if (isSelectingHome && altitudeMsl != null && isValidCoordinate(coord?.latitude, coord?.longitude)) {
      dispatch(setSelectingOnMap(false));
      dispatch(setPreviewPosition(coord));
      dispatch(
        setHomeTransaction({
          status: 'CONFIRMING',
          error: null,
          targetLocation: {
            source: 'MAP',
            label: 'Selected Map Location',
            latitude: coord.latitude,
            longitude: coord.longitude,
            altitude: altitudeMsl,
          },
        }),
      );
      setConfirmModalVisible(true);
    }
  };

  const handleCenterHome = () => {
    setFollow(false);
    setCenterHomeTick(v => v + 1);
  };

  return (
    <View style={styles.container}>
      <OpenStreetMap
        vehiclePosition={vehiclePosition}
        phonePosition={phonePosition}
        homePosition={homePosition}
        previewHomePosition={previewHomePosition}
        yaw={yaw ?? 0}
        waypoints={waypoints}
        followVehicle={follow}
        centerHomeRequest={centerHomeTick}
        onMapPress={handleMapPress}
      />

      {/* Floating Home Position Menu */}
      <HomeControlPanel
        phonePosition={phonePosition}
        onCenterHome={handleCenterHome}
        onOpenConfirmModal={() => setConfirmModalVisible(true)}
      />

      {/* Instructional banner when in Map Selection Mode */}
      {isSelectingHome ? (
        <View style={styles.bannerWrap} pointerEvents="box-none">
          <GlassSurface variant="strong" style={styles.selectionBanner} contentStyle={styles.selectionBannerContent}>
            <MaterialCommunityIcons name="crosshairs" size={16} color={colors.warning} />
            <Text style={styles.selectionBannerText}>TAP ANY POINT ON THE MAP TO SET NEW HOME</Text>
            <TouchableOpacity
              style={styles.cancelSelectionBtn}
              onPress={() => dispatch(setSelectingOnMap(false))}
            >
              <Text style={styles.cancelSelectionText}>CANCEL</Text>
            </TouchableOpacity>
          </GlassSurface>
        </View>
      ) : null}

      {/* Phone GPS prompt if vehicle GPS is not yet acquired */}
      {!vehiclePosition ? (
        <TouchableOpacity
          disabled={!!device.position || device.loading}
          onPress={device.requestLocation}
          style={styles.contextHit}
        >
          <GlassSurface variant="strong" style={styles.context} contentStyle={styles.contextContent}>
            <MaterialCommunityIcons
              name={device.position ? 'cellphone-marker' : device.loading ? 'crosshairs-question' : 'map-marker-off-outline'}
              size={14}
              color={device.position ? '#68B7FF' : '#F6B94C'}
            />
            <Text style={styles.contextText}>
              {device.position ? 'PHONE LOCATION' : device.loading ? 'FINDING PHONE LOCATION' : 'ENABLE PHONE LOCATION'}
            </Text>
          </GlassSurface>
        </TouchableOpacity>
      ) : null}

      {/* Follow Vehicle Toggle */}
      {vehiclePosition ? (
        <TouchableOpacity
          accessibilityLabel={follow ? 'Disable map follow' : 'Follow current position'}
          style={styles.locateHit}
          onPress={() => setFollow(value => !value)}
        >
          <GlassSurface variant="strong" style={[styles.locate, follow && styles.locateActive]} contentStyle={styles.locateContent}>
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={follow ? '#68B7FF' : glass.textMuted} />
          </GlassSurface>
        </TouchableOpacity>
      ) : null}

      {/* Set Home Confirmation Modal */}
      <SetHomeConfirmationModal
        visible={confirmModalVisible}
        onClose={() => setConfirmModalVisible(false)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: '#07111F' },
  contextHit: { position: 'absolute', top: 86, alignSelf: 'center', zIndex: layers.controls },
  context: { height: 32, borderRadius: 16, ...glassShadow },
  contextContent: { height: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11 },
  contextText: { color: glass.text, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.35 },
  locateHit: { position: 'absolute', right: 12, bottom: 78, zIndex: layers.controls },
  locate: { width: 38, height: 38, borderRadius: radius.md, ...glassShadow },
  locateContent: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  locateActive: { borderColor: 'rgba(104,183,255,0.66)' },
  bannerWrap: {
    position: 'absolute',
    top: 86,
    alignSelf: 'center',
    zIndex: 110,
  },
  selectionBanner: {
    height: 34,
    borderRadius: radius.pill,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    ...glassShadow,
  },
  selectionBannerContent: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  selectionBannerText: {
    color: '#0F172A',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  cancelSelectionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: radius.pill,
    marginLeft: 4,
  },
  cancelSelectionText: {
    color: '#475569',
    fontSize: 8.5,
    fontWeight: '900',
  },
});
