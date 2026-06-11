// Placeholder para los módulos no implementados (Mortandad / Pastoreo / Lluvias).
// Mantiene la misma jerarquía visual que las pantallas reales: header arriba,
// cuerpo centrado con emoji + título + descripción + CTA para pedir acceso.
//
// Comunica intención: "esto existe, está en roadmap, no es un bug".

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  title: string;
  emoji: string;
  descripcion: string;
}

export function ComingSoonScreen({ title, emoji, descripcion }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.hTitle}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>PRÓXIMAMENTE</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.emojiBubble}>
          <Text style={styles.emojiTxt}>{emoji}</Text>
        </View>
        <Text style={styles.big}>En preparación</Text>
        <Text style={styles.desc}>{descripcion}</Text>

        <View style={styles.divider} />

        <Text style={styles.rollout}>
          Se habilita junto con los próximos módulos. Mientras tanto usá el módulo{' '}
          <Text style={styles.rolloutStrong}>Pariciones</Text> desde el menú.
        </Text>

        <Pressable style={styles.cta} accessibilityRole="button">
          <Text style={styles.ctaTxt}>Avisarme cuando esté listo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgLight },

  header: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.white,
  },
  hTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  badgeTxt: {
    fontSize: 9,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  body: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emojiBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emojiTxt: { fontSize: 44 },
  big: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  desc: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  divider: {
    height: 1,
    width: '70%',
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.md,
  },
  rollout: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  rolloutStrong: {
    color: colors.navy,
    fontWeight: fontWeight.bold as '700',
  },
  cta: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  ctaTxt: {
    color: colors.navy,
    fontWeight: fontWeight.bold as '700',
    fontSize: fontSize.sm,
  },
});
