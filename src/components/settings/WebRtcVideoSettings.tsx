import React from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectVideoSettings, updateVideoSettings } from '../../store/settings/settingsSlice';
import { selectVideoRuntime } from '../../store/videoSlice';
import { selectWebRtcConfig } from '../../video/VideoConfig';
import { buildMediaMtxBrowserUrl, buildMediaMtxWebRtcUrl, normalizeStreamPath, validateRtspUrl } from '../../video/VideoSourceResolver';
import { isExpoGo, videoCapabilities } from '../../video/videoCapabilities';
import { colors, radius, spacing } from '../../theme/gcsTheme';

export function WebRtcVideoSettings() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const video = useAppSelector(selectVideoSettings);
  const runtime = useAppSelector(selectVideoRuntime);
  const config = React.useMemo(() => selectWebRtcConfig(video), [video]);
  const urls = React.useMemo(() => {
    try { return { player: buildMediaMtxWebRtcUrl(config), browser: buildMediaMtxBrowserUrl(config), error: null }; }
    catch (error) { return { player: '--', browser: null, error: error instanceof Error ? error.message : 'Invalid configuration.' }; }
  }, [config]);
  const updatePort = (value: string) => {
    const port = Number(value.replace(/\D/g, ''));
    if (Number.isInteger(port) && port >= 1 && port <= 65_535) dispatch(updateVideoSettings({ port }));
  };
  const rtspError = React.useMemo(() => {
    try { validateRtspUrl(video.rtspUrl); return null; }
    catch (error) { return error instanceof Error ? error.message : 'Invalid RTSP URL.'; }
  }, [video.rtspUrl]);
  const chooseTransport = (transport: 'WEBRTC' | 'RTSP' | 'UDP_H264') => {
    if (transport === 'UDP_H264' && !videoCapabilities.nativeUdpH264) return;
    if (transport === 'RTSP' && !videoCapabilities.nativeRtsp) return;
    dispatch(updateVideoSettings({ transport, source: transport === 'WEBRTC' ? 'WebRTC' : transport === 'RTSP' ? 'RTSP' : 'UDP H.264' }));
  };
  const openBrowser = async () => {
    if (!urls.browser) return Alert.alert('Invalid video configuration', urls.error ?? 'Check host, port and path.');
    try { await Linking.openURL(urls.browser); }
    catch { Alert.alert('Unable to open URL', 'The phone could not open the MediaMTX address. Check local-network access and the URL.'); }
  };

  return <>
    <View style={styles.panel}>
      <Text style={styles.section}>TRANSPORT</Text>
      <View style={styles.pills}>
        <Choice label="WEBRTC" detail="Supported · Expo Go" active={video.transport === 'WEBRTC'} onPress={() => chooseTransport('WEBRTC')}/>
        <Choice label="RTSP" detail={videoCapabilities.nativeRtsp ? 'Native VLC' : 'Development Build required'} active={video.transport === 'RTSP'} disabled={!videoCapabilities.nativeRtsp} onPress={() => chooseTransport('RTSP')}/>
        <Choice label="UDP H.264" detail={videoCapabilities.nativeUdpH264 ? 'Development Build' : 'Development Build required'} active={video.transport === 'UDP_H264'} disabled={!videoCapabilities.nativeUdpH264} onPress={() => chooseTransport('UDP_H264')}/>
      </View>
      <Text style={styles.runtime}>{isExpoGo ? 'Expo Go detected' : 'Development/standalone runtime'} · WebView available</Text>
    </View>

    {video.transport === 'RTSP' ? (
      <View style={styles.panel}>
        <Text style={styles.section}>RTSP CONFIG</Text>
        <Field label="RTSP URL" value={video.rtspUrl} placeholder="rtsp://192.168.1.27:8554/landing-cam" onChange={rtspUrl => dispatch(updateVideoSettings({ rtspUrl }))}/>
        <Text style={[styles.url, rtspError && styles.error]}>{rtspError ?? video.rtspUrl}</Text>
        <View style={styles.actions}>
          <Action icon="play-circle-outline" label="TEST IN APP" disabled={Boolean(rtspError)} onPress={() => navigation.navigate('Video')}/>
        </View>
        <Text style={styles.runtime}>RTSP uses the native VLC view and is unavailable in Expo Go. Credentials embedded in URLs are rejected.</Text>
      </View>
    ) : null}

    {video.transport === 'WEBRTC' ? <View style={styles.panel}>
      <Text style={styles.section}>WEBRTC CONFIG</Text>
      <Text style={styles.label}>SCHEME</Text>
      <View style={styles.pills}>{(['http', 'https'] as const).map(scheme => <TouchableOpacity key={scheme} style={[styles.smallPill, video.scheme === scheme && styles.active]} onPress={() => dispatch(updateVideoSettings({ scheme }))}><Text style={[styles.pillText, video.scheme === scheme && styles.activeText]}>{scheme.toUpperCase()}</Text></TouchableOpacity>)}</View>
      <Field label="MEDIAMTX HOST" value={video.host} placeholder="192.168.1.50" onChange={host => dispatch(updateVideoSettings({ host: host.trim() }))}/>
      <Field label="PORT" value={String(video.port)} placeholder="8889" keyboard="number-pad" onChange={updatePort}/>
      <Field label="STREAM PATH" value={video.streamPath} placeholder="landing-cam" onChange={streamPath => dispatch(updateVideoSettings({ streamPath }))} onBlur={() => dispatch(updateVideoSettings({ streamPath: normalizeStreamPath(video.streamPath) }))}/>
      <Toggle label="Autoplay" value={video.autoplay} onChange={autoplay => dispatch(updateVideoSettings({ autoplay }))}/>
      <Toggle label="Muted" value={video.muted} onChange={muted => dispatch(updateVideoSettings({ muted }))}/>
      <Toggle label="Controls" value={video.controls} onChange={controls => dispatch(updateVideoSettings({ controls }))}/>
      <Toggle label="Auto reconnect" value={video.autoReconnect} onChange={autoReconnect => dispatch(updateVideoSettings({ autoReconnect }))}/>
      <Text style={styles.label}>GENERATED URL</Text><Text selectable style={[styles.url, urls.error && styles.error]}>{urls.error ?? urls.player}</Text>
      <View style={styles.actions}>
        <Action icon="play-circle-outline" label="TEST IN APP" disabled={!urls.browser || video.transport !== 'WEBRTC'} onPress={() => navigation.navigate('Video')}/>
        <Action icon="open-in-new" label="OPEN URL" disabled={!urls.browser} onPress={openBrowser}/>
        <Action icon="content-save-outline" label="SAVE" onPress={() => Alert.alert('Video settings saved', 'Settings are persisted locally and applied independently from MAVLink.')}/>
      </View>
    </View> : null}

    <View style={styles.panel}>
      <Text style={styles.section}>VIDEO DIAGNOSTICS</Text>
      <Diagnostic label="Transport" value={video.transport}/><Diagnostic label="Host" value={video.host || '--'}/><Diagnostic label="Port" value={String(video.port)}/><Diagnostic label="Path" value={video.streamPath || '--'}/><Diagnostic label="Status" value={runtime.status}/><Diagnostic label="Last error" value={runtime.lastError ?? '--'}/><Diagnostic label="Reconnect attempts" value={String(runtime.reconnectAttempt)}/><Diagnostic label="Current URL" value={runtime.currentUrl ?? '--'}/>
    </View>

    <View style={styles.note}><MaterialCommunityIcons name="information-outline" size={18} color={colors.warning}/><Text style={styles.noteText}>For local WebRTC, the phone and Raspberry Pi must be reachable on the same network or VPN. Test the URL in Safari first. MediaMTX needs TCP 8889 for signaling and UDP 8189 for ICE media.</Text></View>

  </>;
}

