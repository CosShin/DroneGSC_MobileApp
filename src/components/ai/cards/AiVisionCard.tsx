import React from 'react';
import { StyleSheet, Text, View, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  base64Image: string;
  isCloud?: boolean;
}

export const AiVisionCard: React.FC<Props> = ({ base64Image, isCloud }) => {
  const uri = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  return (
    <View style={styles.card}>
      {/* Cloud Vision Privacy Disclosure */}
      {isCloud ? (
        <View style={styles.cloudNotice}>
          <MaterialCommunityIcons name="cloud-outline" size={14} color="#2563EB" />
          <Text style={styles.cloudNoticeText}>
            CLOUD VISION: Ảnh chụp camera được gửi đến máy chủ Cloud của mô hình đã chọn.
          </Text>
        </View>
      ) : (
        <View style={styles.localNotice}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color="#059669" />
          <Text style={styles.localNoticeText}>
            LOCAL VISION: Ảnh được phân tích nội bộ trên máy tính cá nhân.
          </Text>
        </View>
      )}

      {/* Snapshot Thumbnail */}
      <View style={styles.imageContainer}>
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerRow}>
        <MaterialCommunityIcons name="information-outline" size={13} color="#64748B" />
        <Text style={styles.disclaimerText}>
          AI VISUAL ASSESSMENT: Thông tin thị giác xác suất mang tính tham khảo, không sử dụng làm vòng điều khiển tự động.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    padding: 10,
    marginVertical: 6,
    gap: 8,
  },
  cloudNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    borderRadius: 6,
    padding: 6,
  },
  cloudNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
    flex: 1,
  },
  localNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(236, 253, 245, 0.9)',
    borderRadius: 6,
    padding: 6,
  },
  localNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disclaimerText: {
    fontSize: 9.5,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
  },
});
