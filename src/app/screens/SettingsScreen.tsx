import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Panel, SectionTitle, StatusChip } from '../../components/gcs/Primitives';
import { FloatingWorkspace } from '../../components/gcs/FloatingWorkspace';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  selectConnectionConfig, 
  selectConnectionProfiles,
  selectMavlinkSettings,
  selectJoystickSettings, 
  selectShowJoysticks, 
  selectTelemetrySettings, 
  setConnectionType, 
  loadConnectionProfile,
  removeConnectionProfile,
  updateConnectionConfig,
  setShowJoysticks, 
  updateSerialSettings,
  updateTcpSettings,
  updateJoystickSettings, 
  updateMavlinkSettings,
  updateTelemetrySettings, 
  updateUdpSettings, 
  updateWebSocketSettings,
  upsertConnectionProfile,
} from '../../store/settings/settingsSlice';
import { 
  selectConnectionStatus, 
  selectMavlinkState, 
  selectNetworkState,
  selectPacketsPerSec, 
  selectVehicleState,
  setActiveConnectionInfo 
} from '../../store/connection/connectionSlice';
import { universalConnectionService } from '../../services/connection/UniversalConnectionService';
import { colors, glass, radius, spacing } from '../../theme/gcsTheme';
import { useScreenOrientation } from '../../hooks/useScreenOrientation';
import { useGcsLayout } from '../../hooks/useGcsLayout';
import { WebRtcVideoSettings } from '../../components/settings/WebRtcVideoSettings';
import { GlassSurface } from '../../components/gcs/GlassSurface';
import { platformCapabilities } from '../../platform/PlatformCapabilities';
import { applyNetworkProfile, createSavedConnectionProfile, NETWORK_PROFILE_LABELS } from '../../services/connection/ConnectionProfiles';
import type { ConnectionType, NetworkProfileType } from '../../settings/types/connection';
import { SUPPORTED_SERIAL_BAUD_RATES } from '../../services/connection/ConnectionValidation';
import { deleteMavlinkSigningKey, storeMavlinkSigningKey } from '../../services/mavlink/MavlinkSigningKeyStore';
import type { MavlinkSigningPolicy } from '../../services/mavlink/MavlinkSigning';
import { UsbSerialTransport, type UsbDeviceInfo } from '../../services/mavlink/UsbSerialTransport';
import { selectVideoRuntime } from '../../store/videoSlice';
import { AiSettingsSection } from '../../components/settings/AiSettingsSection';

type Category = 'CONNECTION' | 'AI ASSISTANT' | 'VIDEO' | 'CONTROL' | 'TELEMETRY' | 'MAP & MISSION' | 'SAFETY' | 'APPEARANCE' | 'ABOUT';

const categories: Array<{ id: Category; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { id: 'CONNECTION', subtitle: 'Pi Gateway, Wi-Fi and VPN', icon: 'access-point-network' },
  { id: 'AI ASSISTANT', subtitle: 'Local Ollama & Copilot', icon: 'creation' },
  { id: 'VIDEO', subtitle: 'Live stream and camera', icon: 'video-outline' },
  { id: 'CONTROL', subtitle: 'Joystick behavior', icon: 'gamepad-variant-outline' },
  { id: 'TELEMETRY', subtitle: 'MAVLink update rates', icon: 'chart-line' },
  { id: 'MAP & MISSION', subtitle: 'Map provider and mission', icon: 'map-outline' },
  { id: 'SAFETY', subtitle: 'Command protection', icon: 'shield-check-outline' },
  { id: 'APPEARANCE', subtitle: 'Display and orientation', icon: 'palette-outline' },
  { id: 'ABOUT', subtitle: 'Version and diagnostics', icon: 'information-outline' },
];

