import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import { hydrateSettings, SettingsState } from '../store/settings/settingsSlice';

const KEY = 'anitech-gcs:settings:v1';

function withoutSecrets(settings: SettingsState): SettingsState {
  const safe = { ...settings, video: { ...settings.video } };
  delete safe.video.rtspUsername;
  delete safe.video.rtspPassword;
  return safe;
}

export function SettingsPersistence() {
  React.useEffect(() => { let unsubscribe: (() => void) | undefined; let timer: ReturnType<typeof setTimeout> | undefined; let mounted = true;
    AsyncStorage.getItem(KEY).then(raw => { if (!mounted) return; if (raw) { const loaded = JSON.parse(raw) as Partial<SettingsState>; if (loaded.video) { delete loaded.video.rtspUsername; delete loaded.video.rtspPassword; } store.dispatch(hydrateSettings(loaded)); } let previous = store.getState().settings; unsubscribe = store.subscribe(() => { const next = store.getState().settings; if (next === previous) return; previous = next; if (timer) clearTimeout(timer); timer = setTimeout(() => AsyncStorage.setItem(KEY, JSON.stringify(withoutSecrets(next))).catch(error => console.warn('[Settings persistence]', error)), 250); }); }).catch(error => console.warn('[Settings hydrate]', error));
    return () => { mounted = false; unsubscribe?.(); if (timer) clearTimeout(timer); };
  }, []); return null;
}