function Choice({ label, detail, active, disabled, onPress }: { label: string; detail: string; active: boolean; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} style={[styles.choice, active && styles.active, disabled && styles.disabled]} onPress={onPress}><Text style={[styles.choiceTitle, active && styles.activeText]}>{label}</Text><Text style={styles.choiceDetail}>{detail}</Text></TouchableOpacity>; }
function Field({ label, value, placeholder, keyboard, onChange, onBlur }: { label: string; value: string; placeholder: string; keyboard?: 'number-pad'; onChange: (value: string) => void; onBlur?: () => void }) { return <View><Text style={styles.label}>{label}</Text><TextInput autoCapitalize="none" autoCorrect={false} keyboardType={keyboard} style={styles.input} value={value} placeholder={placeholder} placeholderTextColor={colors.textDim} onChangeText={onChange} onBlur={onBlur}/></View>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <View style={styles.toggle}><Text style={styles.toggleText}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.borderStrong, true: '#A9D3FF' }} thumbColor={value ? colors.primary : colors.textDim}/></View>; }
function Action({ icon, label, disabled, onPress }: { icon: any; label: string; disabled?: boolean; onPress: () => void }) { return <TouchableOpacity disabled={disabled} style={[styles.action, disabled && styles.disabled]} onPress={onPress}><MaterialCommunityIcons name={icon} size={16} color="#fff"/><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
function Diagnostic({ label, value }: { label: string; value: string }) { return <View style={styles.diagnostic}><Text style={styles.diagnosticLabel}>{label}</Text><Text selectable numberOfLines={3} style={styles.diagnosticValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  panel: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, marginBottom: spacing.sm },
  section: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: .5, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flex: 1, minWidth: 150, minHeight: 54, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceTitle: { color: colors.text, fontSize: 9.5, fontWeight: '900' }, choiceDetail: { color: colors.textMuted, fontSize: 8, marginTop: 3 },
  smallPill: { height: 32, minWidth: 74, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  active: { borderColor: colors.primary, backgroundColor: colors.primaryMuted }, activeText: { color: colors.primaryDark }, disabled: { opacity: .45 }, pillText: { color: colors.textMuted, fontSize: 8.5, fontWeight: '900' },
  runtime: { marginTop: 8, color: colors.textMuted, fontSize: 8.5 }, label: { color: colors.textDim, fontSize: 8, fontWeight: '900', letterSpacing: .4, marginTop: 9, marginBottom: 4 },
  input: { height: 40, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.text, fontSize: 10 },
  toggle: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, toggleText: { color: colors.text, fontSize: 9.5, fontWeight: '700' },
  url: { padding: 9, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.textMuted, fontSize: 8.5 }, error: { color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, action: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 11, borderRadius: radius.sm, backgroundColor: colors.primary }, actionText: { color: '#fff', fontSize: 8.5, fontWeight: '900' },
  diagnostic: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, diagnosticLabel: { width: 125, color: colors.textMuted, fontSize: 8.5, fontWeight: '800' }, diagnosticValue: { flex: 1, color: colors.text, fontSize: 8.5, textAlign: 'right' },
  note: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: '#F4D69A', backgroundColor: colors.warningMuted }, noteText: { flex: 1, color: colors.textMuted, fontSize: 8.5, lineHeight: 13 },
});
