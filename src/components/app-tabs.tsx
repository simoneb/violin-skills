import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Colors } from '@/constants/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'violin' },
  { name: 'drone', title: 'Drone', icon: 'sine-wave' },
  { name: 'tuner', title: 'Tuner', icon: 'gauge' },
  { name: 'metronome', title: 'Metronome', icon: 'metronome' },
  { name: 'scales', title: 'Scales', icon: 'music-clef-treble' },
];

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

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
          height: 64,
          paddingTop: 6,
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
                <MaterialCommunityIcons name={tab.icon} size={22} color={color} />
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
    fontSize: 11,
    fontWeight: '600',
  },
  iconPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
