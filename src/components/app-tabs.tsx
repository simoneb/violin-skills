import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';
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

/**
 * Plain tab button: no Android ripple, no press flash — the active tint
 * change is feedback enough for a tab switch.
 */
function TabButton({
  pressColor,
  pressOpacity,
  hoverEffect,
  href,
  ...props
}: Record<string, unknown>) {
  return <Pressable android_ripple={undefined} {...(props as object)} />;
}

/** Icon + label + paddings — the bar's height above the gesture inset. */
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
        // Freeze unfocused tabs: mounted-but-hidden screens otherwise keep
        // re-rendering (tuner/scales both subscribe to live pitch updates).
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.label,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingTop: 10,
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
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name={tab.icon} size={26} color={color} />
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
    marginTop: 4,
  },
});
