import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface ScreenHeaderProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
}

/** Tool-screen header: tinted icon badge, title, optional status line. */
export function ScreenHeader({ icon, title, subtitle }: ScreenHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: theme.tint + '22' }]}>
        <MaterialCommunityIcons name={icon} size={30} color={theme.tint} />
      </View>
      <View style={styles.textColumn}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  badge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
});
