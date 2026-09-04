import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectHomePosition,
  selectHomeTransaction,
  resetHomeTransaction,
  setSelectingOnMap,
} from '../../store/home/homeSlice';
import { selectGps } from '../../store/telemetry/telemetrySlice';
import { homeService } from '../../services/home/HomeService';
import { colors, glass, layers, radius } from '../../theme/gcsTheme';
import { calculateDistanceMeters, formatDistance } from '../../utils/geographic';
import { useTruthfulTelemetry } from '../../hooks/useTruthfulTelemetry';
import { useFreshnessClock } from '../../hooks/useFreshnessClock';

const VEHICLE_GPS_FRESH_MS = 5_000;

interface Props {
  visible: boolean;
  onClose: () => void;
}

function formatCoord(val: number | null | undefined, precision = 7): string {
  if (val == null || !Number.isFinite(val)) return '--';
  return val.toFixed(precision);
}

function formatMavError(error: string | null): string {
  if (!error) return 'Không thể cập nhật vị trí Home trên autopilot.';
  if (error.includes('MAV_RESULT_4') || error === '4') {
    return 'Autopilot từ chối lệnh (Yêu cầu máy bay có GPS 3D fix hoặc vị trí mới ngoài phạm vi bay).';
  }
  if (error.includes('MAV_RESULT_2') || error === '2') {
    return 'Autopilot từ chối thực hiện lệnh vì lý do an toàn bay.';
  }
  if (error.includes('MAV_RESULT_1') || error === '1') {
    return 'Autopilot tạm thời bận. Vui lòng thử lại sau vài giây.';
  }
  if (error.includes('MAV_RESULT_3') || error === '3') {
    return 'Firmware autopilot hiện tại không hỗ trợ lệnh MAV_CMD_DO_SET_HOME.';
  }
  if (error.includes('TIMEOUT')) {
    return 'Hết thời gian chờ phản hồi từ autopilot (Timeout).';
  }
  return error;
}

