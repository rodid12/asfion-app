// NoLotesBanner — banner ámbar que aparece cuando el campo elegido NO tiene
// lotes cargados, bloqueando al usuario de avanzar. El uso original era
// mostrar un hint chiquito gris "Este campo no tiene lotes cargados", pero
// pasaba desapercibido y el usuario no entendía por qué el botón Guardar
// estaba deshabilitado para siempre.
//
// Diseño: card ámbar con borde, ícono de warning, mensaje breve y un CTA
// implícito ("Cambiá a otro campo o pedile al admin que cargue los lotes").
// Se renderiza en lugar del listado de chips de lotes.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  /** Si no hay campo elegido, mostramos otro mensaje (más suave). */
  faltaCampo?: boolean;
}

export function NoLotesBanner({ faltaCampo = false }: Props) {
  if (faltaCampo) {
    // Caso "todavía no elegiste campo" — no es un error, solo guía.
    return (
      <View style={styles.softHint}>
        <Text style={styles.softHintTxt}>Elegí un campo primero para ver sus lotes.</Text>
      </View>
    );
  }
  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>⚠️</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Este campo no tiene lotes cargados</Text>
        <Text style={styles.body}>
          No vas a poder guardar acá. Cambiá a otro campo, o pedile al admin
          que cargue los lotes de éste.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FFF4DD',  // ámbar muy diluido
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.amber,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: '#8B5A00', // ámbar oscuro para legibilidad sobre el bg claro
    marginBottom: 2,
  },
  body: {
    fontSize: fontSize.sm,
    color: '#6B4400',
    lineHeight: 18,
  },

  // Caso suave: aún no eligió campo. No es error, no merece banner ámbar.
  softHint: {
    paddingVertical: spacing.sm,
  },
  softHintTxt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
