import React from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassSurface } from '../gcs/GlassSurface';
import { colors, glass, radius } from '../../theme/gcsTheme';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import {
  mavlinkInspectorService,
  type InspectorLiveMessage,
  type MavlinkInspectorSnapshot,
} from '../../services/mavlink/MavlinkInspectorService';
import type { InspectorPacket, MavlinkPacketCategory } from '../../services/mavlink/MavlinkInspectorDecoder';

type DirectionFilter = 'ALL' | 'RX' | 'TX';
type InspectorView = 'MESSAGES' | 'PACKETS';
type DetailView = 'FIELDS' | 'RAW';

const CATEGORY_FILTERS: Array<'ALL' | MavlinkPacketCategory> = [
  'ALL', 'HEARTBEAT', 'TELEMETRY', 'COMMAND', 'MISSION', 'PARAM', 'SENSOR', 'ERROR',
];

export function MavlinkInspector() {
  const layout = useGcsLayout();
  const [snapshot, setSnapshot] = React.useState<MavlinkInspectorSnapshot>(() => mavlinkInspectorService.getSnapshot());
  const [paused, setPaused] = React.useState(false);
  const pausedRef = React.useRef(false);
  const [direction, setDirection] = React.useState<DirectionFilter>('ALL');
  const [category, setCategory] = React.useState<'ALL' | MavlinkPacketCategory>('ALL');
  const [source, setSource] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<InspectorView>('MESSAGES');
  const [selectedMessageKey, setSelectedMessageKey] = React.useState<string | null>(null);
  const [selectedPacketSnapshot, setSelectedPacketSnapshot] = React.useState<InspectorPacket | null>(null);
  const [detailView, setDetailView] = React.useState<DetailView>('FIELDS');
  const split = layout.contentWidth >= 700;

  React.useEffect(() => mavlinkInspectorService.subscribe(next => {
    if (!pausedRef.current) setSnapshot(next);
  }), []);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current) setSnapshot(mavlinkInspectorService.getSnapshot());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (!next) setSnapshot(mavlinkInspectorService.getSnapshot());
  };

  const sources = React.useMemo(() => {
    const unique = new Map<string, { key: string; systemId: number; componentId: number }>();
    snapshot.messages.forEach(message => {
      const key = `${message.systemId}:${message.componentId}`;
      unique.set(key, { key, systemId: message.systemId, componentId: message.componentId });
    });
    return [...unique.values()].sort((a, b) => a.systemId - b.systemId || a.componentId - b.componentId);
  }, [snapshot.messages]);

  React.useEffect(() => {
    if (source !== 'ALL' && !sources.some(item => item.key === source)) setSource('ALL');
  }, [source, sources]);

  const matches = React.useCallback((packet: InspectorPacket) => {
    if (direction !== 'ALL' && packet.direction !== direction) return false;
    if (category !== 'ALL' && packet.category !== category) return false;
    if (source !== 'ALL' && `${packet.systemId}:${packet.componentId}` !== source) return false;
    const query = search.trim().toUpperCase();
    if (!query) return true;
    return (
      packet.messageName.toUpperCase().includes(query) ||
      String(packet.messageId).includes(query) ||
      (packet.summary ? packet.summary.toUpperCase().includes(query) : false)
    );
  }, [category, direction, search, source]);

  const messages = React.useMemo(
    () => snapshot.messages.filter(message => matches(message.latest)),
    [matches, snapshot.messages],
  );
  const packets = React.useMemo(
    // Keep wire order stable. Prepending every live packet made all visible
    // rows move on each inspector refresh and looked like the table was
    // jumping. New packets now append at the bottom instead.
    () => snapshot.packets.filter(matches),
    [matches, snapshot.packets],
  );

  // Auto-select first item when none selected in split view
  React.useEffect(() => {
    if (split && view === 'MESSAGES' && messages.length > 0) {
      if (!selectedMessageKey || !messages.some(m => m.key === selectedMessageKey)) {
        setSelectedMessageKey(messages[0].key);
      }
    } else if (split && view === 'PACKETS' && packets.length > 0 && !selectedPacketSnapshot) {
      setSelectedPacketSnapshot(packets[packets.length - 1]);
    }
  }, [split, view, messages, packets, selectedMessageKey, selectedPacketSnapshot]);

  const selectedMessage = selectedMessageKey
    ? snapshot.messages.find(message => message.key === selectedMessageKey) ?? null
    : (split && messages.length > 0 ? messages[0] : null);

  const selectedPacket = view === 'MESSAGES'
    ? selectedMessage?.latest ?? null
    : selectedPacketSnapshot ?? (split && packets.length > 0 ? packets[0] : null);

  const selectView = (next: InspectorView) => {
    setView(next);
    setSelectedMessageKey(null);
    setSelectedPacketSnapshot(null);
    setDetailView('FIELDS');
  };

  const clear = () => {
    mavlinkInspectorService.clear();
    setSnapshot(mavlinkInspectorService.getSnapshot());
    setSelectedMessageKey(null);
    setSelectedPacketSnapshot(null);
  };

  const selectPacket = React.useCallback((packet: InspectorPacket) => {
    setSelectedPacketSnapshot(packet);
    setDetailView('FIELDS');
  }, []);

  const highRate = snapshot.rates.find(rate =>
    (rate.messageName === 'ATTITUDE' && rate.rateHz > 40) || rate.rateHz > 100,
  );

  return (
    <View style={styles.root}>
      {/* 1. Header Bar: Title, Live State, Actions & Inline Metrics */}
      <View style={styles.topBar}>
        <View style={styles.titleGroup}>
          <MaterialCommunityIcons name="database-search-outline" size={16} color={colors.primary} />
          <Text style={styles.title}>MAVLINK INSPECTOR</Text>
          <View style={[styles.captureState, paused && styles.captureStatePaused]}>
            <View style={[styles.captureDot, paused && styles.captureDotPaused]} />
            <Text style={[styles.captureText, paused && styles.captureTextPaused]}>{paused ? 'FROZEN' : 'LIVE'}</Text>
          </View>
          <SmallAction icon={paused ? 'play' : 'pause'} label={paused ? 'RESUME' : 'PAUSE'} active={paused} onPress={togglePause} />
          <SmallAction icon="delete-sweep-outline" label="CLEAR" onPress={clear} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
          <MetricBadge label="RX" value={`${snapshot.traffic.rxPacketsPerSec} pps (${formatRate(snapshot.traffic.rxBytesPerSec)})`} tone="rx" />
          <MetricBadge label="TX" value={`${snapshot.traffic.txPacketsPerSec} pps (${formatRate(snapshot.traffic.txBytesPerSec)})`} tone="tx" />
          <MetricBadge label="LINK" value={snapshot.transport ? `${snapshot.transport.kind} ${snapshot.transport.status}` : '--'} />
          <MetricBadge label="AP" value={snapshot.traffic.systemId == null ? '--' : `SYS ${snapshot.traffic.systemId}:${snapshot.traffic.componentId ?? '--'}`} />
          <MetricBadge label="HB" value={snapshot.heartbeatAgeMs == null ? '--' : `${snapshot.heartbeatAgeMs}ms`} />
          <MetricBadge label="LOSS" value={String(snapshot.traffic.packetsLost)} tone={snapshot.traffic.packetsLost ? 'danger' : 'neutral'} />
          <MetricBadge label="CRC" value={String(snapshot.traffic.parser.crcErrors)} tone={snapshot.traffic.parser.crcErrors ? 'danger' : 'neutral'} />
          <MetricBadge label="SIG" value={`${snapshot.traffic.parser.signaturesValid}/${snapshot.traffic.parser.signaturesInvalid}`} tone={snapshot.traffic.parser.signaturesInvalid ? 'danger' : 'neutral'} />
          <MetricBadge label="RECON" value={String(snapshot.reconnectCount)} tone={snapshot.reconnectCount ? 'warning' : 'neutral'} />
          <MetricBadge label="VER" value={snapshot.traffic.mavlinkVersion ? `v${snapshot.traffic.mavlinkVersion}` : '--'} />
        </ScrollView>
      </View>

      {/* 2. Compact Filter Toolbar */}
      <View style={styles.filterBar}>
        {/* View Tabs */}
        <View style={styles.viewTabs}>
          {(['MESSAGES', 'PACKETS'] as InspectorView[]).map(item => (
            <FilterChip key={item} label={item} active={view === item} onPress={() => selectView(item)} />
          ))}
        </View>

        {/* Direction Filter */}
        <View style={styles.dirTabs}>
          {(['ALL', 'RX', 'TX'] as DirectionFilter[]).map(item => (
            <FilterChip key={item} label={item} active={direction === item} onPress={() => setDirection(item)} compact />
          ))}
        </View>

        {/* Sources & Category horizontal scroller */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <ScopeChip label="ALL SOURCES" active={source === 'ALL'} onPress={() => setSource('ALL')} icon="lan" />
          {sources.map(item => (
            <ScopeChip
              key={item.key}
              label={`SYS ${item.systemId}:${item.componentId}`}
              active={source === item.key}
              onPress={() => setSource(item.key)}
              icon={item.componentId === 1 ? 'airplane-cog' : 'puzzle-outline'}
            />
          ))}
          <View style={styles.chipDivider} />
          {CATEGORY_FILTERS.map(item => (
            <FilterChip key={item} label={item} active={category === item} onPress={() => setCategory(item)} compact />
          ))}
        </ScrollView>

        {/* Search */}
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={13} color={glass.textDim} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Filter msg..."
            placeholderTextColor={glass.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
              <MaterialCommunityIcons name="close-circle" size={12} color={glass.textDim} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {highRate ? (
        <View style={styles.warning}>
          <MaterialCommunityIcons name="speedometer" size={12} color={colors.warning} />
          <Text style={styles.warningText}>High-rate stream: {highRate.messageName} ({highRate.rateHz.toFixed(1)} Hz)</Text>
        </View>
      ) : null}

      {/* 3. Main Split View: Left List, Right Fields */}
      <View style={styles.workspace}>
        {/* Left List Card */}
        <GlassSurface fill variant="strong" style={styles.listPanel} contentStyle={styles.listContent}>
          <View style={styles.tableTitleRow}>
            <Text style={styles.tableTitle}>{view === 'MESSAGES' ? 'MESSAGE STREAMS (QGC LIVE)' : 'RAW PACKETS'}</Text>
            <Text style={styles.tableCount}>{view === 'MESSAGES' ? messages.length : packets.length} {view === 'MESSAGES' ? 'TYPES' : 'PACKETS'}</Text>
          </View>
          {view === 'MESSAGES' ? (
            <View style={styles.tableContainer}>
              <MessageTableHeader />
              <FlatList
                data={messages}
                keyExtractor={item => item.key}
                style={styles.flatList}
                renderItem={({ item }) => (
                  <MessageRow
                    message={item}
                    selected={selectedMessageKey === item.key}
                    onPress={() => {
                      setSelectedMessageKey(item.key);
                      setDetailView('FIELDS');
                    }}
                  />
                )}
                initialNumToRender={20}
                maxToRenderPerBatch={24}
                windowSize={5}
                removeClippedSubviews
                contentContainerStyle={messages.length ? undefined : styles.emptyList}
                ListEmptyComponent={<EmptyCopy paused={paused} view={view} />}
              />
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <PacketTableHeader />
              <FlatList
                data={packets}
                keyExtractor={item => item.id}
                style={styles.flatList}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                renderItem={({ item }) => (
                  <PacketRow
                    packet={item}
                    selected={selectedPacketSnapshot?.id === item.id}
                    onSelect={selectPacket}
                  />
                )}
                initialNumToRender={20}
                maxToRenderPerBatch={24}
                windowSize={5}
                removeClippedSubviews
                contentContainerStyle={packets.length ? undefined : styles.emptyList}
                ListEmptyComponent={<EmptyCopy paused={paused} view={view} />}
              />
            </View>
          )}
        </GlassSurface>

        {/* Right Details Card */}
        {split ? (
          selectedPacket ? (
            <PacketDetail
              packet={selectedPacket}
              message={selectedMessage}
              view={detailView}
              paused={paused}
              onView={setDetailView}
              onClose={() => {
                setSelectedMessageKey(null);
                setSelectedPacketSnapshot(null);
              }}
            />
          ) : (
            <InspectorPlaceholder />
          )
        ) : null}
      </View>

      {/* Non-split Overlay Drawer */}
      {selectedPacket && !split ? (
        <View style={styles.detailOverlay}>
          <PacketDetail
            packet={selectedPacket}
            message={selectedMessage}
            view={detailView}
            paused={paused}
            onView={setDetailView}
            onClose={() => {
              setSelectedMessageKey(null);
              setSelectedPacketSnapshot(null);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function MessageTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.columnLabel, styles.nameColumn]}>MESSAGE</Text>
      <Text style={[styles.columnLabel, styles.idColumn]}>ID</Text>
      <Text style={[styles.columnLabel, styles.sourceColumn]}>SRC</Text>
      <Text style={[styles.columnLabel, styles.rateColumn]}>RATE</Text>
      <Text style={[styles.columnLabel, styles.countColumn]}>COUNT</Text>
      <Text style={[styles.columnLabel, styles.lastColumn]}>LAST</Text>
    </View>
  );
}

function MessageRow({ message, selected, onPress }: { message: InspectorLiveMessage; selected: boolean; onPress: () => void }) {
  const directionColor = message.direction === 'RX' ? '#2F80ED' : '#7C3AED';
  const summary = message.latest.summary;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.messageRow, selected && styles.rowSelected]}>
      <View style={styles.nameColumn}>
        <View style={styles.messageNameLine}>
          <View style={[styles.directionDot, { backgroundColor: directionColor }]} />
          <Text numberOfLines={1} style={styles.messageName}>{message.messageName}</Text>
          <Text style={[styles.inlineDirection, { color: directionColor }]}>{message.direction}</Text>
        </View>
        <View style={styles.messageMetaLine}>
          <Text style={styles.messageCategory}>{message.category}</Text>
          {summary ? (
            <Text numberOfLines={1} style={styles.messageSummaryText}>· {summary}</Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.cellText, styles.idColumn]}>#{message.messageId}</Text>
      <Text style={[styles.cellText, styles.sourceColumn]}>{message.systemId}:{message.componentId}</Text>
      <Text style={[styles.rateText, styles.rateColumn]}>{formatHz(message.rateHz)}</Text>
      <Text style={[styles.cellText, styles.countColumn]}>{formatCount(message.count)}</Text>
      <Text style={[styles.cellDim, styles.lastColumn]}>{formatAge(message.latest.timestamp)}</Text>
    </TouchableOpacity>
  );
}

function PacketTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.columnLabel, styles.packetDirCol]}>DIR</Text>
      <Text style={[styles.columnLabel, styles.packetTimeCol]}>TIME</Text>
      <Text style={[styles.columnLabel, styles.packetNameCol]}>MESSAGE</Text>
      <Text style={[styles.columnLabel, styles.packetMetaCol]}>ID</Text>
      <Text style={[styles.columnLabel, styles.packetMetaCol]}>SRC</Text>
      <Text style={[styles.columnLabel, styles.packetSizeCol]}>SIZE</Text>
    </View>
  );
}

const PacketRow = React.memo(function PacketRow({
  packet,
  selected,
  onSelect,
}: {
  packet: InspectorPacket;
  selected: boolean;
  onSelect: (packet: InspectorPacket) => void;
}) {
  const directionColor = packet.direction === 'RX' ? '#2F80ED' : '#7C3AED';
  const semantic = packet.messageName === 'COMMAND_ACK'
    ? packet.summary?.includes('ACCEPTED') ? colors.success : colors.danger
    : packet.category === 'COMMAND' ? colors.warning : glass.text;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onSelect(packet)} style={[styles.packetRow, selected && styles.rowSelected]}>
      <View style={styles.packetDirCol}>
        <View style={[styles.directionBadge, { backgroundColor: `${directionColor}18`, borderColor: `${directionColor}55` }]}>
          <Text style={[styles.directionText, { color: directionColor }]}>{packet.direction}</Text>
        </View>
      </View>
      <Text style={[styles.packetTime, styles.packetTimeCol]}>{formatTime(packet.timestamp)}</Text>
      <View style={styles.packetNameCol}>
        <Text numberOfLines={1} style={[styles.packetName, { color: semantic }]}>{packet.messageName}</Text>
        {packet.summary ? <Text numberOfLines={1} style={styles.packetSummary}>{packet.summary}</Text> : null}
      </View>
      <Text style={[styles.packetMeta, styles.packetMetaCol]}>#{packet.messageId}</Text>
      <Text style={[styles.packetMeta, styles.packetMetaCol]}>{packet.systemId}:{packet.componentId}</Text>
      <Text style={[styles.packetSize, styles.packetSizeCol]}>{packet.payloadSize} B</Text>
    </TouchableOpacity>
  );
});

