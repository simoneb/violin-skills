import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

export interface ChipOption<T> {
  value: T;
  label: string;
}

interface ChipRowProps<T> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  style?: ViewStyle;
}

/** Horizontal row of selectable chips — octaves, A4 presets, scale types, etc. */
export function ChipRow<T extends string | number>({
  options,
  selected,
  onSelect,
  style,
}: ChipRowProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.row, style]}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onSelect(option.value)}
            style={[
              styles.chip,
              { backgroundColor: active ? theme.tint : theme.backgroundElement },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: active ? theme.background : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    minWidth: 52,
    alignItems: 'center',
  },
});
