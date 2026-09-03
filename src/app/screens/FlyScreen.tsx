import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DiagnosticsOverlay } from '../../components/common/DiagnosticsOverlay';
import { WarningBanner } from '../../components/common/WarningBanner';
import { CommandButton } from '../../components/gcs/Primitives';
import { VirtualJoystick } from '../../components/joystick/VirtualJoystick';
import { joystickProcessor } from '../../services/joystick/JoystickProcessor';
import { FlyMainViewport } from '../../components/flight/FlyMainViewport';
import { CompactFlightHud } from '../../components/hud/CompactFlightHud';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectFlightDisplayMode,
  selectPrimaryFlyView,
  selectShowJoysticks,
  selectVideoSettings,
  setAutomaticFlightDisplay,
  setFlightDisplayMode,
  setPrimaryFlyView,
  setAiAssistantOpen,
} from '../../store/settings/settingsSlice';
import { FlightAssistantButton } from '../../components/ai/FlightAssistantButton';
import { selectVideoRuntime } from '../../store/videoSlice';
import { selectIsArmed, selectDroneMode } from '../../store/drone/droneSlice';
import { selectPendingCommand } from '../../store/command/commandSlice';
import { safetyLayer } from '../../services/command/SafetyLayer';
import { FlightMode } from '../../types/command';
import { glassShadow, layers, radius } from '../../theme/gcsTheme';
import { useScreenOrientation } from '../../hooks/useScreenOrientation';
import { useTruthfulTelemetry } from '../../hooks/useTruthfulTelemetry';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { resolveInitialFlightDisplay } from '../../video/FlightDisplayState';

const MODES = [
  FlightMode.STABILIZE,
  FlightMode.ALT_HOLD,
  FlightMode.LOITER,
  FlightMode.GUIDED,
  FlightMode.AUTO,
  FlightMode.RTL,
  FlightMode.LAND
];

/**
 * FlyScreen is the central flight cockpit screen of ANITECH GCS.
 * Rebuilt according to reference image with direct view switching in the bottom toolbar.
 */
