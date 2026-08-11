/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1D23',
    background: '#FAFAFC',
    backgroundElement: '#F0F1F5',
    backgroundSelected: '#E2E4EC',
    textSecondary: '#676D79',
    /** Subtle card/hairline borders. */
    border: '#E6E8EF',
    tint: '#4F46E5',
    /** In tune / good intonation. */
    success: '#1E8E3E',
    /** Slightly off (5–15 cents). */
    warning: '#B8860B',
    /** Clearly off. */
    error: '#C5221F',
  },
  dark: {
    text: '#F2F3F5',
    background: '#0B0D10',
    backgroundElement: '#171A1F',
    backgroundSelected: '#252A32',
    textSecondary: '#9BA1AB',
    /** Subtle card/hairline borders. */
    border: '#22262E',
    tint: '#8B93F8',
    /** In tune / good intonation. */
    success: '#4ADE80',
    /** Slightly off (5–15 cents). */
    warning: '#FACC15',
    /** Clearly off. */
    error: '#F87171',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
