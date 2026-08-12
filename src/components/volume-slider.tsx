import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import type { AudioSource } from '@/audio/engine';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/state/settings';
import { ThemedText } from './themed-text';

/** Volume for one audio generator. Every generator has its own, independent. */
export function VolumeSlider({ source }: { source: AudioSource }) {
  const theme = useTheme();
  const volume = useSettings((s) => s.volumes[source]);
  const setVolume = useSettings((s) => s.setVolume);

  // Label beside the slider rather than above it: the control screens are
  // dense, and this row matches the drone's "Add fifth" row.
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        VOLUME
      </ThemedText>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={volume}
        onValueChange={(v) => setVolume(source, v)}
        minimumTrackTintColor={theme.tint}
        maximumTrackTintColor={theme.backgroundSelected}
        thumbTintColor={theme.tint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  slider: {
    flex: 1,
  },
});
