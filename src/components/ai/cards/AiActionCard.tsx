import React, { useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AiActionProposal } from '../../../services/ai/intents/AiIntentTypes';
import { aiActionExecutor } from '../../../services/ai/actions/AiActionExecutor';
import { aiService } from '../../../services/ai/AiService';

interface Props {
  proposal: AiActionProposal;
  currentSessionId?: string | null;
}

export const AiActionCard: React.FC<Props> = ({ proposal, currentSessionId }) => {
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<any>(null);

  const isTerminal = proposal.state === 'SUCCESS' || proposal.state === 'FAILED' || proposal.state === 'CANCELLED';
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
      case 'SENDING': return 'ĐANG GỬI LỆNH MAVLINK...';
      case 'WAITING_ACK': return 'CHỜ AUTOPILOT PHẢN HỒI (ACK)...';
      case 'VERIFYING': return 'ĐANG XÁC MINH TRẠNG THÁI...';
      case 'SUCCESS': return 'ĐÃ XÁC NHẬN BỞI PHƯƠNG TIỆN ✓';
      case 'FAILED': return 'LỆNH BỊ TỪ CHỐI / THẤT BẠI ✕';
      case 'CANCELLED': return 'ĐÃ HỦY LỆNH';
      default: return proposal.state;
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#2586EA" />
          <Text style={styles.actionTitle}>{proposal.title}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20`, borderColor: getStatusColor() }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>{proposal.description}</Text>

      {/* Error reason if any */}
      {proposal.error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle" size={14} color="#DC2626" />
          <Text style={styles.errorText}>Lý do: {proposal.error}</Text>
        </View>
      ) : null}

      {/* Interactive Buttons */}
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
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 134, 234, 0.35)',
    padding: 12,
    marginVertical: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  description: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 8,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
    letterSpacing: 0.3,
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
