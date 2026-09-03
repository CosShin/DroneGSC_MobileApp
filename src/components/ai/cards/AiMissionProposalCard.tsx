import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AiActionProposal, MissionProposalParams } from '../../../services/ai/intents/AiIntentTypes';
import { aiMissionGenerator } from '../../../services/ai/mission/AiMissionGenerator';
import { aiActionExecutor } from '../../../services/ai/actions/AiActionExecutor';
import { aiService } from '../../../services/ai/AiService';
import { store } from '../../../store';
import { setEditorItems } from '../../../store/mission/missionSlice';
import { universalConnectionService } from '../../../services/connection/UniversalConnectionService';
import { AiActionCard } from './AiActionCard';

interface Props {
  proposal: AiActionProposal;
  currentSessionId?: string | null;
  onViewOnMap?: () => void;
}

export const AiMissionProposalCard: React.FC<Props> = ({
  proposal,
  currentSessionId,
  onViewOnMap,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (proposal.intent.type !== 'CREATE_MISSION') return null;

  const missionParams: MissionProposalParams = proposal.intent.proposal;
  const compiled = aiMissionGenerator.generateMission(missionParams);

  const handleCancel = () => {
    aiActionExecutor.cancelProposal(proposal, updated => {
      aiService.updateProposal(updated.id, updated);
    });
  };

  const handleLoadToMap = () => {
    // Load editor items into Redux mission slice
    store.dispatch(setEditorItems(compiled.editorItems));
    onViewOnMap?.();
  };

  const handleConfirmAndUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // 1. First load into editor store
      store.dispatch(setEditorItems(compiled.editorItems));

      // 2. Upload via MavlinkMissionService if connected
      const connState = store.getState().connection;
      if (connState.status === 'CONNECTED' && connState.vehicleState === 'CONNECTED') {
        const missionService = universalConnectionService.getMissionService();
        await missionService.upload(compiled.wireItems, (progress) => {
          setUploadProgress(Math.round(progress * 100));
        });
      }

      setUploadSuccess(true);
      proposal.state = 'SUCCESS';
      aiService.updateProposal(proposal.id, proposal);
    } catch (err: any) {
      setUploadError(err?.message || 'Không thể nạp mission lên máy bay.');
      proposal.state = 'FAILED';
      proposal.error = err?.message;
      aiService.updateProposal(proposal.id, proposal);
    } finally {
      setUploading(false);
    }
  };

  const isTerminal = proposal.state === 'SUCCESS' || proposal.state === 'FAILED' || proposal.state === 'CANCELLED';

  const startMissionProposal: AiActionProposal = {
    id: `start-mission-${proposal.id}`,
    intent: { type: 'START_MISSION' },
    requiresConfirmation: true,
    requiresHoldConfirmation: true,
    title: 'BẮT ĐẦU BAY MISSION (AUTO)',
    description: 'Chuyển chế độ sang AUTO để bắt đầu lộ trình bay tự động.',
    state: 'WAITING_CONFIRMATION',
    proposedAt: Date.now(),
    vehicleSessionId: currentSessionId,
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <MaterialCommunityIcons name="map-marker-path" size={18} color="#2586EA" />
          <Text style={styles.actionTitle}>KẾ HOẠCH BAY ĐỀ XUẤT</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{missionParams.waypoints.length} WAYPOINTS</Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>CẤT CÁNH</Text>
          <Text style={styles.metricVal}>{missionParams.takeoffAltitudeMeters}m</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>TỐC ĐỘ</Text>
          <Text style={styles.metricVal}>{missionParams.speedMetersPerSecond || 5} m/s</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>QUÃNG ĐƯỜNG</Text>
          <Text style={styles.metricVal}>{compiled.totalDistanceMeters}m</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>THỜI GIAN ƯỚC TÍNH</Text>
          <Text style={styles.metricVal}>{Math.round(compiled.estimatedDurationSeconds / 60)} phút</Text>
        </View>
      </View>

      {/* Waypoint list preview */}
      <View style={styles.wpList}>
        <View style={styles.wpItem}>
          <Text style={styles.wpSeq}>0</Text>
          <Text style={styles.wpAction}>TAKEOFF</Text>
          <Text style={styles.wpAlt}>{missionParams.takeoffAltitudeMeters}m</Text>
        </View>
        {missionParams.waypoints.slice(0, 3).map((wp, idx) => (
          <View key={idx} style={styles.wpItem}>
            <Text style={styles.wpSeq}>{idx + 1}</Text>
            <Text style={styles.wpAction}>WAYPOINT</Text>
            <Text style={styles.wpCoords}>{wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}</Text>
            <Text style={styles.wpAlt}>{wp.altitudeMeters}m</Text>
          </View>
        ))}
        {missionParams.waypoints.length > 3 && (
          <Text style={styles.wpMore}>+ {missionParams.waypoints.length - 3} waypoints khác...</Text>
        )}
        <View style={styles.wpItem}>
          <Text style={styles.wpSeq}>{missionParams.waypoints.length + 1}</Text>
          <Text style={styles.wpAction}>{missionParams.endAction || 'RTL'}</Text>
        </View>
      </View>

      {/* Upload progress & error display */}
      {uploading && (
        <View style={styles.progressWrap}>
          <ActivityIndicator size="small" color="#2586EA" />
          <Text style={styles.progressText}>Đang nạp mission qua MAVLink ({uploadProgress}%)...</Text>
        </View>
      )}

      {uploadError && (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{uploadError}</Text>
        </View>
      )}

      {uploadSuccess && (
        <View style={styles.successBlock}>
          <View style={styles.successHeader}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.successText}>ĐÃ NẠP LÊN MÁY BAY THÀNH CÔNG</Text>
          </View>
          <Text style={styles.startAdviceText}>
            Lưu ý an toàn: Mission đã sẵn sàng trong bộ nhớ Pixhawk. Bạn có thể bắt đầu bay tự động bằng nút bên dưới hoặc chuyển chế độ AUTO.
          </Text>
          <AiActionCard
            proposal={startMissionProposal}
            currentSessionId={currentSessionId}
          />
        </View>
      )}

      {/* Actions */}
      {!isTerminal && !uploadSuccess && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Hủy"
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={uploading}
          >
            <Text style={styles.cancelBtnText}>HỦY</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Xem trên bản đồ"
            style={styles.mapBtn}
            onPress={handleLoadToMap}
            disabled={uploading}
          >
            <MaterialCommunityIcons name="map-search-outline" size={15} color="#2586EA" />
            <Text style={styles.mapBtnText}>XEM BẢN ĐỒ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Nạp Mission"
            style={styles.uploadBtn}
            onPress={handleConfirmAndUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.btnInner}>
                <MaterialCommunityIcons name="upload" size={15} color="#FFFFFF" />
                <Text style={styles.uploadBtnText}>NẠP MISSION</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
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
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  badge: {
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#2586EA',
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(240, 246, 255, 0.8)',
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.15)',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#1E293B',
  },
  wpList: {
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  wpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wpSeq: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(37, 134, 234, 0.15)',
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 9.5,
    fontWeight: '900',
    color: '#2586EA',
  },
  wpAction: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    minWidth: 60,
  },
  wpCoords: {
    flex: 1,
    fontSize: 9.5,
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  wpAlt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2586EA',
  },
  wpMore: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingLeft: 26,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2586EA',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  successBlock: {
    gap: 6,
    paddingTop: 4,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(236, 253, 245, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  startAdviceText: {
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  mapBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2586EA',
  },
  uploadBtn: {
    flex: 1.3,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#2586EA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2586EA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
