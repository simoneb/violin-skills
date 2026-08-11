import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { centsColor, IN_TUNE_CENTS, TunerGauge } from '@/components/tuner-gauge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OPEN_STRINGS } from '@/music/notes';
import { useSettings } from '@/state/settings';
import { useTuner } from '@/state/tuner';

export default function TunerScreen() {
  useKeepAwake();
  const theme = useTheme();
  const { note, cents, permission, start, stop } = useTuner();
  const a4 = useSettings((s) => s.a4);

  // Listen while the screen is focused, release the mic when leaving.
  useFocusEffect(
    useCallback(() => {
      start();
      return () => {
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
        <View style={styles.header}>
          <ThemedText type="subtitle">Tuner</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A = {a4} Hz
          </ThemedText>
        </View>

        {permission === 'denied' ? (
          <View style={styles.center}>
            <ThemedText style={styles.centerText}>
              Microphone access is required to detect your pitch. Enable it in the system
              settings for Violin Skills.
            </ThemedText>
          </View>
        ) : (
          <>
            {/* Note display */}
            <View style={styles.noteDisplay}>
              <ThemedText style={[styles.noteName, { color: noteColor }]}>
                {hasNote ? note.name : '—'}
                {hasNote && <ThemedText style={styles.octave}> {note.octave}</ThemedText>}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {hasNote
                  ? `${note.frequency.toFixed(1)} Hz · ${cents >= 0 ? '+' : ''}${cents.toFixed(0)} cents`
                  : 'Play a note'}
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
          </>
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
  header: {
    gap: Spacing.half,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
