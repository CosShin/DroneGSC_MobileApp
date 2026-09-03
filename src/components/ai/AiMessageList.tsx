import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AiChatMessage } from '../../services/ai/AiTypes';
import { colors, radius } from '../../theme/gcsTheme';
import { AiActionCard } from './cards/AiActionCard';
import { AiMissionProposalCard } from './cards/AiMissionProposalCard';
import { AiVisionCard } from './cards/AiVisionCard';
import { AiStructuredCardRenderer } from './cards/AiStructuredCardRenderer';
import { AiMarkdownView } from './cards/AiMarkdownView';

interface Props {
  messages: AiChatMessage[];
  isThinking: boolean;
  currentSessionId?: string | null;
  onViewOnMap?: () => void;
}

export const AiMessageList = React.memo(function AiMessageList({
  messages,
  isThinking,
  currentSessionId,
  onViewOnMap,
}: Props) {
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isThinking]);

  const renderItem = ({ item }: { item: AiChatMessage }) => {
    const isUser = item.role === 'user';
    const isError = item.status === 'error';
    const isSending = item.status === 'sending';

    if (isUser) {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
            {item.image ? (
              <AiVisionCard base64Image={item.image} />
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.assistantRow}>
        <View style={styles.assistantAvatar}>
          <Image
            source={require('../../../assets/ai/anitech-ai-mascot.png')}
            style={{ width: 22, height: 22 }}
            resizeMode="contain"
          />
        </View>
        <View style={[styles.assistantBubble, isError && styles.errorBubble]}>
          <View style={styles.assistantHeader}>
            <View style={styles.assistantTitleRow}>
              <Text style={styles.assistantName}>ANITECH Copilot</Text>
              <View style={styles.assistantSparkleBadge}>
                <Text style={styles.assistantBadgeText}>AI</Text>
              </View>
            </View>
            <Text style={styles.msgTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {isSending && !item.content ? (
            <View style={styles.thinkingWrap}>
              <ActivityIndicator size="small" color="#2586EA" />
              <Text style={styles.thinkingText}>Copilot đang phân tích dữ liệu...</Text>
            </View>
          ) : (
            <>
              {item.structuredCard ? (
                <AiStructuredCardRenderer card={item.structuredCard} />
              ) : item.content ? (
                <AiMarkdownView content={item.content} isError={isError} />
              ) : null}

              {/* Action Proposal Card */}
              {item.proposal ? (
                item.proposal.intent.type === 'CREATE_MISSION' ? (
                  <AiMissionProposalCard
                    proposal={item.proposal}
                    currentSessionId={currentSessionId}
                    onViewOnMap={onViewOnMap}
                  />
                ) : (
                  <AiActionCard
                    proposal={item.proposal}
                    currentSessionId={currentSessionId}
                  />
                )
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    />
  );
});

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderBottomRightRadius: 2,
    backgroundColor: '#2586EA',
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    maxWidth: '96%',
  },
  assistantAvatar: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(37, 134, 234, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(37, 134, 234, 0.30)',
  },
  assistantBubble: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderBottomLeftRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(180, 190, 210, 0.40)',
  },
  errorBubble: {
    backgroundColor: 'rgba(254, 242, 242, 0.90)',
    borderColor: 'rgba(239, 68, 68, 0.40)',
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  assistantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  assistantName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2586EA',
    letterSpacing: 0.3,
  },
  assistantSparkleBadge: {
    backgroundColor: 'rgba(37, 134, 234, 0.12)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  assistantBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#2586EA',
    letterSpacing: 0.4,
  },
  msgTime: {
    fontSize: 9,
    color: '#94A3B8',
  },
  assistantText: {
    color: '#1E293B',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  thinkingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  thinkingText: {
    fontSize: 11.5,
    color: '#64748B',
    fontStyle: 'italic',
  },
});
