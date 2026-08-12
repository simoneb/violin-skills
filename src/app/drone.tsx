import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useKeepAwake } from 'expo-keep-awake';
import { StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ScreenHeader } from '@/components/screen-header';

import { ChipRow } from '@/components/chip-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VolumeSlider } from '@/components/volume-slider';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { midiToFrequency, midiToLabel, NOTE_NAMES_SHARP, OPEN_STRINGS, pitchClass } from '@/music/notes';
import { useDrone } from '@/state/drone';
import { useSettings } from '@/state/settings';

const OCTAVES = [2, 3, 4, 5].map((o) => ({ value: o, label: String(o) }));

export default function DroneScreen() {
  useKeepAwake();
  const theme = useTheme();
  const { playing, midi, withFifth, toggle, setMidi, setFifth } = useDrone();
  const a4 = useSettings((s) => s.a4);

  const selectedPitchClass = pitchClass(midi);
  const selectedOctave = Math.floor(midi / 12) - 1;

  const selectNote = (pc: number, octave: number) => {
    setMidi((octave + 1) * 12 + pc);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          icon="sine-wave"
          title="Drone"
          subtitle={`${midiToLabel(midi)} · ${midiToFrequency(midi, a4).toFixed(1)} Hz · A=${a4}`}
        />

        {/* Open-string presets */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            OPEN STRINGS
          </ThemedText>
          <View style={styles.presetRow}>
            {OPEN_STRINGS.map((s) => {
              const active = midi === s.midi;
              return (
                <PressableScale
                  key={s.name}
                  onPress={() => setMidi(s.midi)}
                  style={{
                    ...styles.preset,
                    backgroundColor: active ? theme.tint : theme.backgroundElement,
                    borderColor: active ? theme.tint : theme.border,
                  }}>
                  <ThemedText
                    type="subtitle"
                    style={{ color: active ? theme.background : theme.text }}>
                    {s.name}
                  </ThemedText>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {/* Chromatic note grid */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            NOTE
          </ThemedText>
          {[NOTE_NAMES_SHARP.slice(0, 6), NOTE_NAMES_SHARP.slice(6)].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.noteRow}>
              {row.map((name, i) => {
                const pc = rowIndex * 6 + i;
                const active = pc === selectedPitchClass;
                return (
                  <PressableScale
                    key={name}
                    onPress={() => selectNote(pc, selectedOctave)}
                    pressedScale={0.9}
                    style={{
                      ...styles.noteButton,
                      backgroundColor: active ? theme.tint : theme.backgroundElement,
                      borderColor: active ? theme.tint : theme.border,
                    }}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: active ? theme.background : theme.text }}>
                      {name}
                    </ThemedText>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </View>

        {/* Octave */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            OCTAVE
          </ThemedText>
          <ChipRow
            options={OCTAVES}
            selected={selectedOctave}
            onSelect={(octave) => selectNote(selectedPitchClass, octave)}
          />
        </View>

        {/* Fifth toggle */}
        <View style={[styles.section, styles.rowBetween]}>
          <ThemedText>Add fifth ({midiToLabel(midi + 7)})</ThemedText>
          <Switch
            value={withFifth}
            onValueChange={setFifth}
            trackColor={{ true: theme.tint }}
          />
        </View>

        {/* Volume */}
        <VolumeSlider source="drone" />

        <View style={styles.spacer} />

        {/* Play / stop */}
        <PressableScale
          onPress={toggle}
          pressedScale={0.92}
          style={{
            ...styles.playButton,
            backgroundColor: playing ? theme.error : theme.tint,
          }}>
          <MaterialCommunityIcons
            name={playing ? 'stop' : 'play'}
            size={40}
            color={theme.background}
          />
        </PressableScale>
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
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  noteRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  noteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  spacer: {
    flex: 1,
  },
  playButton: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
});
