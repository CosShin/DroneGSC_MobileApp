import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MissionItemInt, MissionVerificationResult } from '../../services/mission/MissionTypes';
import { getCommandDefinition, getFrameLabel } from '../../services/mission/MissionCommandRegistry';
import { glassShadow, layers, radius } from '../../theme/gcsTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  wireItems: MissionItemInt[];
  verificationResult: MissionVerificationResult | null;
  onVerify?: () => void;
  isVerifying?: boolean;
}

export function RawMissionDebugModal({
  visible,
  onClose,
  wireItems,
  verificationResult,
  onVerify,
  isVerifying,
}: Props) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="code-json" size={20} color="#2586EA" />
              <Text style={styles.headerTitle}>MAVLink Raw Mission Items (MISSION_ITEM_INT)</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Verification Status Banner (if available) */}
          {verificationResult ? (
            <View style={[styles.verifyBanner, verificationResult.match ? styles.verifySuccess : styles.verifyMismatch]}>
              <MaterialCommunityIcons 
                name={verificationResult.match ? 'check-circle-outline' : 'alert-circle-outline'} 
                size={18} 
                color={verificationResult.match ? '#10B981' : '#DC2626'} 
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.verifyTitle, { color: verificationResult.match ? '#10B981' : '#DC2626' }]}>
                  {verificationResult.match ? 'MISSION VERIFIED — 100% MATCH' : 'MISSION MISMATCH DETECTED'}
                </Text>
                <Text style={styles.verifyDetails}>
                  {verificationResult.match 
                    ? `Autopilot confirmed all ${verificationResult.uploadedCount} mission items identically.` 
                    : `Found ${verificationResult.diffs.length} discrepancy between local and autopilot.`}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colSeq]}>SEQ</Text>
            <Text style={[styles.th, styles.colCmd]}>COMMAND</Text>
            <Text style={[styles.th, styles.colFrame]}>FRAME</Text>
            <Text style={[styles.th, styles.colP]}>P1</Text>
            <Text style={[styles.th, styles.colP]}>P2</Text>
            <Text style={[styles.th, styles.colP]}>P3</Text>
            <Text style={[styles.th, styles.colP]}>P4</Text>
            <Text style={[styles.th, styles.colCoord]}>X (LAT)</Text>
            <Text style={[styles.th, styles.colCoord]}>Y (LNG)</Text>
            <Text style={[styles.th, styles.colAlt]}>Z (ALT)</Text>
            <Text style={[styles.th, styles.colAuto]}>AUTO</Text>
          </View>

          {/* Table Rows */}
          <ScrollView style={styles.tableScroll} contentContainerStyle={styles.tableScrollContent}>
            {wireItems.length ? (
              wireItems.map((item, idx) => {
                const def = getCommandDefinition(item.command);
                const isEven = idx % 2 === 0;
                return (
                  <View key={item.seq} style={[styles.tableRow, isEven && styles.rowEven]}>
                    <Text style={[styles.td, styles.colSeq, styles.seqText]}>{item.seq}</Text>
                    <View style={styles.colCmd}>
                      <Text numberOfLines={1} style={styles.cmdText}>{def.name}</Text>
                      <Text numberOfLines={1} style={styles.cmdSub}>{def.label}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.td, styles.colFrame]}>{getFrameLabel(item.frame)}</Text>
                    <Text style={[styles.td, styles.colP]}>{item.param1.toFixed(1)}</Text>
                    <Text style={[styles.td, styles.colP]}>{item.param2.toFixed(1)}</Text>
                    <Text style={[styles.td, styles.colP]}>{item.param3.toFixed(1)}</Text>
                    <Text style={[styles.td, styles.colP]}>{item.param4.toFixed(1)}</Text>
                    <Text numberOfLines={1} style={[styles.td, styles.colCoord]}>{item.x !== 0 ? (item.x / 1e7).toFixed(6) : '0'}</Text>
                    <Text numberOfLines={1} style={[styles.td, styles.colCoord]}>{item.y !== 0 ? (item.y / 1e7).toFixed(6) : '0'}</Text>
                    <Text style={[styles.td, styles.colAlt]}>{item.z.toFixed(1)}m</Text>
                    <Text style={[styles.td, styles.colAuto]}>{item.autocontinue ? 'YES' : 'NO'}</Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No compiled wire items available. Upload or compile mission first.</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {onVerify ? (
              <TouchableOpacity 
                style={[styles.verifyBtn, isVerifying && styles.btnDisabled]} 
                disabled={isVerifying}
                onPress={onVerify}
              >
                <MaterialCommunityIcons name="check-decagram-outline" size={16} color="#FFFFFF" />
                <Text style={styles.verifyBtnText}>{isVerifying ? 'VERIFYING...' : 'VERIFY WITH AUTOPILOT'}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 35, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '96%',
    maxWidth: 960,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...glassShadow,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  verifySuccess: {
    backgroundColor: '#ECFDF5',
  },
  verifyMismatch: {
    backgroundColor: '#FEF2F2',
  },
  verifyTitle: {
    fontSize: 11,
    fontWeight: '900',
  },
  verifyDetails: {
    color: '#475569',
    fontSize: 9.5,
    marginTop: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    height: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  th: {
    color: '#475569',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tableScroll: {
    flex: 1,
  },
  tableScrollContent: {
    paddingVertical: 2,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowEven: {
    backgroundColor: '#F8FAFC',
  },
  td: {
    color: '#1E293B',
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
  colSeq: { width: 34, textAlign: 'center' },
  colCmd: { width: 140 },
  colFrame: { width: 85 },
  colP: { width: 42, textAlign: 'right' },
  colCoord: { width: 80, textAlign: 'right' },
  colAlt: { width: 50, textAlign: 'right' },
  colAuto: { width: 44, textAlign: 'center' },
  seqText: { fontWeight: '900', color: '#2586EA' },
  cmdText: { fontSize: 8.5, fontWeight: '900', color: '#0F172A' },
  cmdSub: { fontSize: 7.5, color: '#64748B' },
  emptyWrap: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: '#2586EA',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  doneBtn: {
    paddingHorizontal: 16,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#E2E8F0',
  },
  doneBtnText: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '900',
  },
});
