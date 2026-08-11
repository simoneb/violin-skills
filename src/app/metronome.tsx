import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useKeepAwake } from 'expo-keep-awake';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Subdivision } from '@/audio/metronome';
import { BeatDot } from '@/components/beat-dot';
import { PressableScale } from '@/components/pressable-scale';
import { ChipRow } from '@/components/chip-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_BPM, MIN_BPM, useMetronome } from '@/state/metronome';

const TIME_SIGNATURES = [2, 3, 4, 6].map((n) => ({ value: n, label: `${n}/4` }));
const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: 1, label: '♩' },
  { value: 2, label: '♪♪' },
  { value: 3, label: '3' },
  { value: 4, label: '♬♬' },
];

function tempoMarking(bpm: number): string {
  if (bpm < 55) return 'Largo';
  if (bpm < 70) return 'Adagio';
  if (bpm < 90) return 'Andante';
  if (bpm < 110) return 'Moderato';
  if (bpm < 135) return 'Allegro';
  if (bpm < 170) return 'Vivace';
  return 'Presto';
}

export default function MetronomeScreen() {
  useKeepAwake();
  const theme = useTheme();
  const {
    playing, bpm, beatsPerBar, subdivision, currentBeat,
    toggle, setBpm, setBeatsPerBar, setSubdivision, tap,
  } = useMetronome();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Metronome</ThemedText>

        {/* BPM display */}
        <View style={styles.bpmDisplay}>
          <ThemedText style={styles.bpmValue}>{bpm}</ThemedText>
          <ThemedText themeColor="textSecondary">
            BPM · {tempoMarking(bpm)}
          </ThemedText>
        </View>

        {/* Beat indicator */}
        <View style={styles.beatRow}>
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <BeatDot
              key={i}
              active={playing && i === currentBeat}
              color={i === 0 ? theme.tint : theme.text}
              idleColor={theme.backgroundSelected}
            />
          ))}
        </View>

        {/* BPM controls */}
        <View style={styles.bpmControls}>
          <PressableScale
            onPress={() => setBpm(bpm - 1)}
            pressedScale={0.88}
            style={{ ...styles.stepButton, backgroundColor: theme.backgroundElement, borderColor: theme.border }}>
            <MaterialCommunityIcons name="minus" size={24} color={theme.text} />
          </PressableScale>
          <Slider
            style={styles.slider}
            minimumValue={MIN_BPM}
            maximumValue={MAX_BPM}
            step={1}
            value={bpm}
            onValueChange={setBpm}
            minimumTrackTintColor={theme.tint}
            maximumTrackTintColor={theme.backgroundSelected}
            thumbTintColor={theme.tint}
          />
          <PressableScale
            onPress={() => setBpm(bpm + 1)}
            pressedScale={0.88}
            style={{ ...styles.stepButton, backgroundColor: theme.backgroundElement, borderColor: theme.border }}>
            <MaterialCommunityIcons name="plus" size={24} color={theme.text} />
          </PressableScale>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            TIME SIGNATURE
          </ThemedText>
          <ChipRow options={TIME_SIGNATURES} selected={beatsPerBar} onSelect={setBeatsPerBar} />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            SUBDIVISION
          </ThemedText>
          <ChipRow options={SUBDIVISIONS} selected={subdivision} onSelect={setSubdivision} />
        </View>

        <View style={styles.spacer} />

        {/* Tap tempo + play */}
        <View style={styles.bottomRow}>
          <PressableScale
            onPress={tap}
            pressedScale={0.88}
            style={{ ...styles.tapButton, backgroundColor: theme.backgroundElement, borderColor: theme.border }}>
            <ThemedText type="smallBold">TAP</ThemedText>
          </PressableScale>
          <PressableScale
            onPress={toggle}
            pressedScale={0.92}
            style={{ ...styles.playButton, backgroundColor: playing ? theme.error : theme.tint }}>
            <MaterialCommunityIcons
              name={playing ? 'stop' : 'play'}
              size={40}
              color={theme.background}
            />
          </PressableScale>
          {/* symmetric spacer so the play button stays centered */}
          <View style={styles.bottomSpacer} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  bpmDisplay: {
    alignItems: 'center',
  },
  bpmValue: {
    fontSize: 88,
    lineHeight: 96,
    fontWeight: '700',
  },
  beatRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  bpmControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slider: {
    flex: 1,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.five,
  },
  tapButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    width: 72,
  },
  playButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
