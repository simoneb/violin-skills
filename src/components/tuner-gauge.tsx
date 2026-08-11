import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

/** Range of the gauge in cents (±). */
const RANGE = 50;
/** |cents| ≤ this is "in tune". */
export const IN_TUNE_CENTS = 5;
const NEEDLE_WIDTH = 3;

interface TunerGaugeProps {
  /** Cents deviation in [-50, 50], or null when silent. */
  cents: number | null;
}

export function centsColor(cents: number, theme: ReturnType<typeof useTheme>): string {
  const abs = Math.abs(cents);
  if (abs <= IN_TUNE_CENTS) return theme.success;
  if (abs <= 15) return theme.warning;
  return theme.error;
}

/** Horizontal cents gauge: tick marks, a green in-tune zone and a smoothed needle. */
export function TunerGauge({ cents }: TunerGaugeProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const position = useSharedValue(0.5);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (cents !== null) {
      const clamped = Math.max(-RANGE, Math.min(RANGE, cents));
      position.value = withTiming((clamped + RANGE) / (2 * RANGE), { duration: 80 });
      opacity.value = withTiming(1, { duration: 120 });
    } else {
      opacity.value = withTiming(0.3, { duration: 400 });
    }
  }, [cents, position, opacity]);

  const needleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: position.value * (width - NEEDLE_WIDTH) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const ticks = [];
  for (let c = -RANGE; c <= RANGE; c += 10) {
    ticks.push(c);
  }
  const needleColor = cents === null ? theme.textSecondary : centsColor(cents, theme);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]} onLayout={onLayout}>
        {/* In-tune zone */}
        <View
          style={[
            styles.zone,
            {
              backgroundColor: theme.success + '33',
              left: `${(50 - IN_TUNE_CENTS) / 100 * 100}%`,
              width: `${(IN_TUNE_CENTS * 2) / 100 * 100}%`,
            },
          ]}
        />
        {/* Ticks */}
        {ticks.map((c) => (
          <View
            key={c}
            style={[
              styles.tick,
              {
                left: `${((c + RANGE) / (2 * RANGE)) * 100}%`,
                height: c === 0 ? '100%' : c % 20 === 0 ? '55%' : '35%',
                backgroundColor: c === 0 ? theme.text : theme.backgroundSelected,
              },
            ]}
          />
        ))}
        {/* Needle */}
        {width > 0 && (
          <Animated.View
            style={[styles.needle, { backgroundColor: needleColor }, needleStyle]}
          />
        )}
      </View>
      <View style={styles.labels}>
        <ThemedText type="small" themeColor="textSecondary">-50</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">0</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">+50</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  track: {
    height: 96,
    borderRadius: Spacing.two,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  zone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  tick: {
    position: 'absolute',
    width: 1,
    alignSelf: 'center',
    top: '50%',
    transform: [{ translateY: '-50%' }],
  },
  needle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: NEEDLE_WIDTH,
    borderRadius: 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
