import React, { useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AiActionProposal } from '../../../services/ai/intents/AiIntentTypes';
import { aiActionExecutor } from '../../../services/ai/actions/AiActionExecutor';
import { aiService } from '../../../services/ai/AiService';
import { classifyAiActionFailure, buildAiActionNaturalStatus } from '../../../services/ai/actions/AiActionFeedback';
import { useAppSelector } from '../../../store/hooks';
import { selectConnectionStatus, selectVehicleState } from '../../../store/connection/connectionSlice';
import { selectAltitude, selectStatusTexts } from '../../../store/telemetry/telemetrySlice';
import { selectDroneMode } from '../../../store/drone/droneSlice';

interface Props {
  proposal: AiActionProposal;
  currentSessionId?: string | null;
}

export const AiActionCard: React.FC<Props> = ({ proposal, currentSessionId }) => {
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const holdIntervalRef = useRef<any>(null);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const vehicleState = useAppSelector(selectVehicleState);
  const mode = useAppSelector(selectDroneMode);
  const altitude = useAppSelector(selectAltitude);
  const statusTexts = useAppSelector(selectStatusTexts);

  const recentWarnings = statusTexts
    .filter(msg => Date.now() - msg.timestamp < 30_000)
    .map(msg => msg.text);
  const failure = classifyAiActionFailure(proposal, recentWarnings);
  const naturalStatus = buildAiActionNaturalStatus(proposal, failure);
  const title = proposal.title.replace(/^ARM VEHICLE$/i, 'ARM AIRCRAFT');

  const isTerminal = proposal.state === 'SUCCESS'
    || proposal.state === 'ACKNOWLEDGED'
    || proposal.state === 'FAILED'
    || proposal.state === 'PREARM_FAILED'
    || proposal.state === 'COMMAND_DENIED'
    || proposal.state === 'TIMEOUT'
    || proposal.state === 'CANCELLED';
  const isExecuting = proposal.state === 'VALIDATING' || proposal.state === 'SENDING' || proposal.state === 'WAITING_ACK' || proposal.state === 'VERIFYING';

  const handleCancel = () => {
    aiActionExecutor.cancelProposal(proposal, updated => {
      aiService.updateProposal(updated.id, updated);
    });
  };

  const handleConfirm = async () => {
    await aiActionExecutor.executeConfirmed(proposal, currentSessionId, updated => {
      aiService.updateProposal(updated.id, updated);
    });
  };

  const startHold = () => {
    if (isTerminal || isExecuting) return;
    setHolding(true);
    setHoldProgress(0);

    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds hold

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      setHoldProgress(progress);

      if (progress >= 1) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        setHolding(false);
        setHoldProgress(0);
        void handleConfirm();
      }
    }, 40);
  };

  const cancelHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHolding(false);
    setHoldProgress(0);
  };

  const getStatusColor = () => {
    switch (proposal.state) {
      case 'SUCCESS': return '#10B981';
      case 'ACKNOWLEDGED': return '#10B981';
      case 'PREARM_FAILED': return '#F97316';
      case 'COMMAND_DENIED': return '#EF4444';
      case 'TIMEOUT': return '#F59E0B';
      case 'FAILED': return '#EF4444';
      case 'CANCELLED': return '#94A3B8';
      case 'WAITING_CONFIRMATION': return '#F59E0B';
      default: return '#2586EA';
    }
  };

  const getStatusText = () => {
    switch (proposal.state) {
      case 'WAITING_CONFIRMATION': return 'CHỜ PHI CÔNG XÁC NHẬN';
      case 'VALIDATING': return 'ĐANG KIỂM TRA AN TOÀN...';
      case 'SENDING': return 'ĐANG GỬI LỆNH...';
      case 'WAITING_ACK': return 'CHỜ XÁC NHẬN...';
      case 'VERIFYING': return 'ĐANG XÁC MINH TRẠNG THÁI...';
      case 'SUCCESS':
      case 'ACKNOWLEDGED': return 'THÀNH CÔNG';
      case 'PREARM_FAILED': return 'PRE-ARM FAILED';
      case 'COMMAND_DENIED': return 'BỊ TỪ CHỐI';
      case 'TIMEOUT': return 'TIMEOUT';
      case 'FAILED': return 'CHƯA THÀNH CÔNG';
      case 'CANCELLED': return 'ĐÃ HỦY LỆNH';
      default: return proposal.state;
    }
  };

  const rows = [
    { label: 'Connection', value: connectionStatus === 'CONNECTED' && vehicleState === 'CONNECTED' ? 'Connected' : 'Waiting' },
    { label: 'Mode', value: mode || '--' },
    { label: 'Altitude', value: altitude != null ? `${altitude.toFixed(1)} m` : '--' },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#2586EA" />
          <Text numberOfLines={2} style={styles.actionTitle}>{title}</Text>
        </View>
      </View>

      <Text style={styles.description}>{proposal.description}</Text>

      <View style={styles.metricList}>
        {rows.map(row => (
          <View key={row.label} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{row.label}</Text>
            <Text numberOfLines={1} style={styles.metricValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {!failure ? (
        <View style={[styles.statusRow, { borderColor: getStatusColor(), backgroundColor: `${getStatusColor()}14` }]}>
          <MaterialCommunityIcons name="information-outline" size={14} color={getStatusColor()} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </View>
      ) : (
        <View style={styles.errorBox}>
          <View style={styles.errorHeader}>
            <MaterialCommunityIcons name="alert-circle" size={15} color="#EA580C" />
            <Text style={styles.errorTitle}>{failure.title}</Text>
          </View>
          <Text style={styles.errorReason}>{failure.reason}</Text>
          {naturalStatus ? <Text style={styles.errorNatural}>{naturalStatus}</Text> : null}
          {failure.technical ? (
            <>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Xem chi tiết kỹ thuật"
                style={styles.detailButton}
                onPress={() => setShowDetails(value => !value)}
              >
                <Text style={styles.detailButtonText}>{showDetails ? 'ẨN CHI TIẾT' : 'XEM CHI TIẾT'}</Text>
              </TouchableOpacity>
              {showDetails ? (
                <View style={styles.technicalBox}>
                  <Text style={styles.technicalLabel}>ArduPilot</Text>
                  <Text style={styles.technicalText}>{failure.technical}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      )}

      {!isTerminal && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Hủy lệnh"
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={isExecuting}
          >
            <Text style={styles.cancelBtnText}>HỦY BỎ</Text>
          </TouchableOpacity>

          {proposal.requiresHoldConfirmation ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Giữ để xác nhận"
              style={[styles.confirmBtn, styles.holdConfirmBtn, isExecuting && styles.disabledBtn]}
              onPressIn={startHold}
              onPressOut={cancelHold}
              activeOpacity={0.85}
              disabled={isExecuting}
            >
              {holding && (
                <View style={[styles.holdProgressOverlay, { width: `${holdProgress * 100}%` }]} />
              )}
              {isExecuting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.btnInner}>
                  <MaterialCommunityIcons name="gesture-tap-hold" size={16} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>
                    {holding ? `GIỮ... ${Math.round(holdProgress * 100)}%` : 'GIỮ 1.2S XÁC NHẬN'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Xác nhận"
              style={[styles.confirmBtn, isExecuting && styles.disabledBtn]}
              onPress={handleConfirm}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.btnInner}>
                  <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>XÁC NHẬN</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 134, 234, 0.35)',
    padding: 10,
    marginVertical: 6,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  description: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    flexShrink: 1,
  },
  metricList: {
    gap: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.20)',
    paddingVertical: 6,
  },
  metricRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
  },
  metricValue: {
    flexShrink: 1,
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '900',
  },
  statusRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  statusText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '900',
  },
  errorBox: {
    minWidth: 0,
    gap: 5,
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    borderRadius: 8,
    padding: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#C2410C',
    flex: 1,
    minWidth: 0,
  },
  errorReason: {
    color: '#7C2D12',
    fontSize: 11.5,
    lineHeight: 15.5,
    fontWeight: '800',
  },
  errorNatural: {
    color: '#7F1D1D',
    fontSize: 10.5,
    lineHeight: 14.5,
    fontWeight: '600',
  },
  detailButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    marginTop: 2,
  },
  detailButtonText: {
    color: '#C2410C',
    fontSize: 9.5,
    fontWeight: '900',
  },
  technicalBox: {
    borderRadius: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    padding: 7,
  },
  technicalLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 2,
  },
  technicalText: {
    color: '#0F172A',
    fontSize: 10.5,
    lineHeight: 14.5,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    minWidth: 0,
  },
  cancelBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 2,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#2586EA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  holdConfirmBtn: {
    backgroundColor: '#EA580C',
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  holdProgressOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
