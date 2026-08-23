import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { DroneCommand } from '../../types/command';

interface Props {
  visible: boolean;
  command: DroneCommand | null;
  onConfirm: (command: DroneCommand) => void;
  onCancel: () => void;
}

export function CommandConfirmationModal({ visible, command, onConfirm, onCancel }: Props) {
  const [altitude, setAltitude] = useState('5.0');

  if (!visible || !command) return null;

  const handleConfirm = () => {
    if (command.type === 'TAKEOFF') {
      onConfirm({ type: 'TAKEOFF', payload: { altitude: parseFloat(altitude) || 5.0 } });
    } else {
      onConfirm(command);
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onCancel} 
      />

      <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.title}>CONFIRM FLIGHT COMMAND</Text>
        </View>

        <Text style={styles.commandText}>{command.type}</Text>

        {command.type === 'TAKEOFF' && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Target Altitude (meters):</Text>
            <TextInput
              style={styles.input}
              value={altitude}
              onChangeText={setAltitude}
              keyboardType="numeric"
              selectTextOnFocus
            />
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm} activeOpacity={0.7}>
            <Text style={styles.confirmBtnText}>EXECUTE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    height: 3000,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: 18,
    borderRadius: 8,
    width: 320,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 30,
    zIndex: 10000,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  title: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  commandText: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  confirmButton: {
    backgroundColor: '#0284c7',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  cancelBtnText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