export function FlyScreen() {
  useScreenOrientation();
  const dispatch = useAppDispatch();
  const truth = useTruthfulTelemetry();
  const layout = useGcsLayout();

  const primaryView = useAppSelector(selectPrimaryFlyView);
  const displayMode = useAppSelector(selectFlightDisplayMode);
  const videoSettings = useAppSelector(selectVideoSettings);
  const videoRuntime = useAppSelector(selectVideoRuntime);
  const showSticks = useAppSelector(selectShowJoysticks);
  const armed = useAppSelector(selectIsArmed);
  const mode = useAppSelector(selectDroneMode);
  const pending = useAppSelector(selectPendingCommand);

  const [modeSheet, setModeSheet] = React.useState(false);
  const [displayNotice, setDisplayNotice] = React.useState<string | null>(null);
  const initialDisplayResolved = React.useRef(false);
  const videoWasLive = React.useRef(false);
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDisplayNotice = React.useCallback((message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setDisplayNotice(message);
    noticeTimer.current = setTimeout(() => setDisplayNotice(null), 2600);
  }, []);

  React.useEffect(() => {
    if (initialDisplayResolved.current) return;
    initialDisplayResolved.current = true;
    const configured = videoSettings.transport === 'WEBRTC' && videoSettings.host.trim().length > 0;
    dispatch(setAutomaticFlightDisplay(resolveInitialFlightDisplay(configured, videoRuntime.status)));
  }, [dispatch, videoRuntime.status, videoSettings.host, videoSettings.transport]);

  React.useEffect(() => {
    if (videoRuntime.status === 'LIVE') {
      videoWasLive.current = true;
      if (displayMode !== 'VIDEO') {
        dispatch(setFlightDisplayMode('VIDEO'));
      }
      return;
    }
    if (displayMode !== 'HUD') {
      const reconnecting = videoRuntime.status === 'CONNECTING' || videoRuntime.status === 'RECONNECTING';
      const timeout = setTimeout(() => {
        dispatch(setFlightDisplayMode('HUD'));
        if (videoWasLive.current) {
          showDisplayNotice('Video offline — HUD active');
        }
      }, reconnecting ? 3000 : 0);
      return () => clearTimeout(timeout);
    }
  }, [dispatch, displayMode, showDisplayNotice, videoRuntime.status]);

  React.useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  React.useEffect(() => {
    joystickProcessor.start();
    return () => joystickProcessor.stop();
  }, []);

  const stickSize = Math.max(
    128,
    Math.min(
      layout.isCompactLandscape ? 144 : layout.isTabletLandscape ? 168 : 156,
      layout.contentHeight * 0.39
    )
  );
  const ready = truth.connected && !pending;

  const confirm = (label: string, run: () => void) => {
    Alert.alert(
      `Confirm ${label}`,
      `Send ${label} to the connected vehicle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Execute', style: 'destructive', onPress: run }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* 1. Main Flight Viewport (Manages HUD, Video, Map layers with state preservation) */}
      <FlyMainViewport primaryView={primaryView} displayMode={displayMode} />

      {/* 2. Safety Warnings / PreArm Alert Banner (Positioned cleanly at top center) */}
      <WarningBanner />

      {/* 3. Virtual Joysticks (rendered in lower left / lower right matching reference) */}
      {showSticks && truth.connected && primaryView === 'FLIGHT' ? (
        <View style={styles.controlsLayer} pointerEvents="box-none">
          <View style={[styles.leftStick, layout.isCompactLandscape && styles.leftStickCompact]} pointerEvents="auto">
            <VirtualJoystick
              size={stickSize}
              mode="THROTTLE_YAW"
              onUpdate={(x, y, active) => joystickProcessor.updateLeftStick(x, y, active)}
            />
          </View>
          <View style={[styles.rightStick, layout.isCompactLandscape && styles.rightStickCompact]} pointerEvents="auto">
            <VirtualJoystick
              size={stickSize}
              mode="PITCH_ROLL"
              onUpdate={(x, y, active) => joystickProcessor.updateRightStick(x, y, active)}
            />
          </View>
        </View>
      ) : null}

      {/* Compact FPV instruments stay readable over video without stealing touch input. */}
      {primaryView === 'FLIGHT' && displayMode === 'VIDEO' ? (
        <View style={styles.videoFlightHud} pointerEvents="none">
          <CompactFlightHud />
        </View>
      ) : null}

      {/* MODE now occupies the former WebRTC badge position. */}
      <CommandButton
        label={`MODE ${mode || '--'}`}
        icon="tune-variant"
        tone="primary"
        style={layout.isCompactLandscape
          ? [styles.modeQuickAction, styles.modeQuickActionCompact]
          : styles.modeQuickAction}
        disabled={!truth.connected}
        onPress={() => setModeSheet(true)}
      />

      {displayNotice ? (
        <View pointerEvents="none" style={styles.displayNotice}>
          <MaterialCommunityIcons name="information-outline" size={14} color="#2F80ED" />
          <Text style={styles.displayNoticeText}>{displayNotice}</Text>
        </View>
      ) : null}

      {/* 4. Diagnostics Mini Button */}
      <DiagnosticsOverlay />

      {/* AI Assistant Button below the logo on the left */}
      <View
        pointerEvents="box-none"
        style={[styles.viewActionColumn, layout.isCompactLandscape && styles.viewActionColumnCompact]}
      >
        <FlightAssistantButton
          variant="rail"
          compact={layout.isCompactLandscape}
          onPress={() => dispatch(setAiAssistantOpen(true))}
        />
      </View>

      {/* ARM/TAKEOFF/LAND remain stacked on the right. */}
      <View
        pointerEvents="box-none"
        style={[styles.commandRail, layout.isCompactLandscape && styles.commandRailCompact]}
      >
          <CommandButton
            label={armed ? 'DISARM' : 'ARM'}
            icon={armed ? 'lock' : 'lock-open-outline'}
            tone={armed ? 'danger' : 'success'}
            style={styles.railAction}
            disabled={!ready}
            onPress={() => confirm(armed ? 'DISARM' : 'ARM', () => safetyLayer.executeCommand({ type: armed ? 'DISARM' : 'ARM' }))}
          />
          <CommandButton
            label="TAKEOFF"
            icon="arrow-up-bold"
            tone="primary"
            style={styles.railAction}
            disabled={!ready || !armed}
            onPress={() => confirm('TAKEOFF TO 5 M', () => safetyLayer.executeCommand({ type: 'TAKEOFF', payload: { altitude: 5 } }))}
          />
          <CommandButton
            label="LAND"
            icon="arrow-down-bold"
            tone="warning"
            style={styles.railAction}
            disabled={!ready || !armed}
            onPress={() => confirm('LAND', () => safetyLayer.executeCommand({ type: 'LAND' }))}
          />
      </View>

      {/* 6. Flight Mode Selection Modal */}
      {modeSheet ? (
        <View style={styles.modeOverlay} accessibilityViewIsModal>
          <TouchableOpacity
            accessibilityLabel="Close flight mode menu"
            activeOpacity={1}
            style={StyleSheet.absoluteFillObject}
            onPress={() => setModeSheet(false)}
          />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTitleRow}>
                <MaterialCommunityIcons name="tune-variant" size={18} color="#2586EA" />
                <Text style={styles.sheetTitle}>Select Flight Mode</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close modal"
                style={styles.sheetCloseBtn}
                onPress={() => setModeSheet(false)}
              >
                <MaterialCommunityIcons name="close" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modeList}
              contentContainerStyle={styles.modeListContent}
              showsVerticalScrollIndicator={false}
            >
              {MODES.map((item) => {
                const isCurrent = item === mode;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Set flight mode ${item}`}
                    key={item}
                    style={[styles.modeRow, isCurrent && styles.modeRowActive]}
                    onPress={() => {
                      setModeSheet(false);
                      void safetyLayer.executeCommand({ type: 'SET_MODE', payload: { mode: item } });
                    }}
                  >
                    <MaterialCommunityIcons
                      name="navigation-variant-outline"
                      size={18}
                      color={isCurrent ? '#2586EA' : '#64748B'}
                    />
                    <Text style={[styles.modeText, isCurrent && styles.modeTextActive]}>
                      {item}
                    </Text>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <MaterialCommunityIcons name="check" size={13} color="#2586EA" />
                        <Text style={styles.currentText}>ACTIVE</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#EDF4FB',
    overflow: 'hidden',
  },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: layers.controls,
  },
  leftStick: {
    position: 'absolute',
    left: 20,
    bottom: 18,
  },
  rightStick: {
    position: 'absolute',
    right: 20,
    bottom: 18,
  },
  leftStickCompact: {
    left: 10,
  },
  rightStickCompact: {
    right: 10,
  },
  modeQuickAction: {
    position: 'absolute',
    top: 10,
    left: 64,
    width: 128,
    height: 30,
    borderRadius: 15,
    zIndex: layers.controls,
    elevation: layers.controls,
  },
  modeQuickActionCompact: {
    top: 8,
    left: 58,
    width: 120,
    height: 30,
    borderRadius: 15,
  },
  displayNotice: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    zIndex: layers.hud,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    ...glassShadow,
  },
  displayNoticeText: {
    color: '#304156',
    fontSize: 9.5,
    fontWeight: '800',
  },
  videoFlightHud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    zIndex: layers.information,
    elevation: layers.information,
    alignItems: 'center',
  },
  viewActionColumn: {
    position: 'absolute',
    top: 74,
    left: 14,
    zIndex: layers.controls,
    elevation: layers.controls,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewActionColumnCompact: {
    top: 66,
    left: 10,
  },
  viewAction: {
    width: 78,
    height: 32,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  commandRail: {
    position: 'absolute',
    top: 52,
    right: 14,
    zIndex: layers.controls,
    elevation: layers.controls,
    alignItems: 'flex-end',
    gap: 4,
  },
  commandRailCompact: {
    top: 45,
    right: 10,
    gap: 5,
  },
  railAction: {
    width: 96,
    height: 34,
    borderRadius: 12,
    paddingHorizontal: 7,
  },
  modeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: layers.modal,
    elevation: layers.modal,
    backgroundColor: 'rgba(15, 25, 40, 0.40)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCard: {
    width: 320,
    maxHeight: 330,
    borderRadius: radius.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.50)',
    overflow: 'hidden',
    ...glassShadow,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: 'rgba(245, 248, 252, 0.95)',
  },
  sheetHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeList: {
    flexGrow: 0,
  },
  modeListContent: {
    padding: 8,
    gap: 4,
  },
  modeRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  modeRowActive: {
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
  },
  modeText: {
    flex: 1,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  modeTextActive: {
    color: '#2586EA',
    fontWeight: '900',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 134, 234, 0.15)',
  },
  currentText: {
    color: '#2586EA',
    fontSize: 8.5,
    fontWeight: '900',
  },
});
