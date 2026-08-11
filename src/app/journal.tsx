import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { listSessions, updateSessionNotes, type PracticeSession, type Tool } from '@/db';
import { useTheme } from '@/hooks/use-theme';

const TOOL_LABELS: Record<Tool, string> = {
  drone: 'Drone',
  tuner: 'Tuner',
  metronome: 'Metronome',
  scales: 'Scales',
  intonation: 'Intonation',
};

const TOOL_ICONS: Record<Tool, keyof typeof MaterialCommunityIcons.glyphMap> = {
  drone: 'sine-wave',
  tuner: 'gauge',
  metronome: 'metronome',
  scales: 'music-clef-treble',
  intonation: 'bullseye-arrow',
};

function dayLabel(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function duration(session: PracticeSession): string {
  const minutes = Math.max(1, Math.round(((session.endedAt ?? 0) - session.startedAt) / 60000));
  return `${minutes} min`;
}

export default function JournalScreen() {
  const theme = useTheme();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const reload = useCallback(() => setSessions(listSessions(100)), []);
  useFocusEffect(reload);

  const startEditing = (session: PracticeSession) => {
    setEditingId(session.id);
    setDraft(session.notes ?? '');
  };

  const saveNote = () => {
    if (editingId !== null) {
      updateSessionNotes(editingId, draft.trim());
      setEditingId(null);
      reload();
    }
  };

  // Group by day, newest first (sessions come pre-sorted from the query).
  const groups: { day: string; items: PracticeSession[] }[] = [];
  for (const session of sessions) {
    const day = dayLabel(session.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(session);
    } else {
      groups.push({ day, items: [session] });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedText type="subtitle" style={styles.title}>
            Practice journal
          </ThemedText>

          {sessions.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Nothing logged yet. Practice time is recorded automatically whenever you use a
                tool — start a drone or run an intonation session.
              </ThemedText>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {groups.map((group) => (
                <View key={group.day} style={styles.group}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {group.day.toUpperCase()}
                  </ThemedText>
                  {group.items.map((session) => (
                    <ThemedView
                      key={session.id}
                      type="backgroundElement"
                      style={[styles.row, { borderColor: theme.border }]}>
                      <View style={styles.rowHeader}>
                        <MaterialCommunityIcons
                          name={TOOL_ICONS[session.tool]}
                          size={18}
                          color={theme.tint}
                        />
                        <ThemedText type="smallBold" style={styles.rowTool}>
                          {TOOL_LABELS[session.tool]}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {new Date(session.startedAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {duration(session)}
                        </ThemedText>
                        <Pressable onPress={() => startEditing(session)} style={styles.noteButton}>
                          <MaterialCommunityIcons
                            name={session.notes ? 'note-edit' : 'note-plus-outline'}
                            size={18}
                            color={theme.textSecondary}
                          />
                        </Pressable>
                      </View>

                      {editingId === session.id ? (
                        <View style={styles.editRow}>
                          <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="How did it go?"
                            placeholderTextColor={theme.textSecondary}
                            style={[
                              styles.input,
                              { color: theme.text, borderColor: theme.backgroundSelected },
                            ]}
                            multiline
                            autoFocus
                          />
                          <PressableScale
                            onPress={saveNote}
                            style={{ ...styles.saveButton, backgroundColor: theme.tint }}>
                            <ThemedText type="smallBold" style={{ color: theme.background }}>
                              Save
                            </ThemedText>
                          </PressableScale>
                        </View>
                      ) : session.notes ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {session.notes}
                        </ThemedText>
                      ) : null}
                    </ThemedView>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  title: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowTool: {
    flex: 1,
  },
  noteButton: {
    padding: Spacing.one,
  },
  editRow: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    minHeight: 44,
    fontSize: 14,
  },
  saveButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
});