export function SettingsScreen() {
  useScreenOrientation();
  const navigation = useNavigation<any>();
  const [active, setActive] = React.useState<Category>('CONNECTION');
  const layout = useGcsLayout();
  const showContext = layout.isTabletLandscape && layout.contentWidth >= 1320;

  return (
    <FloatingWorkspace
      title="Settings"
      subtitle="Flight Control & Vehicle Configuration"
      icon="cog-outline"
      onClose={() => navigation.navigate('Fly')}
    >
      <View style={styles.workspaceInner}>
        {/* Horizontal Category Navigation */}
        <GlassSurface variant="medium" style={styles.categoryShell} contentStyle={styles.categoryShellContent}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.categoryBar} 
            contentContainerStyle={[
              styles.categoryContent, 
              { paddingHorizontal: layout.contentPadding, gap: layout.isCompactLandscape ? 5 : 7 }
            ]}
          >
            {categories.map((item) => {
            const isActive = active === item.id;
            return (
              <TouchableOpacity 
                key={item.id} 
                style={[
                  styles.category, 
                  layout.isCompactLandscape && styles.categoryCompact, 
                  isActive && styles.categoryActive
                ]} 
                onPress={() => setActive(item.id)}
              >
                <View 
                  style={[
                    styles.categoryIcon, 
                    layout.isCompactLandscape && styles.categoryIconCompact, 
                    isActive && styles.categoryIconActive
                  ]}
                >
                  <MaterialCommunityIcons 
                    name={item.icon} 
                    size={layout.isCompactLandscape ? 16 : 18} 
                    color={isActive ? '#2F80ED' : colors.textMuted} 
                  />
                </View>
                <View style={styles.categoryCopy}>
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit 
                    style={[styles.categoryTitle, isActive && styles.categoryTitleActive]}
                  >
                    {item.id}
                  </Text>
                  {!layout.isCompactLandscape ? (
                    <Text numberOfLines={1} style={styles.categorySub}>{item.subtitle}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
            })}
          </ScrollView>
        </GlassSurface>

        {/* Content Body */}
        <View style={[styles.body, { padding: layout.contentPadding, gap: layout.cardGap }]}>
          <ScrollView 
            style={styles.detail} 
            contentContainerStyle={[
              styles.detailContent, 
              { padding: layout.isCompactLandscape ? 10 : layout.isTabletLandscape ? 20 : 14, gap: layout.cardGap }
            ]} 
            keyboardShouldPersistTaps="handled"
          >
            <CategoryContent category={active} />
          </ScrollView>
          {showContext ? <SettingsContextPanel category={active} /> : null}
        </View>
      </View>
    </FloatingWorkspace>
  );
}

function CategoryContent({ category }: { category: Category }) {
  if (category === 'CONNECTION') return <Connection />;
  if (category === 'AI ASSISTANT') return <AiSettingsSection />;
  if (category === 'VIDEO') return <Video />;
  if (category === 'CONTROL') return <Control />;
  if (category === 'TELEMETRY') return <Telemetry />;
  if (category === 'MAP & MISSION') return <MapMission />;
  if (category === 'SAFETY') return <Safety />;
  if (category === 'APPEARANCE') return <Appearance />;
  return <About />;
}

function SettingsContextPanel({ category }: { category: Category }) {
  const status = useAppSelector(selectConnectionStatus);
  const mavlink = useAppSelector(selectMavlinkState);

  if (category !== 'CONNECTION') {
    return (
      <View style={styles.contextPanel}>
        <View style={styles.contextVisual}>
          <MaterialCommunityIcons 
            name={categories.find(item => item.id === category)?.icon ?? 'cog-outline'} 
            size={68} 
            color="#2F80ED" 
          />
        </View>
        <Text style={styles.contextTitle}>{category}</Text>
        <Text style={styles.contextCopy}>Changes are stored locally and applied to the live GCS interface.</Text>
      </View>
    );
  }

  const connecting = status === 'CONNECTING';
  const connected = status === 'CONNECTED';

  return (
    <View style={styles.contextPanel}>
      <View style={styles.connectionVisual}>
        <View style={styles.signalRingLarge} />
        <View style={styles.signalRingSmall} />
        <MaterialCommunityIcons 
          name="quadcopter" 
          size={72} 
          color={connected ? colors.success : '#2F80ED'} 
        />
        <View style={[styles.visualBadge, { backgroundColor: connected ? colors.success : connecting ? colors.warning : colors.textDim }]}>
          <MaterialCommunityIcons name={connected ? 'check' : 'access-point'} size={17} color="#FFF" />
        </View>
      </View>
      <View style={styles.contextTip}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#2F80ED" />
        <View style={{ flex: 1 }}>
          <Text style={styles.contextTitle}>
            {connected ? 'Vehicle connected' : connecting ? 'Searching for vehicle' : 'Ready to connect'}
          </Text>
          <Text style={styles.contextCopy}>
            {connected ? 'The MAVLink heartbeat is active.' : connecting ? 'Keep the vehicle powered and on the same network.' : 'Choose a profile, verify the URL, then test the connection.'}
          </Text>
        </View>
      </View>
      <CheckLine done={status !== 'DISCONNECTED'} loading={connecting && mavlink !== 'WAITING_HEARTBEAT'} label="Check gateway IP and port" />
      <CheckLine done={connected} loading={connecting && mavlink === 'WAITING_HEARTBEAT'} label="Wait for MAVLink heartbeat" />
      <CheckLine done={connected} label="Confirm live vehicle telemetry" />
    </View>
  );
}

function CheckLine({ done, loading = false, label }: { done: boolean; loading?: boolean; label: string }) {
  return (
    <View style={styles.checkLine}>
      <View style={[styles.checkIcon, done && styles.checkDone, loading && styles.checkLoading]}>
        <MaterialCommunityIcons name={done ? 'check' : loading ? 'dots-horizontal' : 'circle-outline'} size={13} color={done ? '#FFF' : loading ? colors.primary : colors.textDim} />
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function Connection() {
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectConnectionConfig);
  const savedProfiles = useAppSelector(selectConnectionProfiles);
  const mavlinkConfig = useAppSelector(selectMavlinkSettings);
  const [signingKeyInput, setSigningKeyInput] = React.useState('');
  const [profileName, setProfileName] = React.useState('');
  const [usbDevices, setUsbDevices] = React.useState<UsbDeviceInfo[]>([]);
  const [usbScanning, setUsbScanning] = React.useState(false);
  const status = useAppSelector(selectConnectionStatus);
  const mavlink = useAppSelector(selectMavlinkState);
  const network = useAppSelector(selectNetworkState);
  const vehicle = useAppSelector(selectVehicleState);
  const videoRuntime = useAppSelector(selectVideoRuntime);
  const error = useAppSelector(state => state.connection.error);
  const isUdp = config.type === 'UDP';
  const isTcp = config.type === 'TCP';
  const isWebSocket = config.type === 'WEBSOCKET';
  const isUsb = config.type === 'USB_SERIAL';

  const transports: Array<{ type: ConnectionType; label: string; available: boolean; reason: string | null }> = [
    { type: 'WEBSOCKET', label: 'PI GATEWAY', available: true, reason: null },
    { type: 'UDP', label: 'UDP', available: platformCapabilities.udp.support === 'SUPPORTED', reason: platformCapabilities.udp.reason },
    { type: 'TCP', label: 'TCP', available: platformCapabilities.tcp.support === 'SUPPORTED', reason: platformCapabilities.tcp.reason },
    { type: 'USB_SERIAL', label: 'USB', available: platformCapabilities.usbSerial.support === 'SUPPORTED', reason: platformCapabilities.usbSerial.reason },
  ];

  const networkProfiles: NetworkProfileType[] = ['LOCAL_WIFI', 'TELEMETRY_RADIO', 'USB_DIRECT', 'CELLULAR_VPN', 'CUSTOM', 'SITL'];

  const websocketProfiles = [
    { name: 'LOCAL PI', url: 'ws://192.168.1.247:8765/mavlink' },
    { name: '4G VPN', url: 'ws://100.64.0.10:8765/mavlink' },
    { name: 'EMULATOR', url: 'ws://127.0.0.1:8765/mavlink' },
  ];

  const udpProfiles = [
    { name: 'ARDUPILOT SITL', mode: 'LISTEN' as const, localPort: 14550, remoteHost: '', remotePort: 14550 },
    { name: 'PX4 SITL', mode: 'LISTEN' as const, localPort: 14540, remoteHost: '', remotePort: 14540 },
    { name: 'UDP CLIENT', mode: 'CLIENT' as const, localPort: 14550, remoteHost: '192.168.1.247', remotePort: 14550 },
  ];

  const connect = async () => {
    if (status === 'CONNECTED' || status === 'CONNECTING') {
      universalConnectionService.disconnect();
      return;
    }
    try {
      await universalConnectionService.configureMavlinkSigning(mavlinkConfig.signingPolicy, mavlinkConfig.signingLinkId);
    } catch (signingError) {
      Alert.alert('MAVLink signing', signingError instanceof Error ? friendlyError(signingError.message) : 'Unable to configure signing.');
      return;
    }
    if (isWebSocket) {
      const url = config.websocket.url.trim().replace('ws\\://', 'ws://').replace('wss\\://', 'wss://');
      if (url !== config.websocket.url) dispatch(updateWebSocketSettings({ url }));
      dispatch(setActiveConnectionInfo({ type: 'WEBSOCKET', portInfo: url }));
      universalConnectionService.connect({ ...config, websocket: { ...config.websocket, url } });
    } else if (isUdp) {
      dispatch(setActiveConnectionInfo({ type: 'UDP', portInfo: `UDP ${config.udp.localAddress}:${config.udp.localPort}` }));
      universalConnectionService.connect(config);
    } else if (isTcp) {
      dispatch(setActiveConnectionInfo({ type: 'TCP', portInfo: `TCP ${config.tcp.host}:${config.tcp.port}` }));
      universalConnectionService.connect(config);
    } else if (isUsb) {
      dispatch(setActiveConnectionInfo({ type: 'USB_SERIAL', portInfo: `USB ${config.serial.baudRate} baud` }));
      universalConnectionService.connect(config);
    }
  };

  const button = status === 'CONNECTED' ? 'Disconnect' : status === 'CONNECTING' ? 'Cancel connection' : 'Test & connect';
  const setPort = (field: 'localPort' | 'remotePort', value: string) => {
    const parsed = Number(value.replace(/\D/g, ''));
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) dispatch(updateUdpSettings({ [field]: parsed }));
  };
  const setTcpNumber = (field: 'port' | 'connectTimeoutMs', value: string) => {
    const parsed = Number(value.replace(/\D/g, ''));
    if (Number.isInteger(parsed) && parsed > 0) dispatch(updateTcpSettings({ [field]: parsed }));
  };
  const saveSigningKey = async () => {
    try {
      await storeMavlinkSigningKey(signingKeyInput);
      setSigningKeyInput('');
      Alert.alert('MAVLink signing', 'The 32-byte key was saved in platform secure storage.');
    } catch (keyError) {
      Alert.alert('Invalid signing key', keyError instanceof Error ? friendlyError(keyError.message) : 'Unable to save the key.');
    }
  };
  const saveProfile = () => {
    const name = profileName.trim();
    if (!name) return Alert.alert('Connection profile', 'Enter a profile name first.');
    const existing = savedProfiles.find(profile => profile.name.toLowerCase() === name.toLowerCase());
    const profile = createSavedConnectionProfile(existing?.id ?? `profile-${Date.now()}`, name, config);
    if (existing) profile.createdAt = existing.createdAt;
    dispatch(upsertConnectionProfile(profile));
    setProfileName('');
  };
  const scanUsbDevices = async () => {
    setUsbScanning(true);
    try {
      const devices = await UsbSerialTransport.scanDevices();
      setUsbDevices(devices);
      if (devices.length === 0) Alert.alert('USB serial', 'No supported USB serial device was found. Check the OTG cable and adapter chipset.');
    } finally {
      setUsbScanning(false);
    }
  };

  return (
    <>
      <Heading title="Connection" copy="Choose the actual transport. Transport ready is not vehicle connected: a valid MAVLink heartbeat is still required." />
      <Panel>
        <View style={styles.statusRow}>
          <StatusChip 
            value={status === 'CONNECTED' ? 'Connected' : status === 'CONNECTING' ? 'Opening' : status === 'ERROR' ? 'Failed' : 'Disconnected'} 
            tone={status === 'CONNECTED' ? 'success' : status === 'CONNECTING' ? 'warning' : status === 'ERROR' ? 'danger' : 'neutral'} 
            pulse={status === 'CONNECTING' || status === 'CONNECTED'} 
          />
          <Text style={styles.stage}>
            {status === 'CONNECTING' ? (mavlink === 'WAITING_HEARTBEAT' ? 'Transport ready; waiting for heartbeat' : 'Opening transport') : error ?? 'Ready to test'}
          </Text>
        </View>
        <Row label="Transport" value={`${config.type === 'WEBSOCKET' && config.websocket.url.trim().startsWith('wss://') ? 'WSS' : config.type} · ${network}`} />
        <Row label="MAVLink" value={mavlink} />
        <Row label="Vehicle" value={vehicle} />
        <Row label="Video" value={videoRuntime.status} />
        <Row label="Security" value={`${config.websocket.url.trim().startsWith('wss://') ? 'WSS' : 'PLAIN LINK'} · VPN ${config.networkProfile === 'CELLULAR_VPN' ? 'SYSTEM' : 'OFF'} · SIGNING ${mavlinkConfig.signingPolicy}`} />
        <SectionTitle>Transport</SectionTitle>
        <View style={styles.pills}>
          {transports.map(item => (
            <TouchableOpacity
              key={item.type}
              disabled={!item.available}
              style={[styles.pill, config.type === item.type && styles.pillActive, !item.available && { opacity: 0.42 }]}
              onPress={() => dispatch(setConnectionType(item.type))}
            >
              <Text style={[styles.pillText, config.type === item.type && styles.pillTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {transports.find(item => item.type === config.type)?.reason ? (
          <Note tone="danger">{transports.find(item => item.type === config.type)?.reason}</Note>
        ) : null}

        <SectionTitle>Network profile</SectionTitle>
        <View style={styles.pills}>
          {networkProfiles.map(profile => (
            <TouchableOpacity
              key={profile}
              style={[styles.pill, config.networkProfile === profile && styles.pillActive]}
              onPress={() => dispatch(updateConnectionConfig(applyNetworkProfile(config, profile)))}
            >
              <Text style={[styles.pillText, config.networkProfile === profile && styles.pillTextActive]}>{NETWORK_PROFILE_LABELS[profile]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle>Saved connections</SectionTitle>
        <View style={styles.pills}>
          {savedProfiles.map(profile => (
            <TouchableOpacity key={profile.id} style={styles.pill} onPress={() => dispatch(loadConnectionProfile(profile.id))} onLongPress={() => dispatch(removeConnectionProfile(profile.id))}>
              <Text style={styles.pillText}>{profile.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input label="PROFILE NAME" value={profileName} onChange={setProfileName} placeholder="MY DRONE - WIFI" />
        <TouchableOpacity style={styles.pill} onPress={saveProfile}><Text style={styles.pillText}>SAVE CURRENT PROFILE</Text></TouchableOpacity>

        {isWebSocket ? (
          <>
            <SectionTitle>Connection profile</SectionTitle>
            <View style={styles.pills}>
              {websocketProfiles.map(profile => (
                <TouchableOpacity 
                  key={profile.name} 
                  style={[styles.pill, config.websocket.url === profile.url && styles.pillActive]} 
                  onPress={() => dispatch(updateWebSocketSettings({ url: profile.url }))}
                >
                  <Text style={[styles.pillText, config.websocket.url === profile.url && styles.pillTextActive]}>
                    {profile.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="BINARY WEBSOCKET URL" value={config.websocket.url} onChange={value => dispatch(updateWebSocketSettings({ url: value }))} placeholder="ws://192.168.1.247:8765/mavlink" />
            <Toggle label="Auto connect at startup" value={config.websocket.autoConnect} onChange={value => dispatch(updateWebSocketSettings({ autoConnect: value }))} />
            <Toggle label="Reconnect after link loss" value={config.websocket.reconnect} onChange={value => dispatch(updateWebSocketSettings({ reconnect: value }))} />
          </>
        ) : isUdp ? (
          <>
            <SectionTitle>UDP profile</SectionTitle>
            <View style={styles.pills}>
              {udpProfiles.map(profile => (
                <TouchableOpacity key={profile.name} style={styles.pill} onPress={() => dispatch(updateUdpSettings(profile))}>
                  <Text style={styles.pillText}>{profile.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pills}>
              {(['LISTEN', 'CLIENT'] as const).map(mode => (
                <TouchableOpacity key={mode} style={[styles.pill, config.udp.mode === mode && styles.pillActive]} onPress={() => dispatch(updateUdpSettings({ mode }))}>
                  <Text style={[styles.pillText, config.udp.mode === mode && styles.pillTextActive]}>
                    {mode === 'LISTEN' ? 'LISTEN / SERVER' : 'SEND TO REMOTE'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="LOCAL BIND ADDRESS" value={config.udp.localAddress} onChange={value => dispatch(updateUdpSettings({ localAddress: value }))} placeholder="0.0.0.0" />
            <Input label="LOCAL PORT" value={String(config.udp.localPort)} onChange={value => setPort('localPort', value)} placeholder="14550" />
            {config.udp.mode === 'CLIENT' ? (
              <>
                <Input label="REMOTE HOST" value={config.udp.remoteHost} onChange={value => dispatch(updateUdpSettings({ remoteHost: value }))} placeholder="192.168.1.247" />
                <Input label="REMOTE PORT" value={String(config.udp.remotePort)} onChange={value => setPort('remotePort', value)} placeholder="14550" />
              </>
            ) : null}
            <Toggle label="Auto connect at startup" value={config.udp.autoConnect} onChange={value => dispatch(updateUdpSettings({ autoConnect: value }))} />
            <Toggle label="Reconnect after link loss" value={config.udp.reconnect} onChange={value => dispatch(updateUdpSettings({ reconnect: value }))} />
          </>
        ) : isTcp ? (
          <>
            <Input label="TCP HOST" value={config.tcp.host} onChange={value => dispatch(updateTcpSettings({ host: value }))} placeholder="192.168.1.12" />
            <Input label="TCP PORT" value={String(config.tcp.port)} onChange={value => setTcpNumber('port', value)} placeholder="5760" />
            <Input label="CONNECT TIMEOUT (MS)" value={String(config.tcp.connectTimeoutMs)} onChange={value => setTcpNumber('connectTimeoutMs', value)} placeholder="5000" />
            <Toggle label="Auto connect at startup" value={config.tcp.autoConnect} onChange={value => dispatch(updateTcpSettings({ autoConnect: value }))} />
            <Toggle label="Reconnect after link loss" value={config.tcp.reconnect} onChange={value => dispatch(updateTcpSettings({ reconnect: value }))} />
          </>
        ) : isUsb ? (
          <>
            <SectionTitle>Android USB serial</SectionTitle>
            <TouchableOpacity style={styles.pill} disabled={usbScanning} onPress={scanUsbDevices}>
              <Text style={styles.pillText}>{usbScanning ? 'SCANNING…' : 'SCAN USB DEVICES'}</Text>
            </TouchableOpacity>
            {usbDevices.map(device => {
              const selected = config.serial.port === device.deviceId;
              return (
                <TouchableOpacity
                  key={device.deviceId}
                  style={[styles.pill, selected && styles.pillActive]}
                  onPress={() => dispatch(updateSerialSettings({
                    port: device.deviceId,
                    deviceId: null,
                    vendorId: device.vendorId,
                    productId: device.productId,
                  }))}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                    {device.deviceName} · {device.vendorId.toString(16).padStart(4, '0')}:{device.productId.toString(16).padStart(4, '0')} · {device.permissionGranted ? 'PERMITTED' : 'PERMISSION ON CONNECT'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.pills}>
              {SUPPORTED_SERIAL_BAUD_RATES.map(baud => (
                <TouchableOpacity key={baud} style={[styles.pill, config.serial.baudRate === baud && styles.pillActive]} onPress={() => dispatch(updateSerialSettings({ baudRate: baud }))}>
                  <Text style={[styles.pillText, config.serial.baudRate === baud && styles.pillTextActive]}>{baud}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Note>{platformCapabilities.usbSerial.reason ?? 'Select a permitted USB device, then connect. iOS direct USB serial is not offered.'}</Note>
          </>
        ) : null}

        <SectionTitle>MAVLink 2 signing</SectionTitle>
        <View style={styles.pills}>
          {(['DISABLED', 'SIGN_OUTGOING', 'REQUIRE_VALID'] as MavlinkSigningPolicy[]).map(policy => (
            <TouchableOpacity
              key={policy}
              disabled={config.protocol !== 'MAVLINK_V2' && policy !== 'DISABLED'}
              style={[styles.pill, mavlinkConfig.signingPolicy === policy && styles.pillActive, config.protocol !== 'MAVLINK_V2' && policy !== 'DISABLED' && { opacity: 0.42 }]}
              onPress={() => dispatch(updateMavlinkSettings({ signingPolicy: policy }))}
            >
              <Text style={[styles.pillText, mavlinkConfig.signingPolicy === policy && styles.pillTextActive]}>{policy.replaceAll('_', ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {mavlinkConfig.signingPolicy !== 'DISABLED' ? (
          <>
            <Input
              label="LINK ID (0-255)"
              value={String(mavlinkConfig.signingLinkId)}
              onChange={value => {
                const linkId = Number(value.replace(/\D/g, ''));
                if (Number.isInteger(linkId) && linkId >= 0 && linkId <= 255) dispatch(updateMavlinkSettings({ signingLinkId: linkId }));
              }}
              placeholder="0"
            />
            <Text style={styles.label}>32-BYTE KEY (64 HEX CHARACTERS)</Text>
            <TextInput
              style={styles.input}
              value={signingKeyInput}
              onChangeText={setSigningKeyInput}
              secureTextEntry
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Key is never shown or stored in Redux"
              placeholderTextColor={colors.textDim}
            />
            <View style={styles.pills}>
              <TouchableOpacity style={styles.pill} onPress={saveSigningKey}><Text style={styles.pillText}>SAVE KEY SECURELY</Text></TouchableOpacity>
              <TouchableOpacity style={styles.pill} onPress={() => { void deleteMavlinkSigningKey(); setSigningKeyInput(''); }}><Text style={styles.pillText}>DELETE KEY</Text></TouchableOpacity>
            </View>
          </>
        ) : null}
        <TouchableOpacity style={[styles.primary, status === 'CONNECTING' && styles.primaryWarning]} onPress={connect}>
          <MaterialCommunityIcons name={status === 'CONNECTED' ? 'lan-disconnect' : status === 'CONNECTING' ? 'close' : 'lan-connect'} size={17} color="#FFF" />
          <Text style={styles.primaryText}>{button}</Text>
        </TouchableOpacity>
      </Panel>
      {error ? (
        <Note tone="danger">{friendlyError(error)}</Note>
      ) : isUdp ? (
        <Note>Direct UDP requires a rebuilt Expo development client. For SITL, forward packets to the phone IP and the selected local port.</Note>
      ) : isTcp ? (
        <Note>TCP uses a native stream socket and waits for a valid MAVLink heartbeat after the server accepts the connection.</Note>
      ) : isUsb ? (
        <Note>USB Serial is Android-only. Scan and select the device; Android requests USB permission when you connect.</Note>
      ) : (
        <Note>Use exactly ws://IP:8765/mavlink. The phone and Pi must be on the same Wi-Fi unless a VPN is configured.</Note>
      )}
    </>
  );
}

function friendlyError(error: string) {
  if (error.includes('NATIVE_UDP_MODULE_UNAVAILABLE')) return 'Direct UDP is not available in Expo Go. Rebuild and install the development client after adding the native UDP module.';
  if (error.includes('INVALID_UDP_LOCAL_PORT')) return 'The UDP local port must be between 1 and 65535.';
  if (error.includes('INVALID_UDP_REMOTE_ENDPOINT')) return 'The UDP remote host and port are incomplete.';
  if (error.includes('INVALID_WEBSOCKET_URL')) return 'The WebSocket URL is invalid. Remove any backslash and use ws://IP:8765/mavlink.';
  if (error.includes('USB_PERMISSION_DENIED')) return 'USB permission was denied. Reconnect the cable and approve access when Android asks.';
  if (error.includes('USB_DEVICE_NOT_FOUND')) return 'No supported USB serial device was found. Check USB OTG and scan again.';
  if (error.includes('TCP_OPEN_TIMEOUT')) return 'The TCP server did not respond before the configured timeout.';
  if (error.includes('MAVLINK_SIGNING_KEY_NOT_CONFIGURED')) return 'Save a valid 32-byte MAVLink signing key before enabling signing.';
  if (error.includes('SIGNING_CHANGE_REQUIRES_DISCONNECT')) return 'Disconnect before changing MAVLink signing settings.';
  if (error.includes('OPEN_FAILED')) return 'The phone could not open the transport. Check its IP, port, Wi-Fi, firewall and local-network permission.';
  if (error.includes('HEARTBEAT')) return 'The transport opened, but no valid MAVLink heartbeat arrived.';
  return error.replaceAll('_', ' ');
}

function Video() {
  return (
    <>
      <Heading title="Video" copy="MediaMTX WebRTC is the Expo Go path. Video remains independent from the MAVLink connection." />
      <WebRtcVideoSettings />
    </>
  );
}

function Control() {
  const dispatch = useAppDispatch();
  const joystick = useAppSelector(selectJoystickSettings);
  const show = useAppSelector(selectShowJoysticks);

  return (
    <>
      <Heading title="Control" copy="Mode 2 controls with safety cutoffs on stale input and lost heartbeat." />
      <Panel>
        <Toggle label="Show virtual joysticks" value={show} onChange={value => dispatch(setShowJoysticks(value))} />
        <Stepper label="Deadzone" value={joystick.deadzone} step={0.01} min={0} max={0.4} onChange={value => dispatch(updateJoystickSettings({ deadzone: value }))} />
        <Stepper label="Sensitivity" value={joystick.sensitivity} step={0.1} min={0.1} max={2} onChange={value => dispatch(updateJoystickSettings({ sensitivity: value }))} />
        <Stepper label="Expo" value={joystick.expo} step={0.05} min={0} max={1} onChange={value => dispatch(updateJoystickSettings({ expo: value }))} />
        <Stepper label="Update rate" value={joystick.updateRateHz} step={1} min={5} max={30} onChange={value => dispatch(updateJoystickSettings({ updateRateHz: value }))} />
      </Panel>
    </>
  );
}

function Telemetry() {
  const dispatch = useAppDispatch();
  const telemetry = useAppSelector(selectTelemetrySettings);

  return (
    <>
      <Heading title="Telemetry" copy="Bounded UI rates keep navigation and controls responsive." />
      <Panel>
        <Stepper label="Attitude Hz" value={telemetry.attitudeUpdateRateHz} step={1} min={1} max={20} onChange={value => dispatch(updateTelemetrySettings({ attitudeUpdateRateHz: value }))} />
        <Stepper label="GPS Hz" value={telemetry.gpsUpdateRateHz} step={1} min={1} max={10} onChange={value => dispatch(updateTelemetrySettings({ gpsUpdateRateHz: value }))} />
        <Stepper label="Battery Hz" value={telemetry.batteryUpdateRateHz} step={1} min={1} max={5} onChange={value => dispatch(updateTelemetrySettings({ batteryUpdateRateHz: value }))} />
      </Panel>
    </>
  );
}

function MapMission() {
  return (
    <>
      <Heading title="Map & Mission" copy="The map follows the phone until live vehicle GPS becomes available." />
      <Panel>
        <Row label="Map provider" value="OpenStreetMap" />
        <Row label="Offline fallback" value="Not installed" />
        <Row label="Default waypoint altitude" value="50 m" />
        <Row label="Mission frame" value="Global relative altitude" />
      </Panel>
      <Note>Map tiles require internet access. Position markers always come from device GPS or live vehicle telemetry.</Note>
    </>
  );
}

function Safety() {
  return (
    <>
      <Heading title="Safety" copy="Critical command protections are always enabled." />
      <Panel>
        <Row label="Heartbeat required" value="Enforced" />
        <Row label="Stale input cutoff" value="Enforced" />
        <Row label="Background cutoff" value="Enforced" />
        <Row label="Critical command confirmation" value="Enforced" />
      </Panel>
      <Note>Safety cutoffs cannot be disabled from the production interface.</Note>
    </>
  );
}

function Appearance() {
  return (
    <>
      <Heading title="Appearance" copy="A clean light cockpit layout optimized for landscape mobile use." />
      <Panel>
        <Row label="Theme" value="Light frosted glass" />
        <Row label="Orientation" value="Landscape locked" />
        <Row label="Motion" value="Subtle" />
        <Row label="Telemetry placeholders" value="Truthful (-- only)" />
      </Panel>
    </>
  );
}

function About() {
  const status = useAppSelector(selectConnectionStatus);
  const mavlink = useAppSelector(selectMavlinkState);
  const pps = useAppSelector(selectPacketsPerSec);

  return (
    <>
      <Heading title="About" copy="Application and live link diagnostics." />
      <Panel>
        <Row label="App" value="ANITECH GCS 1.0.0" />
        <Row label="Expo" value="SDK 54" />
        <Row label="Link" value={status} />
        <Row label="MAVLink" value={mavlink} />
        <Row label="Traffic" value={`${pps} packets/s`} />
      </Panel>
      <Panel>
        <SectionTitle>Runtime capabilities · {platformCapabilities.platform.toUpperCase()}</SectionTitle>
        <Row label="WebSocket / WSS" value={platformCapabilities.webSocket.support} />
        <Row label="UDP" value={platformCapabilities.udp.support} />
        <Row label="TCP" value={platformCapabilities.tcp.support} />
        <Row label="USB Serial" value={platformCapabilities.usbSerial.support} />
        <Row label="WebRTC" value={platformCapabilities.webRtc.support} />
        <Row label="RTSP" value={platformCapabilities.rtsp.support} />
        <Row label="Secure key storage" value={platformCapabilities.secureStorage.support} />
        <Row label="System VPN addresses" value={platformCapabilities.systemVpn.support} />
      </Panel>
      {platformCapabilities.expoGo ? <Note tone="danger">Expo Go cannot load UDP, TCP, USB Serial or native RTSP. Install a rebuilt ANITECH development client.</Note> : null}
    </>
  );
}

function Heading({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.headingTitle}>{title}</Text>
      <Text style={styles.headingCopy}>{copy}</Text>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View>
      <Label text={label} />
      <TextInput 
        autoCapitalize="none" 
        autoCorrect={false} 
        style={styles.input} 
        value={value} 
        placeholder={placeholder} 
        placeholderTextColor={colors.textDim} 
        onChangeText={onChange} 
      />
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleText}>{label}</Text>
      <Switch 
        value={value} 
        onValueChange={onChange} 
        trackColor={{ false: colors.borderStrong, true: '#A9D3FF' }} 
        thumbColor={value ? colors.primary : colors.textDim} 
      />
    </View>
  );
}

function Stepper({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.toggleText}>{label}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}>
        <Text style={styles.stepText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, Number((value + step).toFixed(2))))}>
        <Text style={styles.stepText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Note({ children, tone = 'warning' }: { children: React.ReactNode; tone?: 'warning' | 'danger' }) {
  const danger = tone === 'danger';
  return (
    <View style={[styles.note, danger && styles.noteDanger]}>
      <MaterialCommunityIcons name={danger ? 'alert-circle-outline' : 'information-outline'} size={18} color={danger ? colors.danger : colors.warning} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  workspaceInner: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  categoryShell: {
    flexGrow: 0,
    flexShrink: 0,
    height: 52,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderColor: 'rgba(255, 255, 255, 0.54)',
  },
  categoryShellContent: {
    flex: 1,
  },
  categoryBar: {
    flex: 1,
  },
  body: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
  },
  categoryContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  category: {
    width: 154,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.pill,
  },
  categoryCompact: {
    width: 116,
    height: 36,
    paddingHorizontal: 6,
  },
  categoryActive: {
    borderColor: 'rgba(47, 128, 237, 0.45)',
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  categoryIconCompact: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  categoryIconActive: {
    backgroundColor: 'rgba(47, 128, 237, 0.15)',
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  categoryTitle: {
    color: '#5D6B7E',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  categoryTitleActive: {
    color: '#2F80ED',
  },
  categorySub: {
    color: '#8A96A8',
    fontSize: 7.5,
    marginTop: 1,
  },
  detail: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  detailContent: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    marginBottom: 6,
  },
  headingTitle: {
    color: '#1E2A3A',
    fontSize: 20,
    fontWeight: '900',
  },
  headingCopy: {
    color: '#5D6B7E',
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: 3,
    maxWidth: 620,
  },
  statusRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  stage: {
    flex: 1,
    minWidth: 0,
    color: '#5D6B7E',
    fontSize: 9,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pill: {
    minWidth: 0,
    height: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.80)',
  },
  pillActive: {
    borderColor: '#2F80ED',
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  pillText: {
    color: '#5D6B7E',
    fontSize: 8.5,
    fontWeight: '900',
  },
  pillTextActive: {
    color: '#2F80ED',
  },
  label: {
    color: '#5D6B7E',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  input: {
    height: 42,
    minWidth: 0,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: glass.borderStrong,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    color: '#1E2A3A',
    fontSize: 10,
    fontWeight: '700',
  },
  primary: {
    height: 44,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: '#2F80ED',
    marginTop: spacing.sm,
  },
  primaryWarning: {
    backgroundColor: colors.warning,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  note: {
    minWidth: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F4D69A',
    backgroundColor: colors.warningMuted,
  },
  noteDanger: {
    borderColor: '#F3B8BA',
    backgroundColor: colors.dangerMuted,
  },
  noteText: {
    flex: 1,
    minWidth: 0,
    color: '#5D6B7E',
    fontSize: 8.5,
    lineHeight: 13,
  },
  toggle: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  toggleText: {
    flex: 1,
    minWidth: 0,
    color: '#1E2A3A',
    fontSize: 9.5,
    fontWeight: '700',
  },
  stepper: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  stepBtn: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  stepText: {
    color: '#2F80ED',
    fontSize: 18,
    fontWeight: '800',
  },
  stepValue: {
    width: 50,
    textAlign: 'center',
    color: '#1E2A3A',
    fontSize: 10,
    fontWeight: '900',
  },
  row: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    color: '#5D6B7E',
    fontSize: 9,
    fontWeight: '800',
  },
  rowValue: {
    flexShrink: 1,
    color: '#1E2A3A',
    fontSize: 9.5,
    fontWeight: '800',
    maxWidth: '60%',
    textAlign: 'right',
  },
  contextPanel: {
    width: 280,
    flexShrink: 0,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  connectionVisual: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 244, 248, 0.85)',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  signalRingLarge: {
    position: 'absolute',
    width: 170,
    height: 80,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#CBE3FB',
  },
  signalRingSmall: {
    position: 'absolute',
    width: 115,
    height: 54,
    borderRadius: 58,
    borderWidth: 2,
    borderColor: '#A9D2FA',
  },
  visualBadge: {
    position: 'absolute',
    right: 66,
    bottom: 44,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  contextTip: {
    minWidth: 0,
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  contextVisual: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  contextTitle: {
    color: '#1E2A3A',
    fontSize: 12,
    fontWeight: '900',
  },
  contextCopy: {
    color: '#5D6B7E',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },
  checkLine: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 244, 248, 0.85)',
  },
  checkDone: {
    backgroundColor: colors.success,
  },
  checkLoading: {
    borderWidth: 1,
    borderColor: '#2F80ED',
    backgroundColor: 'rgba(47, 128, 237, 0.12)',
  },
  checkLabel: {
    flex: 1,
    minWidth: 0,
    color: '#5D6B7E',
    fontSize: 9,
    fontWeight: '700',
  },
});
