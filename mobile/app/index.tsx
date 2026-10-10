import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as IntentLauncher from 'expo-intent-launcher';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { AudioLines, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronRight, Hand, LockKeyhole, Mic, MicOff, MoveRight, Radio, ShieldCheck, Sparkles } from 'lucide-react-native';

const NativeAccessibility = NativeModules.BrainbightAccessibility as { isEnabled(): Promise<boolean>; goBack(): Promise<boolean>; scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<boolean> } | undefined;
const GestureService = process.env.EXPO_PUBLIC_GESTURE_API_URL || 'http://10.0.2.2:8000';

type Reply = { id: number; from: 'you' | 'system'; text: string };
type Example = { label: string; action: 'back' | 'open' | 'scroll_up' | 'scroll_down' | 'swipe_left' | 'swipe_right'; app?: string };
const examples: Example[] = [
  { label: 'Open YouTube', action: 'open', app: 'YouTube' }, { label: 'Go back', action: 'back' },
  { label: 'Scroll down', action: 'scroll_down' }, { label: 'Scroll up', action: 'scroll_up' },
];
let replyId = 2;

export default function Home() {
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [listening, setListening] = useState(false);
  const [serviceReady, setServiceReady] = useState(false);
  const [reply, setReply] = useState<Reply[]>([{ id: 0, from: 'system', text: "Hello. I’m here when you need me." }, { id: 1, from: 'you', text: 'Open YouTube' }, { id: 2, from: 'system', text: 'Tap a command below to try your first one.' }]);
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript;
    if (text && event.isFinal) runCommand(text);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (event) => { setListening(false); Alert.alert('Couldn’t hear that', event.message || 'Please try speaking again.'); });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const checkService = async () => { try { setServiceReady(await NativeAccessibility?.isEnabled() ?? false); } catch { setServiceReady(false); } };
    void checkService();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void checkService(); });
    return () => subscription.remove();
  }, []);

  const runCommand = useCallback(async (text: string, chosenAction?: Example['action'], selectedApp?: string) => {
    const action = chosenAction || (/\b(back|previous|go back)\b/i.test(text) ? 'back' : /\b(scroll\s*down)\b/i.test(text) ? 'scroll_down' : /\b(scroll\s*up)\b/i.test(text) ? 'scroll_up' : /\bswipe\s*left\b/i.test(text) ? 'swipe_left' : /\bswipe\s*right\b/i.test(text) ? 'swipe_right' : /\b(open|launch|start)\b/i.test(text) ? 'open' : undefined);
    setReply(prev => [...prev.slice(-7), { id: ++replyId, from: 'you', text }, { id: ++replyId, from: 'system', text: action ? responseFor(action, selectedApp || extractApp(text)) : 'I didn’t catch that action. Try “go back”, “scroll down”, or “open YouTube”.' }]);
    if (!action) return;
    if (action === 'open') { await launchApp(selectedApp || extractApp(text)); return; }
    if (!serviceReady || !NativeAccessibility) { Alert.alert('Turn on accessibility controls', 'Allow the Brainbight accessibility service in Android Settings to use Back and scroll controls.', [{ text: 'Later', style: 'cancel' }, { text: 'Open settings', onPress: openAccessibilitySettings }]); return; }
    if (action === 'back') { if (!await NativeAccessibility.goBack()) Alert.alert('Can’t go back', 'Android did not accept the Back action. Make sure Brainbight gesture controls are enabled.'); }
    else if (action === 'scroll_down' || action === 'scroll_up' || action === 'swipe_left' || action === 'swipe_right') {
      const direction = action === 'scroll_down' ? 'down' : action === 'scroll_up' ? 'up' : action === 'swipe_left' ? 'left' : 'right';
      const completed = await NativeAccessibility.scroll(direction);
      if (!completed) Alert.alert('No scrollable page', 'The current screen does not have a page that can scroll.');
    }
  }, [serviceReady]);

  const listen = async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) { Alert.alert('Microphone permission', 'Allow speech recognition to use voice commands. You can also try the example commands without granting access.'); return; }
      setListening(true);
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: false });
    } catch { setListening(false); Alert.alert('Voice recognition unavailable', 'Use an Android development build with speech recognition support.'); }
  };

  const openCamera = async () => {
    if (!camPermission?.granted) {
      const permission = await requestCamPermission();
      if (!permission.granted) { Alert.alert('Camera permission', 'Allow the camera only when you want to try the hand gesture preview. The feed stays on your device.'); return; }
    }
    setCameraOn(value => !value);
  };

  const analyzeGesture = async () => {
    if (!cameraRef.current || analyzing) return;
    setAnalyzing(true);
    try {
      const frame = await cameraRef.current.takePictureAsync({ quality: 0.55, skipProcessing: true });
      if (!frame?.uri) throw new Error('Could not capture a camera frame.');
      const form = new FormData();
      form.append('image', { uri: frame.uri, type: 'image/jpeg', name: 'hand.jpg' } as unknown as Blob);
      const response = await fetch(`${GestureService.replace(/\/$/, '')}/analyze`, { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'The gesture service could not analyze this image.');
      if (!result.detected || !result.gesture || result.gesture === 'none') { Alert.alert('No gesture detected', 'Try an open palm or pointing gesture in good light.'); return; }
      const gesture = String(result.gesture);
      const action = (gesture === 'go_back' ? 'back' : gesture) as Example['action'];
      await runCommand(`Detected gesture: ${gesture.replace(/_/g, ' ')}`, action);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach your local gesture service.';
      Alert.alert('Gesture analysis unavailable', `${message}\n\nSet EXPO_PUBLIC_GESTURE_API_URL to your local Python service address and configure a MediaPipe model.`);
    } finally { setAnalyzing(false); }
  };

  const openAccessibilitySettings = async () => {
    try { await Linking.sendIntent('android.settings.ACCESSIBILITY_SETTINGS'); }
    catch { try { await IntentLauncher.startActivityAsync('android.settings.ACCESSIBILITY_SETTINGS'); } catch { Alert.alert('Accessibility settings', 'Open Android Settings → Accessibility → Installed apps → Brainbight gesture controls.'); } }
  };

  const launchApp = async (app: string) => {
    if (Platform.OS !== 'android') { Alert.alert(`${app} on your phone`, 'Install Brainbight on Android to open other apps.'); return; }
    const packages: Record<string, string> = { youtube: 'com.google.android.youtube', maps: 'com.google.android.apps.maps', camera: 'com.android.camera' };
    const packageName = packages[app.toLowerCase()];
    if (packageName) {
      try { await IntentLauncher.startActivityAsync('android.intent.action.MAIN', { category: 'android.intent.category.LAUNCHER', packageName }); return; }
      catch { if (app.toLowerCase() === 'youtube') { await Linking.openURL('https://www.youtube.com'); return; } }
    }
    Alert.alert(`${app} isn’t available`, 'That app may not be installed. Try YouTube, Maps, or Camera.');
  };

  const toggleService = async () => {
    if (serviceReady) { Alert.alert('Manage accessibility controls', 'To switch this service off, open Android Accessibility settings and turn Brainbight gesture controls off.'); return; }
    Alert.alert('Enable controls in Android', 'Open Android Accessibility settings, find Brainbight gesture controls, and switch the service on. Android will ask you to review and approve the permissions.', [{ text: 'Later', style: 'cancel' }, { text: 'Open settings', onPress: openAccessibilitySettings }]);
  };

  return <ScrollView style={styles.root} contentContainerStyle={styles.page}>
    <View style={styles.header}><View style={styles.brand}><View style={styles.brandIcon}><Sparkles size={17} color="#fff"/></View><Text style={styles.brandText}>brainbight<Text style={styles.brandDot}>.</Text></Text></View><View style={[styles.systemChip, serviceReady && styles.enabledChip]}><Radio size={12} color={serviceReady ? '#54826a' : '#a1aa9e'}/><Text style={[styles.systemText, serviceReady && styles.enabledText]}>{serviceReady ? 'READY' : 'YOUR PHONE, YOUR CALL'}</Text></View></View>
    <View style={styles.hero}><View style={styles.eyebrow}><View style={styles.liveDot}/><Text style={styles.eyebrowText}>A LITTLE MORE FREEDOM</Text></View><Text style={styles.title}>Move through your{ '\n'}<Text style={styles.titleAccent}>own way.</Text></Text><Text style={styles.subtitle}>Say the word, make a little move.{ '\n'}You’re the one in control.</Text><View style={styles.heroBadges}><View style={styles.badge}><ShieldCheck size={13} color="#60836b"/><Text style={styles.badgeText}>Always your choice</Text></View><View style={styles.badge}><LockKeyhole size={12} color="#80759b"/><Text style={styles.badgeText}>Nothing starts without you</Text></View></View></View>
    <View style={styles.controlCard}><View style={styles.sectionHead}><View><Text style={styles.sectionEyebrow}>YOUR COMPANION</Text><Text style={styles.cardTitle}>Ready when you are.</Text></View><View style={styles.agent}><View style={styles.agentIcon}><AudioLines size={16} color="#fff"/></View><View><Text style={styles.agentName}>Brainbight</Text><Text style={styles.agentStatus}>{listening ? 'Listening to your command' : 'Here when you need me'}</Text></View></View></View><View style={styles.chat}><ScrollView nestedScrollEnabled style={styles.chatScroll} showsVerticalScrollIndicator>{reply.slice(-4).map(line => <View key={line.id} style={[styles.chatLine, line.from === 'you' && styles.chatLineYou]}><View style={[styles.chatIcon, line.from === 'you' && styles.chatIconYou]}>{line.from === 'you' ? <Hand size={12} color="#718d7b"/> : <Sparkles size={12} color="#fff"/>}</View><Text style={[styles.chatText, line.from === 'you' && styles.chatTextYou]}>{line.text}</Text></View>)}</ScrollView></View><View style={styles.commandArea}><Text style={styles.smallLabel}>SAY IT OR TRY A COMMAND</Text><View style={styles.chips}>{examples.map(example => <Pressable key={example.label} style={styles.commandChip} onPress={() => runCommand(example.label, example.action, example.app)}><Text style={styles.commandChipText}>{example.label}</Text><MoveRight size={11} color="#86a08e"/></Pressable>)}</View><Pressable accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Speak a voice command'} onPress={listening ? () => { ExpoSpeechRecognitionModule.stop(); setListening(false); } : listen} style={[styles.micButton, listening && styles.micActive]}>{listening ? <MicOff size={18} color="#fff"/> : <Mic size={18} color="#fff"/>}<Text style={styles.micText}>{listening ? 'Listening… tap to stop' : 'Try a voice command'}</Text><View style={styles.micArrow}><ChevronRight size={15} color="#fff"/></View></Pressable><Text style={styles.permissionNote}><LockKeyhole size={11} color="#9da89c"/> Microphone access is asked for only when you tap.</Text></View></View>
    <View style={styles.cameraCard}><View style={styles.cameraCopy}><View style={styles.cameraBadge}><Hand size={15} color="#a37c5b"/><Text style={styles.cameraEyebrow}>A LITTLE WAVE</Text></View><Text style={styles.cameraTitle}>Gesture your way.</Text><Text style={styles.cameraDescription}>Show a hand gesture and tap to analyze a camera frame.</Text><Pressable style={styles.cameraButton} onPress={cameraOn ? analyzeGesture : openCamera}><Camera size={14} color="#516c58"/><Text style={styles.cameraButtonText}>{cameraOn ? analyzing ? 'Reading your gesture…' : 'Analyze this frame' : 'Try the camera preview'}</Text></Pressable>{cameraOn && <Pressable style={styles.turnOffButton} onPress={() => setCameraOn(false)}><Text style={styles.turnOffText}>Turn off camera</Text></Pressable>}<Text style={styles.privacyNote}><LockKeyhole size={10} color="#979e90"/> Frame sent only to your local service.</Text></View>{cameraOn && camPermission?.granted ? <View style={styles.previewWrap}><CameraView ref={cameraRef} facing="front" style={styles.preview}><View style={styles.previewOverlay}><View style={styles.scanLine}/><Hand size={28} color="#fff"/><Text style={styles.previewLabel}>Make your gesture</Text></View></CameraView></View> : <View style={styles.gestureArt}><View style={styles.orbitRing}/><View style={styles.gestureCircle}><Hand size={38} color="#b1825b" strokeWidth={1.4}/></View><View style={styles.arrowUp}><ArrowUp size={15} color="#87a38d"/></View><View style={styles.arrowLeft}><ArrowLeft size={14} color="#bd9774"/></View><View style={styles.sparkleOne}>✳</View><View style={styles.sparkleTwo}>✳</View></View>}</View>
    <View style={styles.permissionCard}><View style={styles.permissionIcon}><ShieldCheck size={21} color="#64816a"/></View><View style={styles.permissionCopy}><Text style={styles.permissionTitle}>You choose what gets enabled.</Text><Text style={styles.permissionDescription}>Android asks for permission before a control can run.</Text><Text style={styles.accessibilityLabel}><ActivityMark/> ACCESSIBILITY CONTROLS</Text></View><Pressable onPress={toggleService} style={[styles.enableButton, serviceReady && styles.enabledButton]}><Text style={styles.enableText}>{serviceReady ? 'Manage' : 'Enable'}</Text><ChevronRight size={13} color="#5f795f"/></Pressable></View>
    <View style={styles.actionGrid}><Pressable onPress={openAccessibilitySettings} style={styles.actionTile}><View style={styles.actionIcon}><ShieldCheck size={16} color="#65826b"/></View><View><Text style={styles.actionLabel}>Accessibility</Text><Text style={styles.actionHint}>{serviceReady ? 'Manage access' : 'Set up phone controls'}</Text></View><ChevronRight size={14} color="#a0aa9f"/></Pressable><Pressable onPress={openCamera} style={styles.actionTile}><View style={[styles.actionIcon, styles.actionCamera]}><Camera size={16} color="#a27c58"/></View><View><Text style={styles.actionLabel}>Camera</Text><Text style={styles.actionHint}>{cameraOn ? 'Preview is on' : 'You decide when'}</Text></View><ChevronRight size={14} color="#a0aa9f"/></Pressable></View>
    <Text style={styles.footer}><Sparkles size={12} color="#b88664"/> A little more freedom, every day.</Text>
  </ScrollView>;
}

