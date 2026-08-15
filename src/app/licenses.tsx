import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import licenseData from '@/constants/licenses.generated.json';

const SOURCE_URL = 'https://github.com/simoneb/violin-skills';

type Package = {
  name: string;
  version: string;
  license: string;
  copyright: string[];
};

const PACKAGES = licenseData.packages as Package[];
const LICENSE_TEXTS = licenseData.licenseTexts as Record<string, string>;

// Most-used licenses first: the long tail is noise at the top of the screen.
const LICENSE_IDS = Object.keys(LICENSE_TEXTS).sort((a, b) => {
  const count = (id: string) => PACKAGES.filter((p) => p.license === id).length;
  return count(b) - count(a) || a.localeCompare(b);
});

const PackageRow = memo(function PackageRow({ item }: { item: Package }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowHead}>
        <ThemedText type="smallBold" style={styles.rowName}>
          {item.name}
        </ThemedText>
        <ThemedText type="code" themeColor="textSecondary">
          {item.license}
        </ThemedText>
      </View>
      {item.copyright.map((line) => (
        <ThemedText key={line} type="small" themeColor="textSecondary">
          {line}
        </ThemedText>
      ))}
    </View>
  );
});

function LicenseText({ id }: { id: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const count = useMemo(() => PACKAGES.filter((p) => p.license === id).length, [id]);

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <PressableScale onPress={() => setOpen((v) => !v)} style={styles.rowHead}>
        <ThemedText type="smallBold" style={styles.rowName}>
          {id}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {count} {count === 1 ? 'package' : 'packages'}
        </ThemedText>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
        />
      </PressableScale>
      {open && (
        <ThemedText type="code" themeColor="textSecondary" style={styles.licenseBody}>
          {LICENSE_TEXTS[id]}
        </ThemedText>
      )}
    </View>
  );
}

function Header() {
  const theme = useTheme();
  const openSource = useCallback(() => {
    WebBrowser.openBrowserAsync(SOURCE_URL);
  }, []);

  return (
    <View style={styles.header}>
      <ThemedText type="title">Open-source licenses</ThemedText>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="smallBold">Violin Skills</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Free software under the GNU Affero General Public License v3. You can read, build and
          modify the source, and you are entitled to a copy of it.
        </ThemedText>
        <PressableScale onPress={openSource} style={styles.sourceLink}>
          <MaterialCommunityIcons name="source-branch" size={16} color={theme.tint} />
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            View the source
          </ThemedText>
        </PressableScale>
      </ThemedView>

      <ThemedText type="small" themeColor="textSecondary">
        This app is built on work by others. Below is every package it ships, the license it is
        used under, and the full text of each of those licenses.
      </ThemedText>

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        LICENSE TEXTS
      </ThemedText>
      {LICENSE_IDS.map((id) => (
        <LicenseText key={id} id={id} />
      ))}

      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        PACKAGES ({PACKAGES.length})
      </ThemedText>
    </View>
  );
}

export default function LicensesScreen() {
  const renderItem = useCallback(
    ({ item }: { item: Package }) => <PackageRow item={item} />,
    [],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={PACKAGES}
          keyExtractor={(item) => item.name}
          renderItem={renderItem}
          ListHeaderComponent={Header}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          // 600 rows: keep the mounted window small — this screen is reachable
          // from Home and shouldn't cost anything to open.
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scroll: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },
  header: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sectionLabel: {
    marginTop: Spacing.three,
  },
  row: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowName: {
    flex: 1,
  },
  licenseBody: {
    paddingTop: Spacing.two,
  },
});
