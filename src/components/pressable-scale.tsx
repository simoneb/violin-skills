import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: ViewStyle | ViewStyle[];
  /** How far the element shrinks while pressed. */
  pressedScale?: number;
}

/**
 * Pressable with a springy scale-down on touch — makes every control feel
 * tactile without per-screen animation code.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(
  function PressableScale({ style, pressedScale = 0.96, onPressIn, onPressOut, ...rest }, ref) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <AnimatedPressable
        ref={ref}
        style={[animatedStyle, style]}
        onPressIn={(e) => {
          scale.value = withTiming(pressedScale, { duration: 80 });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
          onPressOut?.(e);
        }}
        {...rest}
      />
    );
  },
);
