import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../../theme/gcsTheme';
import { useTruthfulTelemetry } from '../../hooks/useTruthfulTelemetry';
import { useAppSelector } from '../../store/hooks';
import { selectRoll, selectPitch, selectYaw } from '../../store/telemetry/telemetrySlice';

export function ModernAttitudeHud({ size }: { size: number }) {
  const truth = useTruthfulTelemetry();
  const roll = useAppSelector(selectRoll);
  const pitch = useAppSelector(selectPitch);
  const yaw = useAppSelector(selectYaw);

  if (!truth.connected) return null;
  const heading = ((Math.round(yaw) % 360) + 360) % 360;
  const inner = size - 26;
  const shift = Math.max(-inner * 0.3, Math.min(inner * 0.3, pitch * (inner / 70)));
  return <View style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={[styles.bankScale, { width: size, height: size / 2 }]}><Text style={[styles.bankText,{left:'18%'}]}>30</Text><Text style={[styles.bankText,{left:'48%'}]}>0</Text><Text style={[styles.bankText,{right:'18%'}]}>30</Text><View style={styles.bankPointer}/></View>
    <View style={[styles.instrument, { width: inner, height: inner, borderRadius: inner / 2 }]}>
      <View style={[styles.horizon,{width:inner*2,height:inner*2,left:-inner/2,top:-inner/2,transform:[{rotate:`${-roll}deg`},{translateY:shift}]}]}>
        <View style={styles.sky}/><View style={styles.ground}/><View style={styles.horizonLine}/>
        {[-20,-10,10,20].map(value=><View key={value} style={[styles.pitchRow,{top:inner-value*(inner/80)}]}><Text style={styles.pitchText}>{Math.abs(value)}</Text><View style={[styles.pitchLine,{width:value%20===0?inner*.28:inner*.18}]}/><Text style={styles.pitchText}>{Math.abs(value)}</Text></View>)}
      </View>
      <View style={styles.aircraft}><View style={styles.wing}/><View style={styles.chevron}/><View style={styles.wing}/></View>
    </View>
    <View style={styles.heading}><Text style={styles.headingSide}>{String((heading+345)%360).padStart(3,'0')}</Text><View style={styles.headingDivider}/><Text style={styles.headingValue}>{String(heading).padStart(3,'0')}</Text><View style={styles.headingDivider}/><Text style={styles.headingSide}>{String((heading+15)%360).padStart(3,'0')}</Text></View>
  </View>;
}
const styles=StyleSheet.create({shell:{alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,...shadow.card},instrument:{overflow:'hidden',borderWidth:2,borderColor:'#B8C8DA',backgroundColor:'#D9E9F7'},horizon:{position:'absolute'},sky:{flex:1,backgroundColor:'#58AEF5'},ground:{flex:1,backgroundColor:'#70B80E'},horizonLine:{position:'absolute',left:0,right:0,top:'50%',height:2,backgroundColor:'#FFF'},pitchRow:{position:'absolute',left:0,right:0,height:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},pitchLine:{height:1.5,backgroundColor:'#FFF'},pitchText:{color:'#FFF',fontSize:10,fontWeight:'900',textShadowColor:'#36516D',textShadowRadius:2},aircraft:{position:'absolute',left:'50%',top:'50%',marginLeft:-50,marginTop:-9,width:100,height:18,flexDirection:'row',alignItems:'center',justifyContent:'center'},wing:{width:38,height:4,backgroundColor:'#FFF',borderBottomWidth:2,borderBottomColor:'#F5B700'},chevron:{width:18,height:18,borderLeftWidth:4,borderTopWidth:4,borderColor:'#FFF',transform:[{rotate:'45deg'}],marginHorizontal:2},bankScale:{position:'absolute',top:1,zIndex:3},bankText:{position:'absolute',top:10,color:'#344B68',fontSize:9,fontWeight:'900'},bankPointer:{position:'absolute',top:0,left:'50%',marginLeft:-6,width:0,height:0,borderLeftWidth:6,borderRightWidth:6,borderTopWidth:0,borderBottomWidth:10,borderLeftColor:'transparent',borderRightColor:'transparent',borderBottomColor:'#C7D4E2'},heading:{position:'absolute',bottom:-2,height:42,minWidth:176,paddingHorizontal:14,borderRadius:10,backgroundColor:'#182235',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:11,...shadow.card},headingValue:{color:'#2AA6FF',fontSize:21,fontWeight:'900',fontVariant:['tabular-nums']},headingSide:{color:'#B5C1D0',fontSize:13,fontWeight:'700',fontVariant:['tabular-nums']},headingDivider:{width:1,height:19,backgroundColor:'#657184'}});
