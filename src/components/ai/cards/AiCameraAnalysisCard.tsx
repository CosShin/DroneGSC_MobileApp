import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SemanticStructuredCard } from '../../../services/ai/AiTypes';

interface Props {
  card: SemanticStructuredCard;
}

export const AiCameraAnalysisCard = React.memo(function AiCameraAnalysisCard({ card }: Props) {
  const metrics = card.metrics || [];
  const findings = card.findings || [];
  const recommendations = card.recommendations || [];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="camera-outline" size={14} color="#EC4899" />
          </View>
          <Text style={styles.title}>{card.title || 'CAMERA ANALYSIS'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>VISION AI</Text>
        </View>
      </View>

      {/* Summary */}
      {card.summary ? (
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeading}>Summary</Text>
          <Text style={styles.summaryText}>{card.summary}</Text>
        </View>
      ) : null}

      {/* Metric Pills */}
      {metrics.length > 0 && (
        <View style={styles.pillsRow}>
          {metrics.map((m, idx) => (
            <View key={`${m.label}-${idx}`} style={styles.metricPill}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={[styles.metricVal, m.tone === 'warning' && styles.metricValWarn]}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Findings</Text>
          {findings.map((f, idx) => (
            <View key={`finding-${idx}`} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Recommendation</Text>
          {recommendations.map((r, idx) => (
            <View key={`rec-${idx}`} style={styles.bulletRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={12} color="#10B981" style={styles.recIcon} />
              <Text style={styles.recText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.22)',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.4,
  },
  statusPill: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#EC4899',
    letterSpacing: 0.3,
  },
  summarySection: {
    marginBottom: 6,
  },
  section: {
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginVertical: 4,
  },
  metricPill: {
    backgroundColor: 'rgba(241, 245, 249, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
  },
  metricVal: {
    fontSize: 9,
    fontWeight: '900',
    color: '#334155',
  },
  metricValWarn: {
    color: '#F59E0B',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  bulletDot: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 5,
    lineHeight: 15,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14.5,
    color: '#334155',
    fontWeight: '500',
  },
  recIcon: {
    marginRight: 4,
    marginTop: 1,
  },
  recText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14.5,
    color: '#0F766E',
    fontWeight: '600',
  },
});
