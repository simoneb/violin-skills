import { useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { centsColor, IN_TUNE_CENTS, TunerGauge } from '@/components/tuner-gauge';
import { ChipRow } from '@/components/chip-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { midiToLabel } from '@/music/notes';
import { NOTES_PER_SESSION, TIER_LABELS, useIntonation, type Tier } from '@/practice/intonation';

const TIER_OPTIONS = (Object.keys(TIER_LABELS) as Tier[]).map((tier) => ({
  value: tier,
  label: TIER_LABELS[tier],
}));

export default function IntonationScreen() {
  useKeepAwake();
  const theme = useTheme();
  const [tier, setTier] = useState<Tier>('openStrings');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const { phase, targets, index, results, liveCents, holdProgress, begin, cancel } =
    useIntonation();

  // Stop listening (and close the practice-log span) when leaving the screen.
  useFocusEffect(
    useCallback(() => {
      return () => {
        void useIntonation.getState().cancel();
      };
    }, []),
  );

  const start = async () => {
    setPermissionDenied(false);
    const ok = await begin(tier);
    if (!ok) {
      setPermissionDenied(true);
    }
  };

  const avgAbs =
    results.length > 0
      ? results.reduce((a, r) => a + r.absError, 0) / results.length
      : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Intonation trainer</ThemedText>

        {phase === 'idle' && (
          <View style={styles.body}>
            <ThemedText themeColor="textSecondary">
              You get {NOTES_PER_SESSION} target notes. Play each one and hold it steady for a
              second — the app scores how close you are, in cents.
            </ThemedText>
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                DIFFICULTY
              </ThemedText>
              <ChipRow options={TIER_OPTIONS} selected={tier} onSelect={setTier} />
            </View>
            {permissionDenied && (
              <ThemedText style={{ color: theme.error }}>
                Microphone access is required. Enable it in the system settings.
              </ThemedText>
            )}
            <View style={styles.spacer} />
            <Pressable
              onPress={start}
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                Start session
              </ThemedText>
            </Pressable>
          </View>
        )}

        {(phase === 'listening' || phase === 'scored') && (
          <View style={styles.body}>
            <ThemedText type="small" themeColor="textSecondary">
              Note {index + 1} of {targets.length}
            </ThemedText>

            <View style={styles.targetDisplay}>
              <ThemedText style={styles.targetNote}>
                {midiToLabel(targets[index])}
              </ThemedText>
              {phase === 'scored' && results.length > 0 ? (
                <ThemedText
                  type="smallBold"
                  style={{
                    color: centsColor(results[results.length - 1].centsError, theme),
                  }}>
                  {formatCents(results[results.length - 1].centsError)} ·{' '}
                  {qualify(results[results.length - 1].absError)}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {liveCents !== null ? 'Hold it…' : 'Play the note'}
                </ThemedText>
              )}
            </View>

            {/* Hold progress */}
            <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor:
                      phase === 'scored' ? theme.success : theme.tint,
                    width: `${Math.round(holdProgress * 100)}%`,
                  },
                ]}
              />
            </View>

            <TunerGauge cents={liveCents} />

            <View style={styles.spacer} />
            <Pressable
              onPress={() => cancel()}
              style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Stop session
              </ThemedText>
            </Pressable>
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.body}>
            <View style={styles.summaryHeader}>
              <ThemedText style={[styles.bigScore, { color: centsColor(avgAbs, theme) }]}>
                ±{avgAbs.toFixed(1)}
              </ThemedText>
              <ThemedText themeColor="textSecondary">average cents off</ThemedText>
            </View>

            <ScrollView style={styles.resultList}>
              {results.map((r, i) => (
                <View
                  key={i}
                  style={[styles.resultRow, { borderBottomColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{midiToLabel(r.targetMidi)}</ThemedText>
                  <ThemedText type="small" style={{ color: centsColor(r.centsError, theme) }}>
                    {formatCents(r.centsError)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ±{r.stability.toFixed(1)} wobble
                  </ThemedText>
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => cancel()}
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                New session
              </ThemedText>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function formatCents(cents: number): string {
  return `${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents`;
}

function qualify(absError: number): string {
  if (absError <= IN_TUNE_CENTS) return 'excellent';
  if (absError <= 10) return 'good';
  if (absError <= 20) return 'getting there';
  return 'keep working';
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
  body: {
    flex: 1,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  targetDisplay: {
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 120,
    justifyContent: 'center',
  },
  targetNote: {
    fontSize: 80,
    lineHeight: 88,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 999,
    marginBottom: Spacing.four,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 999,
    marginBottom: Spacing.four,
  },
  summaryHeader: {
    alignItems: 'center',
  },
  bigScore: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '700',
  },
  resultList: {
    flex: 1,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
});
