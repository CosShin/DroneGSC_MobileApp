import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  content: string;
  isError?: boolean;
}

/**
 * Parses inline bold syntax (**text**) and code (`text`) into nested Text elements.
 */
function renderInlineSpans(raw: string, keyPrefix: string, baseStyle: any) {
  // Regex to match **bold** or `code`
  const parts = raw.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const text = part.slice(2, -2);
      return (
        <Text key={`${keyPrefix}-bold-${idx}`} style={styles.boldText}>
          {text}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const text = part.slice(1, -1);
      return (
        <Text key={`${keyPrefix}-code-${idx}`} style={styles.codeSpan}>
          {text}
        </Text>
      );
    }
    return (
      <Text key={`${keyPrefix}-text-${idx}`} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

export const AiMarkdownView = React.memo(function AiMarkdownView({ content, isError = false }: Props) {
  if (!content) return null;

  // Clean out XML / thinking tags
  const sanitized = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  const lines = sanitized.split('\n');

  return (
    <View style={styles.container}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();

        // 1. Empty lines -> paragraph spacing
        if (!line) {
          return <View key={`empty-${idx}`} style={styles.emptyLine} />;
        }

        // 2. Horizontal divider (---, ***, ===)
        if (/^[-*_]{3,}$/.test(line) || /^={3,}$/.test(line)) {
          return <View key={`hr-${idx}`} style={styles.hr} />;
        }

        // 3. Headers (###, ##, #)
        if (line.startsWith('### ')) {
          return (
            <Text key={`h3-${idx}`} style={styles.h3}>
              {line.replace(/^###\s+/, '')}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={`h2-${idx}`} style={styles.h2}>
              {line.replace(/^##\s+/, '')}
            </Text>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Text key={`h1-${idx}`} style={styles.h1}>
              {line.replace(/^#\s+/, '')}
            </Text>
          );
        }

        // 4. Bullet list items (•, -, *)
        if (/^[•\-*]\s+/.test(line)) {
          const itemText = line.replace(/^[•\-*]\s+/, '');
          return (
            <View key={`bullet-${idx}`} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={[styles.bulletContent, isError && styles.errorText]}>
                {renderInlineSpans(itemText, `bullet-${idx}`, [styles.bulletContent, isError && styles.errorText])}
              </Text>
            </View>
          );
        }

        // 5. Standard paragraph line with inline bold/code support
        return (
          <Text key={`p-${idx}`} style={[styles.paragraph, isError && styles.errorText]}>
            {renderInlineSpans(line, `p-${idx}`, [styles.paragraph, isError && styles.errorText])}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyLine: {
    height: 4,
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: 6,
  },
  h1: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  h2: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 3,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  h3: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 2,
    marginTop: 2,
  },
  paragraph: {
    fontSize: 11.5,
    lineHeight: 16.5,
    color: '#1E293B',
    marginBottom: 2,
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  codeSpan: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 3,
    borderRadius: 3,
    fontSize: 10.5,
    color: '#2586EA',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    marginRight: 6,
  },
  bulletContent: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16.5,
    color: '#1E293B',
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
  },
});
