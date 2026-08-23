import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { selectCommandState } from '../../store/command/commandSlice';
import { selectIsConnected } from '../../store/connection/connectionSlice';
import { selectIsArmed } from '../../store/drone/droneSlice';
import { safetyLayer } from '../../services/command/SafetyLayer';
import { DroneCommand } from '../../types/command';
import { CommandConfirmationModal } from './CommandConfirmationModal';

export function CommandControls() {
  const isConnected = useAppSelector(selectIsConnected);
  const isArmed = useAppSelector(selectIsArmed);
  const { lastCommandStatus, pendingCommand, lastCommandError } = useAppSelector(selectCommandState);
  
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingConfirmCommand, setPendingConfirmCommand] = useState<DroneCommand | null>(null);

  const requestCommand = (command: DroneCommand) => {
    // Dangerous commands need confirmation
    if (command.type === 'DISARM' || command.type === 'LAND' || command.type === 'RTL' || command.type === 'TAKEOFF') {
      setPendingConfirmCommand(command);
      setConfirmModalVisible(true);
    } else {
      executeCommand(command);
    }
  };

  const executeCommand = (command: DroneCommand) => {
    setConfirmModalVisible(false);
    setPendingConfirmCommand(null);
    safetyLayer.executeCommand(command);
  };

  const isPending = pendingCommand !== null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.sectionTitle}>FLIGHT COMMANDS</Text>
      </View>
      
      {lastCommandStatus === 'REJECTED' || lastCommandStatus === 'FAILED' ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {lastCommandStatus}: {lastCommandError}
          </Text>
        </View>
      ) : null}
      
      {isPending ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>EXECUTING: {pendingCommand}...</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity 
          style={[styles.button, styles.armBtn, (!isConnected || isArmed || isPending) && styles.disabledButton]} 
          onPress={() => requestCommand({ type: 'ARM' })}
          disabled={!isConnected || isArmed || isPending}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, { color: '#4ade80' }]}>ARM</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.dangerButton, (!isConnected || !isArmed || isPending) && styles.disabledButton]} 
          onPress={() => requestCommand({ type: 'DISARM' })}
          disabled={!isConnected || !isArmed || isPending}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, { color: '#f87171' }]}>DISARM</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity 
          style={[styles.button, styles.actionBtn, (!isConnected || !isArmed || isPending) && styles.disabledButton]} 
          onPress={() => requestCommand({ type: 'TAKEOFF', payload: { altitude: 2 } })}
          disabled={!isConnected || !isArmed || isPending}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>TAKEOFF</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.actionBtn, (!isConnected || !isArmed || isPending) && styles.disabledButton]} 
          onPress={() => requestCommand({ type: 'LAND' })}
          disabled={!isConnected || !isArmed || isPending}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>LAND</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity 
          style={[styles.button, styles.rtlButton, (!isConnected || isPending) && styles.disabledButton]} 
          onPress={() => requestCommand({ type: 'RTL' })}
          disabled={!isConnected || isPending}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, { color: '#f59e0b' }]}>RTL (RETURN)</Text>
        </TouchableOpacity>
      </View>

      <CommandConfirmationModal 
        visible={confirmModalVisible}
        command={pendingConfirmCommand}
        onConfirm={executeCommand}
        onCancel={() => {
          setConfirmModalVisible(false);
          setPendingConfirmCommand(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
    marginRight: 5,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 3,
  },
  button: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  armBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  actionBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  rtlButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  disabledButton: {
    opacity: 0.3,
  },
  buttonText: {
    color: '#e2e8f0',
    fontWeight: '800',
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  errorText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 9,
    textAlign: 'center',
  },
  pendingBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  pendingText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 9,
    textAlign: 'center',
  }
});