function PacketDetail({ packet, message, view, paused, onView, onClose }: {
  packet: InspectorPacket;
  message: InspectorLiveMessage | null;
  view: DetailView;
  paused: boolean;
  onView: (view: DetailView) => void;
  onClose: () => void;
}) {
  return (
    <GlassSurface fill variant="strong" style={styles.detailPanel} contentStyle={styles.detailContent}>
      {/* Panel Header */}
      <View style={styles.detailHeader}>
        <View style={styles.detailTitleWrap}>
          <View style={styles.detailNameLine}>
            <Text numberOfLines={1} style={styles.detailTitle}>{packet.messageName}</Text>
            {message ? (
              <View style={[styles.liveBadge, paused && styles.liveBadgePaused]}>
                <View style={[styles.liveBadgeDot, paused && styles.captureDotPaused]} />
                <Text style={[styles.liveBadgeText, paused && styles.captureTextPaused]}>{paused ? 'FROZEN' : 'LIVE'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.detailSub}>MSG #{packet.messageId} · {packet.direction} · MAVLink {packet.version}</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Close packet details" onPress={onClose} style={styles.close}>
          <MaterialCommunityIcons name="close" size={16} color={glass.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Metrics Row */}
      <View style={styles.detailStats}>
        <DetailStat label="SRC" value={`${packet.systemId}:${packet.componentId}`} />
        <DetailStat label="RATE" value={message ? formatHz(message.rateHz) : '--'} />
        <DetailStat label="COUNT" value={message ? formatCount(message.count) : '--'} />
        <DetailStat label="SEQ" value={`#${packet.sequence}`} />
        <DetailStat label="SIZE" value={`${packet.payloadSize} B`} />
        <DetailStat label="LAST" value={formatAge(packet.timestamp)} />
      </View>

      {/* Tab Switcher: FIELDS vs RAW */}
      <View style={styles.detailTabs}>
        {(['FIELDS', 'RAW'] as DetailView[]).map(item => (
          <FilterChip key={item} label={item} active={view === item} onPress={() => onView(item)} compact />
        ))}
      </View>

      {/* Tab Content */}
      {view === 'FIELDS' ? (
        <View style={styles.detailScrollWrap}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldHeaderText}>FIELD NAME</Text>
            <Text style={[styles.fieldHeaderText, styles.fieldHeaderValue]}>VALUE</Text>
          </View>
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
            <DetailLine label="crc" value={packet.crc} tone="success" />
            {packet.fields.map((item, index) => (
              <DetailLine key={`${item.label}-${index}`} label={item.label} value={item.value} />
            ))}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
          {packet.rawHex ? (
            <View style={styles.rawContainer}>
              <Text selectable style={styles.raw}>{packet.rawHex}</Text>
            </View>
          ) : (
            <Text style={styles.rawUnavailable}>Raw bytes are unavailable for this packet.</Text>
          )}
        </ScrollView>
      )}
    </GlassSurface>
  );
}

function InspectorPlaceholder() {
  return (
    <GlassSurface fill variant="medium" style={styles.detailPanel} contentStyle={styles.placeholder}>
      <View style={styles.placeholderIcon}>
        <MaterialCommunityIcons name="cursor-default-click-outline" size={24} color={colors.primary} />
      </View>
      <Text style={styles.placeholderTitle}>Select a MAVLink message</Text>
      <Text style={styles.placeholderText}>Its live decoded fields, source IDs and update frequency will appear here.</Text>
    </GlassSurface>
  );
}

function DetailLine({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' }) {
  const isErr = label.includes('error') || value.includes('DENIED') || value.includes('FAILED');
  const isOk = tone === 'success' || value.includes('ACCEPTED') || value === 'VALID';
  const colorTone = isErr ? colors.danger : isOk ? colors.success : glass.text;

  return (
    <View style={styles.detailLine}>
      <Text selectable style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, { color: colorTone }]}>{value}</Text>
    </View>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailStat}>
      <Text style={styles.detailStatLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailStatValue}>{value}</Text>
    </View>
  );
}

