import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipRow } from '@/components/chip-row';
import { ScreenHeader } from '@/components/screen-header';
import { centsColor, IN_TUNE_CENTS, TunerGauge } from '@/components/tuner-gauge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { midiToLabel, OPEN_STRINGS } from '@/music/notes';
import { useDrone } from '@/state/drone';
import { useSettings, type TuningMode } from '@/state/settings';
import { useTuner } from '@/state/tuner';

const MODE_OPTIONS: { value: TuningMode; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'just', label: 'Just (vs drone)' },
];

export default function TunerScreen() {
  useKeepAwake();
  const theme = useTheme();
  const { note, cents, justRoot, permission, start, stop } = useTuner();
  const a4 = useSettings((s) => s.a4);
  const tuningMode = useSettings((s) => s.tuningMode);
  const setTuningMode = useSettings((s) => s.setTuningMode);
  const dronePlaying = useDrone((s) => s.playing);

  // Listen while the screen is focused, release the mic when leaving.
  // Mic startup is deferred past the tab transition so switching stays smooth.
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        start();
      });
      return () => {
        task.cancel();
        stop();
      };
    }, [start, stop]),
  );

  const hasNote = note !== null;
  const inTune = hasNote && Math.abs(cents) <= IN_TUNE_CENTS;
  const noteColor = hasNote ? centsColor(cents, theme) : theme.textSecondary;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          icon="gauge"
          title="Tuner"
          subtitle={
            justRoot !== null
              ? `A = ${a4} Hz · just intervals vs ${midiToLabel(justRoot)}`
              : `A = ${a4} Hz · equal temperament`
          }
        />

        <View style={styles.modeRow}>
          <ChipRow options={MODE_OPTIONS} selected={tuningMode} onSelect={setTuningMode} />
          {tuningMode === 'just' && !dronePlaying && (
            <ThemedText type="small" themeColor="textSecondary">
              Start a drone — just intervals are measured against its root. Using equal
              temperament until then.
            </ThemedText>
          )}
        </View>

        {permission === 'denied' ? (
          <View style={styles.center}>
            <ThemedText style={styles.centerText}>
              Microphone access is required to detect your pitch. Enable it in the system
              settings for Violin Skills.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.main}>
            {/* Note display */}
            <View style={styles.noteDisplay}>
              {hasNote ? (
                <ThemedText style={[styles.noteName, { color: noteColor }]}>
                  {note.name}
                  <ThemedText style={styles.octave}> {note.octave}</ThemedText>
                </ThemedText>
              ) : (
                <MaterialCommunityIcons
                  name="waveform"
                  size={72}
                  color={theme.backgroundSelected}
                />
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {hasNote
                  ? `${note.frequency.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${cents.toFixed(0)} cents`
                  : 'Listening — play a note'}
              </ThemedText>
              {inTune && (
                <ThemedText type="smallBold" style={{ color: theme.success }}>
                  IN TUNE
                </ThemedText>
              )}
            </View>

            <TunerGauge cents={hasNote ? cents : null} />

            {/* Open-string reference */}
            <View style={styles.stringsRow}>
              {OPEN_STRINGS.map((s) => {
                const active = hasNote && note.midi === s.midi;
                return (
                  <View
                    key={s.name}
                    style={[
                      styles.stringBadge,
                      {
                        backgroundColor: active
                          ? centsColor(cents, theme)
                          : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: active ? theme.background : theme.textSecondary }}>
                      {s.name}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.five,
    paddingBottom: Spacing.six,
  },
  modeRow: {
    gap: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  noteDisplay: {
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 140,
    justifyContent: 'center',
  },
  noteName: {
    fontSize: 96,
    lineHeight: 104,
    fontWeight: '700',
  },
  octave: {
    fontSize: 40,
    fontWeight: '500',
  },
  stringsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  stringBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
