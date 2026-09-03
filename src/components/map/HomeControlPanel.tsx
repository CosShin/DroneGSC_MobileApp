import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectHomePosition,
  selectHomeStatus,
  selectIsSelectingHomeOnMap,
  setSelectingOnMap,
  setHomeTransaction,
} from '../../store/home/homeSlice';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { selectIsConnected } from '../../store/connection/connectionSlice';
import { selectIsArmed } from '../../store/drone/droneSlice';
import { GlassSurface } from '../gcs/GlassSurface';
import { colors, glass, glassShadow, layers, radius, spacing } from '../../theme/gcsTheme';
import { calculateBearingDegrees, calculateDistanceMeters, formatBearing, formatDistance, isValidCoordinate } from '../../utils/geographic';
import { resolveSetHomeAltitudeMsl } from '../../services/home/HomeProtocol';
import { useGcsLayout } from '../../hooks/useGcsLayout';

interface Props {
  phonePosition?: { latitude: number; longitude: number; accuracy?: number | null } | null;
  onCenterHome?: () => void;
  onOpenConfirmModal?: () => void;
}

export function HomeControlPanel({ phonePosition, onCenterHome, onOpenConfirmModal }: Props) {
  const layout = useGcsLayout();
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = React.useState(false);
  const homeStatus = useAppSelector(selectHomeStatus);
  const home = useAppSelector(selectHomePosition);
  const isSelectingOnMap = useAppSelector(selectIsSelectingHomeOnMap);
  const isConnected = useAppSelector(selectIsConnected);
  const isArmed = useAppSelector(selectIsArmed);
  const gps = useAppSelector(selectGps);

  const vehicleLat = gps?.value?.latitude;
  const vehicleLon = gps?.value?.longitude;
  const hasVehiclePosition = (gps?.value?.gpsFix ?? 0) >= 3 && isValidCoordinate(vehicleLat, vehicleLon);
  const altitudeMsl = resolveSetHomeAltitudeMsl(home?.altitude, gps?.value?.altitude, isArmed);
  const hasUsablePhonePosition = !!phonePosition
    && isValidCoordinate(phonePosition.latitude, phonePosition.longitude)
    && (phonePosition.accuracy == null || phonePosition.accuracy <= 50)
    && altitudeMsl !== null;
  const isHomeSet = homeStatus === 'SET' && home != null && isValidCoordinate(home.latitude, home.longitude);

  const distance = isHomeSet && hasVehiclePosition && vehicleLat != null && vehicleLon != null && home != null
    ? calculateDistanceMeters(vehicleLat, vehicleLon, home.latitude, home.longitude)
    : null;

  const bearing = isHomeSet && hasVehiclePosition && vehicleLat != null && vehicleLon != null && home != null
    ? calculateBearingDegrees(vehicleLat, vehicleLon, home.latitude, home.longitude)
    : null;

  const handleSetToVehicle = () => {
    if (!isConnected || !hasVehiclePosition || vehicleLat == null || vehicleLon == null) return;
    dispatch(
      setHomeTransaction({
        status: 'CONFIRMING',
        error: null,
        targetLocation: {
          source: 'VEHICLE',
          label: 'Vehicle Current Position',
          latitude: vehicleLat,
          longitude: vehicleLon,
          altitude: gps?.value?.altitude != null && Number.isFinite(gps.value.altitude) ? gps.value.altitude : undefined,
        },
      }),
    );
    setExpanded(false);
    onOpenConfirmModal?.();
  };

  const handleToggleSelectOnMap = () => {
    if (!isConnected || altitudeMsl == null) return;
    dispatch(setSelectingOnMap(!isSelectingOnMap));
    setExpanded(false);
  };

  const handleSetToPhone = () => {
    if (!hasUsablePhonePosition || !phonePosition || !isValidCoordinate(phonePosition.latitude, phonePosition.longitude) || altitudeMsl == null) return;
    dispatch(
      setHomeTransaction({
        status: 'CONFIRMING',
        error: null,
        targetLocation: {
          source: 'PHONE',
          label: 'Phone / GCS Location',
          latitude: phonePosition.latitude,
          longitude: phonePosition.longitude,
          altitude: altitudeMsl,
          accuracy: phonePosition.accuracy,
        },
      }),
    );
    setExpanded(false);
    onOpenConfirmModal?.();
  };

  return (
    <View style={[styles.wrapper, layout.isCompactLandscape && styles.wrapperCompact]} pointerEvents="box-none">
      {/* Floating Home Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded(v => !v)}
        style={styles.buttonHit}
      >
        <GlassSurface
          variant="strong"
          style={[styles.homeButton, isHomeSet && styles.homeButtonSet, expanded && styles.homeButtonActive]}
          contentStyle={styles.homeButtonContent}
        >
          <MaterialCommunityIcons
            name={isHomeSet ? 'home' : 'home-outline'}
            size={16}
            color={isHomeSet ? colors.success : glass.textMuted}
          />
          <Text style={[styles.homeButtonText, isHomeSet && styles.homeButtonTextSet]}>
            HOME
          </Text>
          {isHomeSet && distance != null ? (
            <Text style={styles.homeButtonDistance}>{formatDistance(distance)}</Text>
          ) : null}
        </GlassSurface>
      </TouchableOpacity>

      {/* Backdrop to dismiss when clicking outside */}
      {expanded ? (
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={() => setExpanded(false)}
        />
      ) : null}

      {/* Expanded Control Dropdown (anchored to left of rail, perfectly fitting landscape screen) */}
      {expanded ? (
        <GlassSurface
          variant="strong"
          style={[styles.card, layout.isCompactLandscape && styles.cardCompact]}
          contentStyle={styles.cardContent}
        >
          <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons
                  name="home-map-marker"
                  size={16}
                  color={isHomeSet ? colors.success : colors.primary}
                />
                <Text style={styles.cardTitle}>HOME POSITION</Text>
              </View>
              <View style={[styles.badge, isHomeSet ? styles.badgeSet : styles.badgeUnknown]}>
                <Text style={[styles.badgeText, isHomeSet ? styles.badgeTextSet : styles.badgeTextUnknown]}>
                  {isHomeSet ? 'VALID' : 'UNKNOWN'}
                </Text>
              </View>
            </View>

            {/* Coordinates readout */}
            <View style={styles.metricsBox}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={[styles.metricValue, { color: colors.primary }]}>{formatDistance(distance)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Bearing</Text>
                <Text style={styles.metricValue}>{formatBearing(bearing)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Position</Text>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {isHomeSet && home && Number.isFinite(home.latitude) && Number.isFinite(home.longitude)
                    ? `${home.latitude.toFixed(5)}, ${home.longitude.toFixed(5)}`
                    : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Altitude</Text>
                <Text style={styles.metricValue}>
                  {isHomeSet && home?.altitude != null && Number.isFinite(home.altitude)
                    ? `${home.altitude.toFixed(1)} m AMSL`
                    : '--'}
                </Text>
              </View>
            </View>

            {/* Action Menu */}
            <View style={styles.menuActions}>
              {isHomeSet ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    onCenterHome?.();
                    setExpanded(false);
                  }}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={13} color={colors.primary} />
                  <Text style={styles.actionBtnText}>CENTER HOME ON MAP</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.actionBtn, (!isConnected || !hasVehiclePosition) && styles.actionBtnDisabled]}
                disabled={!isConnected || !hasVehiclePosition}
                onPress={handleSetToVehicle}
              >
                <MaterialCommunityIcons name="quadcopter" size={13} color={colors.primary} />
                <Text style={styles.actionBtnText}>SET TO VEHICLE POSITION</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  isSelectingOnMap && styles.actionBtnActive,
                  (!isConnected || altitudeMsl == null) && styles.actionBtnDisabled,
                ]}
                disabled={!isConnected || altitudeMsl == null}
                onPress={handleToggleSelectOnMap}
              >
                <MaterialCommunityIcons
                  name="map-marker-plus-outline"
                  size={13}
                  color={isSelectingOnMap ? colors.warning : colors.primary}
                />
                <Text style={[styles.actionBtnText, isSelectingOnMap && { color: colors.warning }]}>
                  {isSelectingOnMap ? 'CANCEL MAP SELECTION' : 'SET ON MAP'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, !hasUsablePhonePosition && styles.actionBtnDisabled]}
                disabled={!hasUsablePhonePosition}
                onPress={handleSetToPhone}
              >
                <MaterialCommunityIcons name="cellphone-marker" size={13} color={colors.primary} />
                <Text style={styles.actionBtnText}>SET TO PHONE POSITION</Text>
              </TouchableOpacity>
            </View>
        </GlassSurface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 166,
    right: 14,
    zIndex: layers.controls,
    alignItems: 'flex-end',
  },
  wrapperCompact: {
    top: 162,
    right: 10,
  },
  buttonHit: {
    ...glassShadow,
  },
  homeButton: {
    width: 96,
    height: 34,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  homeButtonContent: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5.5,
    paddingHorizontal: 7,
  },
  homeButtonSet: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  homeButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  homeButtonText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: glass.textMuted,
  },
  homeButtonTextSet: {
    color: '#0F172A',
  },
  homeButtonDistance: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    marginLeft: 2,
  },
  backdropDismiss: {
    position: 'absolute',
    top: -400,
    right: -200,
    width: 3000,
    height: 3000,
    zIndex: -1,
  },
  card: {
    position: 'absolute',
    right: 104,
    top: -96,
    width: 250,
    borderRadius: radius.md,
    ...glassShadow,
  },
  cardCompact: {
    right: 100,
    top: -100,
  },
  cardContent: {
    padding: 10,
    gap: 7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
  },
  badgeSet: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeUnknown: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  badgeTextSet: {
    color: colors.success,
  },
  badgeTextUnknown: {
    color: '#64748B',
  },
  metricsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: radius.sm,
    padding: 7,
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 9.5,
    color: '#0F172A',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  menuActions: {
    gap: 5,
    paddingTop: 2,
  },
  actionBtn: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(47, 128, 237, 0.08)',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
});
