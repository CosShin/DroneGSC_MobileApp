import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SemanticStructuredCard } from '../../../services/ai/AiTypes';

interface Props {
  card: SemanticStructuredCard;
}

export const AiFlightStatusCard = React.memo(function AiFlightStatusCard({ card }: Props) {
  const metrics = card.metrics || [];

  const getToneColor = (tone?: string) => {
    switch (tone) {
      case 'primary': return '#2586EA';
      case 'success': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'danger': return '#EF4444';
      default: return '#334155';
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="quadcopter" size={14} color="#2586EA" />
          </View>
          <Text style={styles.title}>{card.title || 'FLIGHT STATUS'}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>LIVE</Text>
        </View>
      </View>

      {/* Metric Grid */}
      <View style={styles.grid}>
        {metrics.map((m, idx) => (
          <View key={`${m.label}-${idx}`} style={styles.gridCell}>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text
              numberOfLines={1}
              style={[styles.metricValue, { color: getToneColor(m.tone) }]}
            >
              {m.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Summary Conclusion */}
      {card.summary ? (
        <View style={styles.summaryBox}>
          <MaterialCommunityIcons name="information-outline" size={13} color="#2586EA" style={styles.summaryIcon} />
          <Text style={styles.summaryText}>{card.summary}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.22)',
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
    marginBottom: 8,
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
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridCell: {
    width: '33.33%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.2,
    marginBottom: 1.5,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(240, 246, 255, 0.75)',
    borderRadius: 8,
    padding: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.14)',
  },
  summaryIcon: {
    marginRight: 5,
    marginTop: 1,
  },
  summaryText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14.5,
    color: '#334155',
    fontWeight: '600',
  },
});
