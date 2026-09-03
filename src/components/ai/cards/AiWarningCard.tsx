import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SemanticStructuredCard } from '../../../services/ai/AiTypes';

interface Props {
  card: SemanticStructuredCard;
}

export const AiWarningCard = React.memo(function AiWarningCard({ card }: Props) {
  const isUrgent = card.tone === 'URGENT';
  const recs = card.recommendations || [];

  return (
    <View style={[styles.card, isUrgent && styles.cardUrgent]}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, isUrgent && styles.iconCircleUrgent]}>
          <MaterialCommunityIcons
            name={isUrgent ? 'alert-octagon' : 'alert-circle-outline'}
            size={15}
            color={isUrgent ? '#EF4444' : '#F59E0B'}
          />
        </View>
        <Text style={[styles.title, isUrgent && styles.titleUrgent]}>
          {card.title || (isUrgent ? 'CẢNH BÁO KHẨN CẤP' : 'CẢNH BÁO HỆ THỐNG')}
        </Text>
      </View>

      {card.summary ? (
        <Text style={styles.summaryText}>{card.summary}</Text>
      ) : null}

      {recs.length > 0 && (
        <View style={styles.recSection}>
          {recs.map((r, idx) => (
            <View key={`rec-${idx}`} style={styles.recRow}>
              <MaterialCommunityIcons name="arrow-right-bold" size={11} color={isUrgent ? '#EF4444' : '#D97706'} style={styles.arrow} />
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
    backgroundColor: 'rgba(255, 251, 235, 0.95)',
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUrgent: {
    backgroundColor: 'rgba(254, 242, 242, 0.95)',
    borderColor: 'rgba(239, 68, 68, 0.40)',
    shadowColor: '#EF4444',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.3,
  },
  titleUrgent: {
    color: '#B91C1C',
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#334155',
    fontWeight: '600',
  },
  recSection: {
    marginTop: 5,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  arrow: {
    marginRight: 4,
  },
  recText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
});
