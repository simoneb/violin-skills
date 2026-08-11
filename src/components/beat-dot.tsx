import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface BeatDotProps {
  active: boolean;
  color: string;
  idleColor: string;
}

/** Metronome beat indicator that pops on its beat. */
export function BeatDot({ active, color, idleColor }: BeatDotProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withSequence(
        withTiming(1.45, { duration: 60 }),
        withSpring(1, { damping: 12, stiffness: 220 }),
      );
    }
  }, [active, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: active ? color : idleColor }, style]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
