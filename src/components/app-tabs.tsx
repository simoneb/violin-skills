import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'violin' },
  { name: 'drone', title: 'Drone', icon: 'sine-wave' },
  { name: 'tuner', title: 'Tuner', icon: 'gauge' },
  { name: 'metronome', title: 'Metronome', icon: 'metronome' },
  { name: 'scales', title: 'Scales', icon: 'music-clef-treble' },
];

/** Icon pill + label + paddings — the bar's height above the gesture inset. */
const BAR_CONTENT_HEIGHT = 68;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  // Explicit clearance for the Android gesture handle: the reported inset on
  // some devices leaves labels nearly touching it, so enforce a floor.
  const bottomPad = Math.max(insets.bottom, 20);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingTop: 8,
          height: BAR_CONTENT_HEIGHT + bottomPad,
          paddingBottom: bottomPad,
        },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={[
                  styles.iconPill,
                  focused && { backgroundColor: colors.tint + '22' },
                ]}>
                <MaterialCommunityIcons name={tab.icon} size={26} color={color} />
              </View>
            ),
          }}
        />
      ))}
      {/* Routes reachable from Home but hidden from the tab bar */}
      <Tabs.Screen name="intonation" options={{ href: null }} />
      <Tabs.Screen name="journal" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconPill: {
    width: 60,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