function MetricBadge({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'rx' | 'tx' | 'danger' | 'warning' }) {
  const color = tone === 'rx' ? '#2F80ED' : tone === 'tx' ? '#7C3AED' : tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : glass.text;
  return (
    <View style={styles.metricBadge}>
      <Text style={styles.metricBadgeLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.metricBadgeValue, { color }]}>{value}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, compact = false }: { label: string; active: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, compact && styles.filterChipCompact, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScopeChip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.scopeChip, active && styles.scopeChipActive]}>
      <MaterialCommunityIcons name={icon} size={11} color={active ? colors.primary : glass.textMuted} />
      <Text style={[styles.scopeText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallAction({ icon, label, active, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.smallAction, active && styles.smallActionActive]}>
      <MaterialCommunityIcons name={icon} size={13} color={active ? colors.primary : glass.textMuted} />
      <Text style={[styles.smallActionText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyCopy({ paused, view }: { paused: boolean; view: InspectorView }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="access-point-network-off" size={24} color={glass.textDim} />
      <Text style={styles.emptyTitle}>{paused ? 'Inspector is frozen' : `No matching ${view.toLowerCase()}`}</Text>
      <Text style={styles.emptySub}>Try another filter or search query.</Text>
    </View>
  );
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function formatAge(timestamp: number) {
  const age = Math.max(0, Date.now() - timestamp);
  if (age < 1000) return `${age}ms`;
  if (age < 60_000) return `${(age / 1000).toFixed(1)}s`;
  return `${Math.floor(age / 60_000)}m`;
}

function formatRate(bytes: number) {
  if (bytes < 1024) return `${bytes} B/s`;
  return `${(bytes / 1024).toFixed(1)} KB/s`;
}

function formatHz(rate: number) {
  if (rate <= 0) return '0 Hz';
  if (rate < 1) return `${rate.toFixed(1)} Hz`;
  return `${rate.toFixed(rate >= 10 ? 0 : 1)} Hz`;
}

function formatCount(count: number) {
  if (count < 10_000) return count.toLocaleString();
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(1)}m`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 4,
  },
  topBar: {
    flexShrink: 0,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: glass.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  captureState: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16,185,129,.12)',
  },
  captureStatePaused: {
    backgroundColor: 'rgba(245,158,11,.15)',
  },
  captureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  captureDotPaused: {
    backgroundColor: colors.warning,
  },
  captureText: {
    color: colors.success,
    fontSize: 6.8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  captureTextPaused: {
    color: '#9A6700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  metricBadge: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.65)',
  },
  metricBadgeLabel: {
    color: glass.textDim,
    fontSize: 6.5,
    fontWeight: '900',
  },
  metricBadgeValue: {
    fontSize: 7.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  smallAction: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.65)',
    backgroundColor: 'rgba(255,255,255,.45)',
  },
  smallActionActive: {
    borderColor: 'rgba(47,128,237,.4)',
    backgroundColor: 'rgba(255,255,255,.7)',
  },
  smallActionText: {
    color: glass.textMuted,
    fontSize: 7.2,
    fontWeight: '900',
  },
  filterBar: {
    flexShrink: 0,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewTabs: {
    flexDirection: 'row',
    gap: 2,
  },
  dirTabs: {
    flexDirection: 'row',
    gap: 2,
  },
  chipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  chipDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(90,110,138,.18)',
    marginHorizontal: 2,
  },
  searchWrap: {
    width: 130,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.65)',
  },
  searchInput: {
    flex: 1,
    height: 22,
    paddingHorizontal: 4,
    paddingVertical: 0,
    color: glass.text,
    fontSize: 7.8,
  },
  clearSearch: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    height: 24,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.45)',
    backgroundColor: 'rgba(255,255,255,.25)',
  },
  filterChipCompact: {
    height: 22,
    paddingHorizontal: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(255,255,255,.75)',
    borderColor: 'rgba(47,128,237,.5)',
  },
  filterText: {
    color: glass.textMuted,
    fontSize: 7,
    fontWeight: '900',
  },
  filterTextActive: {
    color: colors.primary,
  },
  scopeChip: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(98,116,144,.15)',
    backgroundColor: 'rgba(255,255,255,.25)',
  },
  scopeChipActive: {
    backgroundColor: 'rgba(255,255,255,.75)',
    borderColor: 'rgba(47,128,237,.45)',
  },
  scopeText: {
    color: glass.textMuted,
    fontSize: 6.8,
    fontWeight: '900',
  },
  warning: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,.3)',
  },
  warningText: {
    color: '#9A6700',
    fontSize: 7.5,
    fontWeight: '800',
  },
  workspace: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: 6,
  },
  listPanel: {
    flex: 1.1,
    minWidth: 260,
    borderRadius: radius.md,
  },
  listContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  tableTitleRow: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tableTitle: {
    color: glass.text,
    fontSize: 7.8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  tableCount: {
    color: glass.textDim,
    fontSize: 6.8,
    fontWeight: '900',
  },
  tableContainer: {
    flex: 1,
    minHeight: 0,
  },
  tableHeader: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(82,104,134,.12)',
    backgroundColor: 'rgba(90,110,140,.04)',
  },
  columnLabel: {
    color: glass.textDim,
    fontSize: 6.4,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  flatList: {
    flex: 1,
    minHeight: 0,
  },
  messageRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80,100,130,.08)',
  },
  rowSelected: {
    backgroundColor: 'rgba(47,128,237,.14)',
    borderRadius: radius.sm,
    borderBottomColor: 'rgba(47,128,237,.18)',
  },
  nameColumn: {
    flex: 1,
    minWidth: 110,
  },
  idColumn: {
    width: 40,
  },
  sourceColumn: {
    width: 44,
  },
  rateColumn: {
    width: 46,
    textAlign: 'right',
  },
  countColumn: {
    width: 46,
    textAlign: 'right',
  },
  lastColumn: {
    width: 46,
    textAlign: 'right',
  },
  messageNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  directionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  messageName: {
    flexShrink: 1,
    color: glass.text,
    fontSize: 8,
    fontWeight: '900',
  },
  inlineDirection: {
    fontSize: 6,
    fontWeight: '900',
  },
  messageMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 9,
  },
  messageCategory: {
    color: glass.textDim,
    fontSize: 6,
    fontWeight: '700',
  },
  messageSummaryText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 6.2,
    fontWeight: '800',
  },
  cellText: {
    color: glass.textMuted,
    fontSize: 7,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cellDim: {
    color: glass.textDim,
    fontSize: 6.8,
    fontVariant: ['tabular-nums'],
  },
  rateText: {
    color: colors.primary,
    fontSize: 7.2,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  packetRow: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80,100,130,.08)',
  },
  packetDirCol: {
    width: 32,
  },
  packetTimeCol: {
    width: 68,
  },
  packetNameCol: {
    flex: 1,
    minWidth: 80,
  },
  packetMetaCol: {
    width: 36,
  },
  packetSizeCol: {
    width: 34,
    textAlign: 'right',
  },
  directionBadge: {
    width: 24,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
  },
  directionText: {
    fontSize: 6.5,
    fontWeight: '900',
  },
  packetTime: {
    color: glass.textDim,
    fontSize: 6.8,
    fontVariant: ['tabular-nums'],
  },
  packetName: {
    fontSize: 7.8,
    fontWeight: '900',
  },
  packetSummary: {
    color: glass.textMuted,
    fontSize: 6.4,
  },
  packetMeta: {
    color: glass.textMuted,
    fontSize: 6.8,
    fontWeight: '700',
  },
  packetSize: {
    color: glass.textDim,
    fontSize: 6.8,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: glass.text,
    fontSize: 9.5,
    fontWeight: '900',
    marginTop: 4,
  },
  emptySub: {
    color: glass.textMuted,
    fontSize: 7.5,
    marginTop: 2,
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(25,40,60,.3)',
  },
  detailPanel: {
    flex: 0.9,
    minWidth: 260,
    maxWidth: 420,
    borderRadius: radius.md,
  },
  detailContent: {
    flex: 1,
    minHeight: 0,
    padding: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80,100,130,.10)',
  },
  detailTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailTitle: {
    flexShrink: 1,
    color: glass.text,
    fontSize: 10.5,
    fontWeight: '900',
  },
  detailSub: {
    color: glass.textMuted,
    fontSize: 6.8,
    marginTop: 1,
  },
  liveBadge: {
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16,185,129,.12)',
  },
  liveBadgePaused: {
    backgroundColor: 'rgba(245,158,11,.15)',
  },
  liveBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  liveBadgeText: {
    color: colors.success,
    fontSize: 6,
    fontWeight: '900',
  },
  close: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.45)',
  },
  detailStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80,100,130,.08)',
  },
  detailStat: {
    width: '33.333%',
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  detailStatLabel: {
    color: glass.textDim,
    fontSize: 5.8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  detailStatValue: {
    color: glass.text,
    fontSize: 7.2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  detailTabs: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 4,
  },
  detailScrollWrap: {
    flex: 1,
    minHeight: 0,
  },
  fieldHeader: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(80,100,130,.10)',
    backgroundColor: 'rgba(90,110,140,.04)',
  },
  fieldHeaderText: {
    flex: 1,
    color: glass.textDim,
    fontSize: 6.2,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  fieldHeaderValue: {
    textAlign: 'right',
  },
  detailScroll: {
    flex: 1,
    minHeight: 0,
  },
  detailScrollContent: {
    paddingBottom: 8,
  },
  detailLine: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80,100,130,.07)',
  },
  detailLabel: {
    flex: 1,
    color: glass.textMuted,
    fontSize: 7.2,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  detailValue: {
    flex: 1,
    color: glass.text,
    fontSize: 7.5,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rawContainer: {
    backgroundColor: 'rgba(0,0,0,.04)',
    borderRadius: radius.sm,
    padding: 6,
    marginVertical: 3,
  },
  raw: {
    color: '#304156',
    fontSize: 7.5,
    lineHeight: 13,
    fontFamily: 'monospace',
  },
  rawUnavailable: {
    color: glass.textMuted,
    fontSize: 7.8,
    lineHeight: 12,
    padding: 6,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,128,237,.08)',
    borderWidth: 1,
    borderColor: 'rgba(47,128,237,.16)',
  },
  placeholderTitle: {
    color: glass.text,
    fontSize: 9.5,
    fontWeight: '900',
    marginTop: 8,
  },
  placeholderText: {
    maxWidth: 220,
    color: glass.textMuted,
    fontSize: 7.5,
    lineHeight: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
