import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipRow } from '@/components/chip-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { currentStreak, intonationTrend, troubleNotes, usageByTool, type Tool } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { midiToNoteName } from '@/music/notes';
import { A4_PRESETS, useSettings } from '@/state/settings';

const A4_OPTIONS = A4_PRESETS.map((hz) => ({ value: hz, label: `${hz}` }));

const TOOL_LABELS: Record<Tool, string> = {
  drone: 'Drone',
  tuner: 'Tuner',
  metronome: 'Metronome',
  scales: 'Scales',
  intonation: 'Intonation',
};

function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const { a4, setA4 } = useSettings();

  const [streak, setStreak] = useState(0);
  const [weekUsage, setWeekUsage] = useState<Partial<Record<Tool, number>>>({});
  const [trend, setTrend] = useState<{ day: string; avgAbsError: number }[]>([]);
  const [trouble, setTrouble] = useState<{ pitchClass: number; avgAbsError: number }[]>([]);

  // Refresh stats every time Home regains focus.
  useFocusEffect(
    useCallback(() => {
      const weekAgo = Date.now() - 7 * 86400_000;
      setStreak(currentStreak());
      setWeekUsage(usageByTool(weekAgo));
      setTrend(intonationTrend(30));
      setTrouble(troubleNotes(weekAgo).slice(0, 3));
    }, []),
  );

  const totalWeekMs = Object.values(weekUsage).reduce((a, b) => a + (b ?? 0), 0);
  const usedTools = (Object.keys(weekUsage) as Tool[]).sort(
    (a, b) => (weekUsage[b] ?? 0) - (weekUsage[a] ?? 0),
  );
  const latestScore = trend.length > 0 ? trend[trend.length - 1].avgAbsError : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">Violin Skills</ThemedText>
            <ThemedText themeColor="textSecondary">
              Drones, tuning, rhythm and intonation practice.
            </ThemedText>
          </View>

          {/* Practice stats */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText type="subtitle" style={{ color: theme.tint }}>
                  {streak}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  day streak
                </ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText type="subtitle">{formatMinutes(totalWeekMs)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  this week
                </ThemedText>
              </View>
              {latestScore !== null && (
                <View style={styles.stat}>
                  <ThemedText type="subtitle">±{latestScore.toFixed(0)}¢</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    intonation
                  </ThemedText>
                </View>
              )}
            </View>

            {usedTools.length > 0 && (
              <View style={styles.breakdown}>
                {usedTools.map((tool) => (
                  <View key={tool} style={styles.breakdownRow}>
                    <ThemedText type="small">{TOOL_LABELS[tool]}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatMinutes(weekUsage[tool] ?? 0)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            {trouble.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                Trouble notes:{' '}
                {trouble
                  .map((t) => `${midiToNoteName(t.pitchClass)} (±${t.avgAbsError.toFixed(0)}¢)`)
                  .join(' · ')}
              </ThemedText>
            )}

            {totalWeekMs === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                No practice logged yet this week — start a drone or take an intonation session.
              </ThemedText>
            )}
          </ThemedView>

          {/* Intonation trainer entry */}
          <Link href="/intonation" asChild>
            {/* Link asChild requires a flattened (non-array) style */}
            <Pressable style={{ ...styles.trainerButton, backgroundColor: theme.tint }}>
              <MaterialCommunityIcons name="bullseye-arrow" size={24} color={theme.background} />
              <View style={styles.trainerText}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  Intonation trainer
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.background, opacity: 0.8 }}>
                  Hit target notes, get scored in cents
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.background} />
            </Pressable>
          </Link>

          {/* Settings */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              REFERENCE PITCH (A4)
            </ThemedText>
            <ChipRow options={A4_OPTIONS} selected={a4} onSelect={setA4} />
            <ThemedText type="small" themeColor="textSecondary">
              Used by the drone, tuner, scales and intonation trainer.
            </ThemedText>
          </ThemedView>
        </ScrollView>
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
  },
  scroll: {
    gap: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  breakdown: {
    gap: Spacing.one,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trainerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  trainerText: {
    flex: 1,
  },
});
