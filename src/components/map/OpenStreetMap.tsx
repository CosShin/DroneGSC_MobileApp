import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Waypoint } from '../../store/mission/missionSlice';
import { colors } from '../../theme/gcsTheme';
import { MAP_PHONE_LOGO_BASE64 } from './mapPhoneLogoBase64';

export interface MapPosition {
  latitude: number;
  longitude: number;
}

export interface MapPhonePosition extends MapPosition {
  accuracy?: number | null;
}

interface Props {
  active?: boolean;
  vehiclePosition?: MapPosition | null;
  phonePosition?: MapPhonePosition | null;
  homePosition?: MapPosition | null;
  previewHomePosition?: MapPosition | null;
  yaw?: number;
  waypoints: Waypoint[];
  selectedWaypointId?: string | null;
  followVehicle?: boolean;
  editable?: boolean;
  fitRequest?: number;
  centerHomeRequest?: number;
  onMapPress?: (p: MapPosition) => void;
  onWaypointPress?: (id: string) => void;
  onWaypointMove?: (id: string, p: MapPosition) => void;
}

const MAP_HTML = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; background: #07111f; font-family: system-ui, -apple-system, sans-serif; }
    .leaflet-control-attribution { font-size: 8px!important; color: #d8e6f5!important; background: rgba(7,12,20,.72)!important; border-radius: 7px 0 0 0!important; }
    .leaflet-control-attribution a { color: #72b9ff!important; }
    .leaflet-control-zoom { border: 1px solid rgba(255,255,255,.16)!important; border-radius: 10px!important; overflow: hidden; box-shadow: 0 7px 18px rgba(0,0,0,.28)!important; }
    .leaflet-control-zoom a { background: rgba(7,12,20,.78)!important; color: #f2f7fc!important; border-color: rgba(255,255,255,.12)!important; }
    
    /* Mission Waypoint Marker */
    .wp { width: 26px; height: 26px; border-radius: 13px; background: #fff; border: 3px solid #1687f8; color: #0868c7; text-align: center; line-height: 20px; font: bold 11px sans-serif; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
    .wp.selected { background: #1687f8; color: #fff; border-color: #fff; }

    /* Aircraft / Vehicle Marker */
    .vehicle-marker { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; transition: transform 0.15s ease-out; }
    .vehicle-arrow { width: 30px; height: 30px; border-radius: 15px; background: #ffffff; border: 3px solid #2F80ED; color: #2F80ED; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; box-shadow: 0 3px 12px rgba(47,128,237,0.45); }

    /* Phone / GCS Location Marker (ANITECH A Logo) */
    .phone-marker { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
    .phone-logo-img { width: 28px; height: 28px; border-radius: 14px; box-shadow: 0 3px 10px rgba(0,0,0,0.5), 0 0 0 2px #ffffff, 0 0 0 4px rgba(47,128,237,0.45); object-fit: contain; display: block; }

    /* Official Home Position Marker */
    .home-marker { position: relative; width: 34px; height: 34px; display: flex; flex-direction: column; align-items: center; }
    .home-badge { width: 26px; height: 26px; border-radius: 13px; background: #10B981; border: 2.5px solid #ffffff; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; box-shadow: 0 3px 10px rgba(16,185,129,0.5); }
    .home-tag { margin-top: 1px; padding: 1px 4px; background: rgba(7,17,31,0.85); border: 1px solid rgba(16,185,129,0.7); border-radius: 4px; color: #10B981; font-size: 8px; font-weight: 900; letter-spacing: 0.5px; white-space: nowrap; }

    /* Preview Home Marker (when selecting on map) */
    .preview-home-marker { position: relative; width: 36px; height: 36px; display: flex; flex-direction: column; align-items: center; animation: pulse-preview 1.2s infinite alternate; }
    .preview-home-badge { width: 26px; height: 26px; border-radius: 13px; background: rgba(245,158,11,0.85); border: 2.5px dashed #ffffff; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; box-shadow: 0 3px 12px rgba(245,158,11,0.6); }
    .preview-home-tag { margin-top: 1px; padding: 1px 4px; background: rgba(245,158,11,0.95); border-radius: 4px; color: #ffffff; font-size: 7.5px; font-weight: 900; letter-spacing: 0.5px; white-space: nowrap; }

    @keyframes pulse-preview {
      0% { transform: scale(0.95); }
      100% { transform: scale(1.08); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: 'Google' }).addTo(map);

    const PHONE_LOGO_URI = '${MAP_PHONE_LOGO_BASE64}';
    let vehicleMarker = null;
    let phoneMarker = null;
    let phoneAccuracyCircle = null;
    let homeMarker = null;
    let previewHomeMarker = null;
    let missionPath = null;
    let missionMarkers = [];
    let centered = false;
    let lastFit = -1;
    let lastCenterHome = -1;
    let editable = false;
    let lastMissionSignature = '';

    const send = data => window.ReactNativeWebView.postMessage(JSON.stringify(data));

    map.on('click', e => {
      send({ type: 'mapPress', latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    function update(raw) {
      const d = JSON.parse(raw);
      editable = !!d.editable;

      // 1. Mission Route & Waypoints
      const pts = (d.waypoints || []).map(w => [w.lat, w.lng]);
      const missionSignature = JSON.stringify([d.waypoints || [], d.selectedWaypointId || null, editable]);
      if (missionSignature !== lastMissionSignature) {
        lastMissionSignature = missionSignature;
        missionMarkers.forEach(m => map.removeLayer(m));
        missionMarkers = [];
        if (missionPath) { map.removeLayer(missionPath); missionPath = null; }
        if (pts.length) {
          missionPath = L.polyline(pts, { color: '#1687f8', weight: 4, opacity: 0.85 }).addTo(map);
        }

        (d.waypoints || []).forEach((w, i) => {
          const selected = w.id === d.selectedWaypointId;
          const icon = L.divIcon({
            className: '',
            html: '<div class="wp ' + (selected ? 'selected' : '') + '">' + (i + 1) + '</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          const m = L.marker([w.lat, w.lng], { icon, draggable: editable }).addTo(map);
          m.on('click', () => send({ type: 'waypointPress', id: w.id }));
          m.on('dragend', e => {
            const p = e.target.getLatLng();
            send({ type: 'waypointMove', id: w.id, latitude: p.lat, longitude: p.lng });
          });
          missionMarkers.push(m);
        });
      }

      // 2. Vehicle Position Marker
      if (d.vehiclePosition && d.vehiclePosition.latitude != null && d.vehiclePosition.longitude != null) {
        const hasYaw = Number.isFinite(d.yaw);
        const vHtml = hasYaw
          ? '<div class="vehicle-marker" style="transform: rotate(' + d.yaw + 'deg)"><div class="vehicle-arrow">▲</div></div>'
          : '<div class="vehicle-marker"><div class="vehicle-arrow">●</div></div>';
        const vIcon = L.divIcon({ className: '', html: vHtml, iconSize: [34, 34], iconAnchor: [17, 17] });
        if (!vehicleMarker) {
          vehicleMarker = L.marker([d.vehiclePosition.latitude, d.vehiclePosition.longitude], { icon: vIcon, zIndexOffset: 1200 }).addTo(map);
        } else {
          vehicleMarker.setLatLng([d.vehiclePosition.latitude, d.vehiclePosition.longitude]).setIcon(vIcon);
        }
        if (d.followVehicle || !centered) {
          map.setView([d.vehiclePosition.latitude, d.vehiclePosition.longitude], Math.max(map.getZoom(), 16));
          centered = true;
        }
      } else {
        if (vehicleMarker) { map.removeLayer(vehicleMarker); vehicleMarker = null; }
      }

      // 3. Phone / GCS Location Marker (ANITECH A Logo)
      if (d.phonePosition && d.phonePosition.latitude != null && d.phonePosition.longitude != null) {
        const pHtml = '<div class="phone-marker"><img src="' + PHONE_LOGO_URI + '" class="phone-logo-img" alt="GCS" /></div>';
        const pIcon = L.divIcon({ className: '', html: pHtml, iconSize: [32, 32], iconAnchor: [16, 16] });
        if (!phoneMarker) {
          phoneMarker = L.marker([d.phonePosition.latitude, d.phonePosition.longitude], { icon: pIcon, zIndexOffset: 900 }).addTo(map);
        } else {
          phoneMarker.setLatLng([d.phonePosition.latitude, d.phonePosition.longitude]).setIcon(pIcon);
        }
        if (phoneAccuracyCircle) { map.removeLayer(phoneAccuracyCircle); phoneAccuracyCircle = null; }
        if (d.phonePosition.accuracy && d.phonePosition.accuracy > 0) {
          phoneAccuracyCircle = L.circle([d.phonePosition.latitude, d.phonePosition.longitude], {
            radius: d.phonePosition.accuracy,
            color: '#2F80ED',
            weight: 1.5,
            fillColor: '#2F80ED',
            fillOpacity: 0.1
          }).addTo(map);
        }
        if (!centered && (!d.vehiclePosition || d.vehiclePosition.latitude == null)) {
          map.setView([d.phonePosition.latitude, d.phonePosition.longitude], Math.max(map.getZoom(), 16));
          centered = true;
        }
      } else {
        if (phoneMarker) { map.removeLayer(phoneMarker); phoneMarker = null; }
        if (phoneAccuracyCircle) { map.removeLayer(phoneAccuracyCircle); phoneAccuracyCircle = null; }
      }

      // 4. Official Home Position Marker
      if (d.homePosition && d.homePosition.latitude != null && d.homePosition.longitude != null && (d.homePosition.latitude !== 0 || d.homePosition.longitude !== 0)) {
        const hHtml = '<div class="home-marker"><div class="home-badge">⌂</div><div class="home-tag">HOME</div></div>';
        const hIcon = L.divIcon({ className: '', html: hHtml, iconSize: [34, 46], iconAnchor: [17, 13] });
        if (!homeMarker) {
          homeMarker = L.marker([d.homePosition.latitude, d.homePosition.longitude], { icon: hIcon, zIndexOffset: 1100 }).addTo(map);
        } else {
          homeMarker.setLatLng([d.homePosition.latitude, d.homePosition.longitude]).setIcon(hIcon);
        }
      } else {
        if (homeMarker) { map.removeLayer(homeMarker); homeMarker = null; }
      }

      // 5. Preview Home Position Marker (during Set Home on Map)
      if (d.previewHomePosition && d.previewHomePosition.latitude != null && d.previewHomePosition.longitude != null) {
        const phHtml = '<div class="preview-home-marker"><div class="preview-home-badge">⌂</div><div class="preview-home-tag">NEW HOME</div></div>';
        const phIcon = L.divIcon({ className: '', html: phHtml, iconSize: [36, 48], iconAnchor: [18, 13] });
        if (!previewHomeMarker) {
          previewHomeMarker = L.marker([d.previewHomePosition.latitude, d.previewHomePosition.longitude], { icon: phIcon, zIndexOffset: 1500 }).addTo(map);
        } else {
          previewHomeMarker.setLatLng([d.previewHomePosition.latitude, d.previewHomePosition.longitude]).setIcon(phIcon);
        }
      } else {
        if (previewHomeMarker) { map.removeLayer(previewHomeMarker); previewHomeMarker = null; }
      }

      // 6. Fit Bounds Requests
      if (d.fitRequest !== lastFit) {
        lastFit = d.fitRequest;
        if (pts.length > 1) {
          map.fitBounds(pts, { padding: [40, 40] });
        } else if (pts.length === 1) {
          map.setView(pts[0], 16);
        }
      }

      // 7. Center Home Request
      if (d.centerHomeRequest !== lastCenterHome && d.homePosition && d.homePosition.latitude != null) {
        lastCenterHome = d.centerHomeRequest;
        map.setView([d.homePosition.latitude, d.homePosition.longitude], Math.max(map.getZoom(), 17));
      }
    }

    document.addEventListener('message', e => update(e.data));
    window.addEventListener('message', e => update(e.data));
    send({ type: 'ready' });
  </script>
</body>
</html>`;

export function OpenStreetMap(props: Props) {
  const webRef = React.useRef<WebView>(null);
  const [ready, setReady] = React.useState(false);

  const payload = JSON.stringify({
    vehiclePosition: props.vehiclePosition ?? null,
    phonePosition: props.phonePosition ?? null,
    homePosition: props.homePosition ?? null,
    previewHomePosition: props.previewHomePosition ?? null,
    yaw: props.yaw ?? null,
    waypoints: props.waypoints,
    selectedWaypointId: props.selectedWaypointId ?? null,
    followVehicle: props.followVehicle ?? false,
    editable: props.editable ?? false,
    fitRequest: props.fitRequest ?? 0,
    centerHomeRequest: props.centerHomeRequest ?? 0,
  });

  React.useEffect(() => {
    if (ready && (props.active ?? true)) webRef.current?.postMessage(payload);
  }, [payload, props.active, ready]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(event.nativeEvent.data);
      if (m.type === 'ready') setReady(true);
      else if (m.type === 'mapPress') props.onMapPress?.({ latitude: m.latitude, longitude: m.longitude });
      else if (m.type === 'waypointPress') props.onWaypointPress?.(m.id);
      else if (m.type === 'waypointMove') props.onWaypointMove?.(m.id, { latitude: m.latitude, longitude: m.longitude });
    } catch (error) {
      console.warn('[Map] Invalid message', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        style={styles.webview}
        source={{ html: MAP_HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
      />
      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111F' },
  webview: { flex: 1, backgroundColor: '#07111F' },
  loading: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#07111F',
  },
  loadingText: { color: '#B8C7D8', fontSize: 10, fontWeight: '700' },
});
