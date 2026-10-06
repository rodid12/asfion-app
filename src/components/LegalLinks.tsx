import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ASFION_LEGAL_URLS } from '@/config/legal';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type LegalLinksTheme = 'dark' | 'light';

interface LegalLinksProps {
  theme?: LegalLinksTheme;
}

const LINKS = [
  { label: 'Privacidad', url: ASFION_LEGAL_URLS.privacy },
  { label: 'Términos', url: ASFION_LEGAL_URLS.terms },
  { label: 'Soporte y baja', url: ASFION_LEGAL_URLS.support },
] as const;

async function openLegalUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'No pudimos abrir el enlace',
      'Revisá tu conexión e intentá nuevamente.',
    );
  }
}

/** Accesos permanentes requeridos para privacidad, términos y soporte. */
export function LegalLinks({ theme = 'light' }: LegalLinksProps) {
  const dark = theme === 'dark';

  return (
    <View style={styles.row}>
      {LINKS.map((link, index) => (
        <React.Fragment key={link.url}>
          {index > 0 ? (
            <Text
              accessible={false}
              style={[styles.separator, dark ? styles.textDark : styles.textLight]}
            >
              ·
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={link.label}
            hitSlop={8}
            onPress={() => { void openLegalUrl(link.url); }}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[styles.link, dark ? styles.textDark : styles.textLight]}>
              {link.label}
            </Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  link: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold as '600',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    textDecorationLine: 'underline',
  },
  separator: {
    fontSize: fontSize.xs,
    opacity: 0.7,
  },
  textDark: {
    color: colors.textOnDarkMuted,
  },
  textLight: {
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.55,
  },
});

