import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { 
  selectWaypoints, 
  selectSyncStatus, 
  selectSyncProgress, 
  clearMission, 
  uploadMission 
} from '../../store/mission/missionSlice';

export function MissionControls() {
  const dispatch = useAppDispatch();
  const waypoints = useAppSelector(selectWaypoints);
  const syncStatus = useAppSelector(selectSyncStatus);
  const syncProgress = useAppSelector(selectSyncProgress);

  const handleUpload = () => {
    if (waypoints.length === 0) return;
    dispatch(uploadMission());
  };

  const handleClear = () => {
    dispatch(clearMission());
  };

  const handleStartMission = () => {
    import('../../services/command/SafetyLayer').then(({ safetyLayer }) => {
      import('../../types/command').then(({ FlightMode }) => {
        safetyLayer.executeCommand({ type: 'SET_MODE', payload: { mode: FlightMode.AUTO } });
      });
    });
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      
      {/* Progress Bar */}
      {syncStatus === 'SYNCING' && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>UPLOADING MISSION... {syncProgress.toFixed(0)}%</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${syncProgress}%` }]} />
          </View>
        </View>
      )}

      {/* Button Row */}
      <View style={styles.buttonRow}>
        
        {/* CLEAR */}
        <TouchableOpacity 
          style={[styles.btn, styles.clearBtn]} 
          onPress={handleClear}
          disabled={syncStatus === 'SYNCING'}
        >
          <Text style={styles.btnText}>CLEAR</Text>
        </TouchableOpacity>

        {/* UPLOAD */}
        <TouchableOpacity 
          style={[
            styles.btn, 
            styles.uploadBtn, 
            (syncStatus === 'SYNCING' || waypoints.length === 0) && styles.btnDisabled,
            syncStatus === 'SYNCED' && styles.syncedBtn
          ]} 
          onPress={handleUpload}
          disabled={syncStatus === 'SYNCING' || waypoints.length === 0}
        >
          <Text style={styles.btnText}>
            {syncStatus === 'SYNCED' ? 'UPLOADED' : 'UPLOAD TO DRONE'}
          </Text>
        </TouchableOpacity>

        {/* START MISSION */}
        <TouchableOpacity 
          style={[
            styles.btn, 
            styles.startBtn, 
            syncStatus !== 'SYNCED' && styles.btnDisabled
          ]} 
          onPress={handleStartMission}
          disabled={syncStatus !== 'SYNCED'}
        >
          <Text style={styles.btnText}>START MISSION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 50,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  progressText: {
    color: '#00ddff',
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00ddff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.9)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 4,
    marginHorizontal: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  clearBtn: {
    backgroundColor: '#444',
  },
  uploadBtn: {
    backgroundColor: '#ffaa00',
  },
  syncedBtn: {
    backgroundColor: '#00aa00',
  },
  startBtn: {
    backgroundColor: '#00ddff',
  },
});
