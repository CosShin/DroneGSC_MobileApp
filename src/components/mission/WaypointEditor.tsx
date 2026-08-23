import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectSelectedWaypoint, updateWaypoint, deleteWaypoint, selectWaypoint } from '../../store/mission/missionSlice';

export function WaypointEditor() {
  const dispatch = useAppDispatch();
  const waypoint = useAppSelector(selectSelectedWaypoint);

  if (!waypoint) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WAYPOINT EDITOR</Text>
        <TouchableOpacity onPress={() => dispatch(selectWaypoint(null))}>
          <Text style={styles.closeBtn}>X</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Altitude (m)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={waypoint.alt.toString()}
          onChangeText={(text) => {
            const val = parseFloat(text);
            if (!isNaN(val)) dispatch(updateWaypoint({ id: waypoint.id, changes: { alt: val } }));
          }}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Speed (m/s)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={waypoint.speed.toString()}
          onChangeText={(text) => {
            const val = parseFloat(text);
            if (!isNaN(val)) dispatch(updateWaypoint({ id: waypoint.id, changes: { speed: val } }));
          }}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Delay (s)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={waypoint.delay.toString()}
          onChangeText={(text) => {
            const val = parseFloat(text);
            if (!isNaN(val)) dispatch(updateWaypoint({ id: waypoint.id, changes: { delay: val } }));
          }}
        />
      </View>

      <TouchableOpacity 
        style={styles.deleteBtn}
        onPress={() => dispatch(deleteWaypoint(waypoint.id))}
      >
        <Text style={styles.deleteBtnText}>DELETE WAYPOINT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    top: 60,
    width: 250,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    padding: 15,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 5,
  },
  title: {
    color: '#00ddff',
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    width: 80,
    height: 30,
    borderRadius: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  deleteBtn: {
    backgroundColor: '#ff4444',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
