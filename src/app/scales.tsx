import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';

import { centsColor, IN_TUNE_CENTS } from '@/components/tuner-gauge';
import { ChipRow } from '@/components/chip-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { midiToLabel, NOTE_NAMES_SHARP, VIOLIN_MIN_MIDI } from '@/music/notes';
import { buildScale, SCALE_LABELS, type ScaleType, usesFlats } from '@/music/scales';
import { useDrone } from '@/state/drone';
import { useTuner } from '@/state/tuner';

const KEY_OPTIONS = NOTE_NAMES_SHARP.map((name, pc) => ({ value: pc, label: name }));
const SCALE_OPTIONS = (Object.keys(SCALE_LABELS) as ScaleType[]).map((type) => ({
  value: type,
  label: SCALE_LABELS[type],
}));

/** Lowest playable tonic on the violin for a pitch class. */
function tonicMidiFor(pc: number): number {
  const candidate = 48 + pc; // octave 3
  return candidate >= VIOLIN_MIN_MIDI ? candidate : candidate + 12;
}

export default function ScalesScreen() {
  useKeepAwake();
  const theme = useTheme();
  const [tonicPc, setTonicPc] = useState(7); // G — the violinist's first scale
  const [scaleType, setScaleType] = useState<ScaleType>('major');

  const { note, cents, start, stop } = useTuner();
  const dronePlaying = useDrone((s) => s.playing);
  const droneToggle = useDrone((s) => s.toggle);
  const droneSetMidi = useDrone((s) => s.setMidi);

  // Live pitch feedback while the screen is focused (journal-logged as scales practice).
  useFocusEffect(
    useCallback(() => {
      start('scales');
      return () => {
        stop();
      };
    }, [start, stop]),
  );

  const tonicMidi = tonicMidiFor(tonicPc);
  const scale = useMemo(() => buildScale(tonicMidi, scaleType, 2), [tonicMidi, scaleType]);
  const flats = usesFlats(tonicPc, scaleType);

  // Prefer an exact-octave match, fall back to pitch class.
  const playedMidi = note?.midi ?? null;
  const exactIndex = playedMidi !== null ? scale.findIndex((n) => n.midi === playedMidi) : -1;
  const pcIndex =
    exactIndex === -1 && playedMidi !== null
      ? scale.findIndex((n) => n.midi % 12 === playedMidi % 12)
      : -1;
  const activeIndex = exactIndex !== -1 ? exactIndex : pcIndex;

  const toggleDrone = () => {
    droneSetMidi(tonicMidi);
    droneToggle();
  };

  const selectTonic = (pc: number) => {
    setTonicPc(pc);
    if (dronePlaying) {
      droneSetMidi(tonicMidiFor(pc));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Scales</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {midiToLabel(tonicMidi, flats)} {SCALE_LABELS[scaleType].toLowerCase()} · 2 octaves
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              KEY
            </ThemedText>
            <ChipRow options={KEY_OPTIONS} selected={tonicPc} onSelect={selectTonic} />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              SCALE
            </ThemedText>
            <ChipRow options={SCALE_OPTIONS} selected={scaleType} onSelect={setScaleType} />
          </View>

          {/* Scale notes with live feedback */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              NOTES
            </ThemedText>
            <View style={styles.noteGrid}>
              {scale.map((n, i) => {
                const active = i === activeIndex;
                const color = active ? centsColor(cents, theme) : theme.backgroundElement;
                return (
                  <View
                    key={`${n.midi}-${i}`}
                    style={[styles.scaleNote, { backgroundColor: color }]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: active ? theme.background : theme.text }}>
                      {n.name}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: active ? theme.background : theme.textSecondary,
                        fontSize: 10,
                        lineHeight: 12,
                      }}>
                      {Math.floor(n.midi / 12) - 1}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {note
                ? `Playing ${midiToLabel(note.midi, flats)} · ${cents >= 0 ? '+' : ''}${cents.toFixed(0)} cents${
                    Math.abs(cents) <= IN_TUNE_CENTS ? ' ✓' : ''
                  }`
                : 'Play along — the matching note lights up.'}
            </ThemedText>
          </View>
        </ScrollView>

        {/* Drone on tonic */}
        <PressableScale
          onPress={toggleDrone}
          style={{
            ...styles.droneButton,
            backgroundColor: dronePlaying ? theme.error : theme.tint,
          }}>
          <MaterialCommunityIcons
            name={dronePlaying ? 'stop' : 'sine-wave'}
            size={22}
            color={theme.background}
          />
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {dronePlaying ? 'Stop drone' : `Drone on ${midiToLabel(tonicMidi, flats)}`}
          </ThemedText>
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
  },
  scroll: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  header: {
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.two,
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  scaleNote: {
    width: 52,
    height: 52,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  droneButton: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 999,
    marginVertical: Spacing.three,
  },
});