export function SetHomeConfirmationModal({ visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const currentHome = useAppSelector(selectHomePosition);
  const transaction = useAppSelector(selectHomeTransaction);
  const gps = useAppSelector(selectGps);
  const truth = useTruthfulTelemetry();
  const now = useFreshnessClock();
  const [altitudeText, setAltitudeText] = React.useState('');

  const target = transaction.targetLocation;
  React.useEffect(() => {
    if (!visible || !target || target.source === 'VEHICLE') {
      setAltitudeText('');
      return;
    }
    setAltitudeText(target.altitude != null && Number.isFinite(target.altitude)
      ? String(target.altitude)
      : '');
  }, [target, visible]);

  if (!visible || !target) return null;

  const vehicleLat = gps?.value?.latitude;
  const vehicleLon = gps?.value?.longitude;

  const hasFreshVehicleGps = truth.connected
    && !!gps
    && now - gps.timestamp <= VEHICLE_GPS_FRESH_MS
    && (gps.value.gpsFix ?? 0) >= 3;
  const distFromVehicle = hasFreshVehicleGps
    && vehicleLat != null && vehicleLon != null && target.latitude != null && target.longitude != null
    && Number.isFinite(vehicleLat) && Number.isFinite(vehicleLon) && Number.isFinite(target.latitude) && Number.isFinite(target.longitude)
    ? calculateDistanceMeters(vehicleLat, vehicleLon, target.latitude, target.longitude)
    : null;

  const distFromPrevHome = currentHome && target.latitude != null && target.longitude != null
    && Number.isFinite(currentHome.latitude) && Number.isFinite(currentHome.longitude) && Number.isFinite(target.latitude) && Number.isFinite(target.longitude)
    ? calculateDistanceMeters(currentHome.latitude, currentHome.longitude, target.latitude, target.longitude)
    : null;

  const hasGpsFix = hasFreshVehicleGps;
  const isExtremelyFar = distFromVehicle != null && distFromVehicle > 50_000;

  const isSending = transaction.status === 'SENDING' || transaction.status === 'WAITING_ACK' || transaction.status === 'VERIFYING_HOME';
  const isSuccess = transaction.status === 'SUCCESS';
  const isFailed = transaction.status === 'FAILED';
  const parsedAltitudeMsl = Number(altitudeText.trim().replace(',', '.'));
  const hasRequiredAltitude = target.source === 'VEHICLE'
    || (altitudeText.trim().length > 0 && Number.isFinite(parsedAltitudeMsl));
  const canConfirm = truth.connected && hasGpsFix && hasRequiredAltitude;

  const handleConfirm = async () => {
    try {
      if (target.source === 'VEHICLE') {
        await homeService.setHomeToVehicle();
      } else if (target.source === 'PHONE') {
        await homeService.setHomeToPhone({
          latitude: target.latitude,
          longitude: target.longitude,
          accuracy: target.accuracy,
          altitudeMsl: parsedAltitudeMsl,
        });
      } else {
        await homeService.setHomeToLocation(
          target.latitude,
          target.longitude,
          parsedAltitudeMsl,
          target.label,
        );
      }
    } catch (err) {
      console.warn('[SetHome] Confirm error:', err);
    }
  };

  const handleCancel = () => {
    dispatch(resetHomeTransaction());
    dispatch(setSelectingOnMap(false));
    onClose();
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel} />

      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="home-map-marker" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>SET HOME POSITION</Text>
            <Text style={styles.subtitle}>{target.label}</Text>
          </View>
          <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={18} color={glass.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Details Table wrapped in ScrollView */}
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollBodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Latitude</Text>
            <Text style={styles.fieldValue}>{formatCoord(target.latitude, 7)}°</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Longitude</Text>
            <Text style={styles.fieldValue}>{formatCoord(target.longitude, 7)}°</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Altitude (AMSL)</Text>
            {target.source === 'VEHICLE' ? (
              <Text style={styles.fieldValue}>Autopilot current position</Text>
            ) : (
              <TextInput
                accessibilityLabel="Home altitude above mean sea level"
                value={altitudeText}
                onChangeText={setAltitudeText}
                keyboardType="decimal-pad"
                placeholder="Required MSL metres"
                placeholderTextColor={glass.textDim}
                style={styles.altitudeInput}
              />
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Distance from Aircraft</Text>
            <Text style={[styles.fieldValue, { color: colors.primary }]}>{formatDistance(distFromVehicle)}</Text>
          </View>
          {distFromPrevHome != null ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Distance from Previous Home</Text>
              <Text style={styles.fieldValue}>{formatDistance(distFromPrevHome)}</Text>
            </View>
          ) : null}

          {/* Pre-flight advisory warnings */}
          {!hasGpsFix ? (
            <View style={[styles.warningBox, styles.gpsWarningBox]}>
              <MaterialCommunityIcons name="crosshairs-gps" size={15} color={colors.warning} />
              <Text style={[styles.warningText, { color: '#B45309' }]}>
                Máy bay chưa có GPS 3D fix. Autopilot có thể từ chối lưu vị trí Home khi chưa xác định được EKF origin.
              </Text>
            </View>
          ) : null}

          {isExtremelyFar ? (
            <View style={[styles.warningBox, styles.farWarningBox]}>
              <MaterialCommunityIcons name="map-marker-distance" size={15} color={colors.danger} />
              <Text style={[styles.warningText, { color: colors.danger }]}>
                Vị trí Home cách máy bay {formatDistance(distFromVehicle)} (quá xa vị trí máy bay). Autopilot sẽ từ chối vị trí này.
              </Text>
            </View>
          ) : null}

          {/* Standard Warning Box */}
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="shield-alert-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              Thao tác này thay đổi vị trí Home của máy bay khi kích hoạt RTL (Return To Launch).
            </Text>
          </View>

          {/* Status messages */}
          {isSending ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>
                {transaction.status === 'VERIFYING_HOME'
                  ? 'Đang xác thực phản hồi HOME_POSITION từ máy bay...'
                  : 'Đang gửi lệnh MAV_CMD_DO_SET_HOME tới autopilot...'}
              </Text>
            </View>
          ) : null}

          {isSuccess ? (
            <View style={[styles.statusBox, styles.statusSuccess]}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.statusText, { color: colors.success }]}>
                Đã cập nhật vị trí Home thành công trên autopilot!
              </Text>
            </View>
          ) : null}

          {isFailed ? (
            <View style={[styles.statusBox, styles.statusFailed]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.statusText, { color: colors.danger }]}>
                {formatMavError(transaction.error)}
              </Text>
            </View>
          ) : null}
        </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={handleCancel}
              disabled={isSending}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn, (isSending || !canConfirm) && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={isSending || isSuccess || !canConfirm}
            >
              <Text style={styles.confirmText}>
                {isSending ? 'SENDING...' : isSuccess ? 'CONFIRMED' : 'CONFIRM SET HOME'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(5, 10, 17, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    zIndex: layers.critical + 20,
    elevation: layers.critical + 20,
  },
  backdrop: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '94%',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  scrollBody: {
    maxHeight: 220,
  },
  scrollBodyContent: {
    paddingVertical: 8,
    gap: 7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingVertical: 12,
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  altitudeInput: {
    minWidth: 132,
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginVertical: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.md,
    padding: 8,
    marginTop: 4,
  },
  gpsWarningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  farWarningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  warningText: {
    flex: 1,
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
    lineHeight: 13.5,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(47, 128, 237, 0.08)',
    borderRadius: radius.md,
    padding: 9,
    marginTop: 4,
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  btn: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  cancelText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '800',
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