function ActivityMark() { return <View style={styles.activityIcon}/>; }
function extractApp(text: string) { const match = text.match(/\b(?:open|launch|start)\s+(.+)/i); return match?.[1]?.replace(/[.!?]$/, '').trim() || 'app'; }
function responseFor(action: Example['action'], app: string) { if (action === 'open') return `I’ll look for ${app} on your phone.`; if (action === 'back') return 'I heard “go back”. Android lets you approve this system control first.'; if (action === 'scroll_down') return 'I heard “scroll down”. Swipe up to move the page down.'; if (action === 'scroll_up') return 'I heard “scroll up”. Swipe down to move the page up.'; if (action === 'swipe_left') return 'I heard “swipe left”.'; return 'I heard “swipe right”.'; }

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#f8faf5'},page:{paddingHorizontal:21,paddingTop:53,paddingBottom:33},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:37},brand:{flexDirection:'row',alignItems:'center',gap:8},brandIcon:{height:29,width:29,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#315c52'},brandText:{fontSize:20,fontWeight:'700',color:'#25362e'},brandDot:{color:'#d19a6f'},systemChip:{flexDirection:'row',gap:7,alignItems:'center',borderWidth:1,borderColor:'#e8ece5',paddingHorizontal:9,paddingVertical:7,borderRadius:18,backgroundColor:'#fff'},systemText:{fontSize:7,fontWeight:'700',color:'#919b91'},enabledChip:{backgroundColor:'#eff5ef'},enabledText:{color:'#527458'},hero:{marginBottom:22},eyebrow:{flexDirection:'row',alignItems:'center',gap:8},liveDot:{width:6,height:6,borderRadius:5,backgroundColor:'#82a88d'},eyebrowText:{fontSize:8,fontWeight:'700',color:'#87978c'},title:{color:'#29382f',fontSize:48,lineHeight:52,fontWeight:'700',marginTop:14},titleAccent:{color:'#45715b',fontFamily:'Georgia',fontStyle:'italic',fontWeight:'400'},subtitle:{color:'#7f8a81',fontSize:12,lineHeight:20,marginTop:11},heroBadges:{flexDirection:'row',gap:15,marginTop:15},badge:{flexDirection:'row',gap:5,alignItems:'center'},badgeText:{fontSize:8,color:'#879087'},controlCard:{backgroundColor:'#fff',borderColor:'#ebeee7',borderWidth:1,borderRadius:13,overflow:'hidden',marginBottom:12},sectionHead:{paddingHorizontal:16,paddingTop:17,paddingBottom:14},sectionEyebrow:{fontSize:7,fontWeight:'700',color:'#97a297'},cardTitle:{fontSize:18,fontWeight:'700',color:'#2c3a32',marginTop:5},agent:{position:'absolute',right:14,top:16,flexDirection:'row',gap:7,alignItems:'center'},agentIcon:{width:27,height:27,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#315c52'},agentName:{fontSize:8,fontWeight:'700',color:'#506054'},agentStatus:{marginTop:3,color:'#98a197',fontSize:7},chat:{marginHorizontal:13,padding:9,borderRadius:9,backgroundColor:'#f7f9f5',minHeight:116,maxHeight:147},chatScroll:{flex:1},chatLine:{flexDirection:'row',alignItems:'flex-start',gap:7,marginBottom:7},chatLineYou:{flexDirection:'row-reverse'},chatIcon:{width:19,height:19,borderRadius:7,backgroundColor:'#315c52',alignItems:'center',justifyContent:'center'},chatIconYou:{backgroundColor:'#e5eee4'},chatText:{backgroundColor:'#eef3ec',color:'#61746a',fontSize:9,lineHeight:14,paddingVertical:5,paddingHorizontal:8,borderRadius:8,maxWidth:'83%'},chatTextYou:{color:'#68806e',backgroundColor:'#e3ede3'},commandArea:{paddingHorizontal:13,paddingTop:14,paddingBottom:11},smallLabel:{color:'#9ba49a',fontSize:7,fontWeight:'700'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8,marginBottom:11},commandChip:{flexDirection:'row',gap:7,alignItems:'center',borderWidth:1,borderColor:'#e8ede6',backgroundColor:'#fff',paddingVertical:7,paddingHorizontal:8,borderRadius:16},commandChipText:{fontSize:8,color:'#657469'},micButton:{height:41,borderRadius:8,backgroundColor:'#315c52',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},micActive:{backgroundColor:'#a16254'},micText:{color:'#fff',fontSize:9,fontWeight:'600',flex:1},micArrow:{width:23,height:23,borderRadius:7,backgroundColor:'#426e63',alignItems:'center',justifyContent:'center'},permissionNote:{marginTop:8,fontSize:7,color:'#98a197'},cameraCard:{minHeight:160,backgroundColor:'#f4f1ea',borderColor:'#eee9e0',borderWidth:1,borderRadius:12,marginBottom:12,flexDirection:'row',overflow:'hidden'},cameraCopy:{padding:14,flex:1.15},cameraBadge:{flexDirection:'row',alignItems:'center',gap:6},cameraEyebrow:{color:'#a48568',fontSize:7,fontWeight:'700'},cameraTitle:{color:'#303c34',fontSize:15,fontWeight:'700',marginTop:9},cameraDescription:{color:'#8b9085',fontSize:8,lineHeight:13,marginTop:4,maxWidth:195},cameraButton:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:8,paddingHorizontal:9,backgroundColor:'#fff',borderWidth:1,borderColor:'#ebe7de',borderRadius:6,alignSelf:'flex-start',marginTop:9},cameraButtonText:{color:'#657564',fontSize:7,fontWeight:'600'},turnOffButton:{alignSelf:'flex-start',paddingVertical:5},turnOffText:{color:'#858b7d',fontSize:7},privacyNote:{color:'#999b90',fontSize:7,marginTop:7},gestureArt:{flex:0.82,alignItems:'center',justifyContent:'center',position:'relative'},orbitRing:{position:'absolute',width:110,height:124,borderWidth:1,borderColor:'#e8dfce',borderRadius:60,transform:[{rotate:'27deg'}]},gestureCircle:{height:76,width:76,backgroundColor:'#eee6d8',borderRadius:40,alignItems:'center',justifyContent:'center'},arrowUp:{position:'absolute',top:20,right:23},arrowLeft:{position:'absolute',left:8,bottom:40},sparkleOne:{position:'absolute',right:17,top:24,fontSize:15,color:'#d1a77b'},sparkleTwo:{position:'absolute',bottom:23,right:21,fontSize:12,color:'#8fa58e'},previewWrap:{flex:0.9,minHeight:150,margin:8,borderRadius:8,overflow:'hidden',backgroundColor:'#d3d9ca'},preview:{flex:1},previewOverlay:{flex:1,backgroundColor:'#26352d38',alignItems:'center',justifyContent:'center',gap:5},scanLine:{position:'absolute',top:'48%',left:'15%',right:'15%',height:1,backgroundColor:'#fff'},previewLabel:{color:'#fff',fontSize:7,fontWeight:'600'},permissionCard:{flexDirection:'row',alignItems:'center',gap:9,padding:12,backgroundColor:'#eef3ec',borderWidth:1,borderColor:'#e5ebe2',borderRadius:10,marginBottom:10},permissionIcon:{width:32,height:32,backgroundColor:'#e1eade',borderRadius:9,alignItems:'center',justifyContent:'center'},permissionCopy:{flex:1},permissionTitle:{fontSize:9,fontWeight:'700',color:'#485e4b'},permissionDescription:{color:'#889486',fontSize:7,marginTop:3},accessibilityLabel:{color:'#8c9b8a',fontSize:6,fontWeight:'700',marginTop:7},activityIcon:{width:6,height:6,borderRadius:3,marginRight:3,backgroundColor:'#8ba28a'},enableButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingHorizontal:9,paddingVertical:7,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e9e0',borderRadius:6},enabledButton:{backgroundColor:'#e2ede2'},enableText:{color:'#5b785e',fontSize:8,fontWeight:'600'},actionGrid:{flexDirection:'row',gap:9},actionTile:{flex:1,flexDirection:'row',alignItems:'center',gap:7,padding:9,backgroundColor:'#fff',borderWidth:1,borderColor:'#ebeee8',borderRadius:8},actionIcon:{height:26,width:26,borderRadius:7,backgroundColor:'#eef3ed',alignItems:'center',justifyContent:'center'},actionCamera:{backgroundColor:'#f7f0e8'},actionLabel:{color:'#536257',fontSize:8,fontWeight:'600'},actionHint:{color:'#98a197',fontSize:6,marginTop:3},footer:{marginTop:22,textAlign:'center',color:'#939d93',fontSize:8},
});

