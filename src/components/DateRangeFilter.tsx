// DateRangeFilter — UN SOLO chip que abre un modal con todas las opciones
// de filtro de fecha (presets + rango custom).
//
// Diseño:
//
//   - En la lista, ves UN chip: "📅 30 días" o "📅 1/5 → 4/5".
//   - Tap → abre un Modal centrado con:
//       1. Atajos: Hoy / 7 días / 30 días / Todo (chips)
//       2. "O un rango específico": botones Desde / Hasta que abren el
//          spinner picker de iOS (tres columnas día/mes/año, sin el bug
//          del inline calendar que perdía el day grid).
//   - Tappear un preset aplica y cierra. Tappear "Aplicar" en custom
//     cierra. Hay un botón "Cerrar" para salir sin cambios.
//
// El componente es la ÚNICA fuente de verdad para los filtros de fecha,
// reemplazando los 4 chips de preset que estaban arriba antes (feedback Ro:
// duplicaban espacio). Los lists pasan los presets disponibles como prop.

import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '@/theme/colors';
import { fontSize, fontWeight } from '@/theme/typography';
import { radius, spacing } from '@/theme/spacing';

export interface DatePreset {
  key: string;
  label: string;
}

interface Props {
  /** Lista de presets disponibles (varía por módulo: pariciones usa Hoy/7d/30d, lluvias usa 30d/3m/Año, etc). */
  presets: readonly DatePreset[];
  /** Preset actualmente activo (el key). Solo aplica si no hay rango custom. */
  preset: string;
  /** Key del preset que significa "todo / sin filtro". */
  presetTodo: string;
  desde?: string;
  hasta?: string;
  onChangePreset: (key: string) => void;
  onChangeCustom: (desde: string | undefined, hasta: string | undefined) => void;
  /** Style extra para el chip principal (ej: flex:1 para que ocupe el ancho). */
  chipStyle?: import('react-native').ViewStyle;
}

function fmtCorta(iso: string): string {
  const [, mm, dd] = iso.split('-').map(Number);
  if (!mm || !dd) return iso;
  return `${dd}/${mm}`;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DateRangeFilter({
  presets,
  preset,
  presetTodo,
  desde,
  hasta,
  onChangePreset,
  onChangeCustom,
  chipStyle,
}: Props) {
  const [open, setOpen] = useState(false);
  // sub-state local para los pickers dentro del modal (evita commitear hasta
  // que el usuario tappee "Aplicar")
  const [draftDesde, setDraftDesde] = useState<string | undefined>(desde);
  const [draftHasta, setDraftHasta] = useState<string | undefined>(hasta);
  const [pickerOpen, setPickerOpen] = useState<'desde' | 'hasta' | null>(null);

  const customActivo = Boolean(desde || hasta);

  // Label del chip principal
  const presetActual = presets.find(p => p.key === preset);
  const chipLabel = customActivo
    ? `${desde ? fmtCorta(desde) : '...'} → ${hasta ? fmtCorta(hasta) : '...'}`
    : (presetActual?.label ?? 'Rango');

  const onAbrir = () => {
    setDraftDesde(desde);
    setDraftHasta(hasta);
    setPickerOpen(null);
    setOpen(true);
  };
  const onCerrar = () => {
    setPickerOpen(null);
    setOpen(false);
  };

  const aplicarPreset = (key: string) => {
    onChangePreset(key);
    onChangeCustom(undefined, undefined);
    onCerrar();
  };

  const aplicarCustom = () => {
    onChangeCustom(draftDesde, draftHasta);
    onCerrar();
  };

  const limpiarCustom = () => {
    setDraftDesde(undefined);
    setDraftHasta(undefined);
    onChangeCustom(undefined, undefined);
  };

  return (
    <>
      {/* Chip principal en la barra de filtros.
          Antes el "icono" era el emoji 📅 — en iOS se rendereaba como un
          calendario con el número del día actual ENCIMA (ej "17"), lo que
          confundía al usuario porque parecía un valor del filtro. Lo
          reemplazamos por un caracter unicode neutro (🗓) que en todas las
          plataformas renderea como icono genérico, y agregamos un prefijo
          textual "Fecha:" para que el chip se entienda solo aún si el icono
          no carga. */}
      <Pressable
        onPress={onAbrir}
        style={[styles.mainChip, customActivo && styles.mainChipActive, chipStyle]}
        hitSlop={6}
      >
        <Text style={styles.calendarIcon}>🗓</Text>
        <Text style={[styles.mainChipTxt, customActivo && styles.mainChipTxtActive]} numberOfLines={1}>
          {chipLabel}
        </Text>
        <Text style={[styles.chev, customActivo && styles.chevActive]}>▾</Text>
      </Pressable>

      {/* Modal con TODAS las opciones */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={onCerrar}
      >
        <Pressable style={styles.backdrop} onPress={onCerrar}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Rango de fechas</Text>

            {/* Atajos / Presets */}
            <Text style={styles.sectionLabel}>Atajos</Text>
            <View style={styles.presetRow}>
              {presets.map(p => {
                const sel = !customActivo && preset === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => aplicarPreset(p.key)}
                    style={[styles.preset, sel && styles.presetSel]}
                  >
                    <Text style={[styles.presetTxt, sel && styles.presetTxtSel]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Rango específico */}
            <Text style={styles.sectionLabel}>O un rango específico</Text>
            <View style={styles.customRow}>
              <Pressable
                onPress={() => setPickerOpen('desde')}
                style={[
                  styles.dateBtn,
                  pickerOpen === 'desde' && styles.dateBtnEditing,
                  draftDesde && styles.dateBtnFilled,
                ]}
              >
                <Text style={styles.dateBtnLabel}>DESDE</Text>
                <Text style={[styles.dateBtnValue, !draftDesde && styles.dateBtnValueEmpty]}>
                  {draftDesde ? fmtCorta(draftDesde) : '— / —'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPickerOpen('hasta')}
                style={[
                  styles.dateBtn,
                  pickerOpen === 'hasta' && styles.dateBtnEditing,
                  draftHasta && styles.dateBtnFilled,
                ]}
              >
                <Text style={styles.dateBtnLabel}>HASTA</Text>
                <Text style={[styles.dateBtnValue, !draftHasta && styles.dateBtnValueEmpty]}>
                  {draftHasta ? fmtCorta(draftHasta) : '— / —'}
                </Text>
              </Pressable>
            </View>

            {/* Picker — usa spinner (3 columnas día/mes/año, predecible).
                Vive DENTRO del modal así no se confunde con el chip. */}
            {pickerOpen && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={
                    pickerOpen === 'desde'
                      ? (draftDesde ? new Date(draftDesde + 'T00:00:00') : new Date())
                      : (draftHasta ? new Date(draftHasta + 'T00:00:00') : new Date())
                  }
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  // textColor + themeVariant para que el spinner se vea legible
                  // (en iOS por default el texto era gris claro sobre bgLight, casi invisible)
                  textColor={colors.navyDeep}
                  themeVariant="light"
                  minimumDate={
                    pickerOpen === 'hasta' && draftDesde
                      ? new Date(draftDesde + 'T00:00:00')
                      : undefined
                  }
                  maximumDate={
                    pickerOpen === 'desde' && draftHasta
                      ? new Date(draftHasta + 'T00:00:00')
                      : new Date()
                  }
                  onChange={(_e, sel) => {
                    if (Platform.OS !== 'ios') setPickerOpen(null);
                    if (sel) {
                      if (pickerOpen === 'desde') setDraftDesde(isoOf(sel));
                      else setDraftHasta(isoOf(sel));
                    }
                  }}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setPickerOpen(null)}
                    style={styles.pickerDoneBtn}
                  >
                    <Text style={styles.pickerDoneTxt}>Listo</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Footer del modal */}
            <View style={styles.footer}>
              {(draftDesde || draftHasta) && (
                <Pressable onPress={limpiarCustom} style={styles.footerLink} hitSlop={6}>
                  <Text style={styles.footerLinkTxt}>Limpiar custom</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable onPress={onCerrar} style={styles.btnSecondary} hitSlop={6}>
                <Text style={styles.btnSecondaryTxt}>Cerrar</Text>
              </Pressable>
              <Pressable
                onPress={aplicarCustom}
                style={[
                  styles.btnPrimary,
                  !(draftDesde || draftHasta) && styles.btnPrimaryDisabled,
                ]}
                disabled={!(draftDesde || draftHasta)}
                hitSlop={6}
              >
                <Text style={styles.btnPrimaryTxt}>Aplicar custom</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Chip principal en la filter bar — compacto para entrar con flex:1 en
  // un row con otros 2 chips (Campo, Usuario).
  mainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    minHeight: 36,
  },
  mainChipActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  calendarIcon: { fontSize: 14 },
  // flex:1 + minWidth:0 → permite truncar (numberOfLines={1}) cuando el chip
  // es angosto. Sin esto, el Text reporta su ancho natural como intrinsic min
  // y el reparto flex termina siendo proporcional al contenido en vez de
  // equitativo — por ej. una Fecha "Hoy" queda mucho más chica que un chip
  // con "Campo: todos" en la misma fila.
  mainChipTxt: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.sm,
    color: colors.textDark,
    fontWeight: fontWeight.semibold as '600',
  },
  mainChipTxtActive: {
    color: colors.navyDeep,
    fontWeight: fontWeight.bold as '700',
  },
  // Flecha dropdown más grande (14) para que se vea con claridad en el chip.
  chev: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
  chevActive: { color: colors.navyDeep },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },

  // Presets dentro del modal
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  presetSel: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  presetTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  presetTxtSel: {
    color: colors.white,
    fontWeight: fontWeight.bold as '700',
  },

  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.xs,
  },

  // Custom range
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  // Estado "editando": el usuario tappeó esta caja y el picker está abierto.
  // Solo borde naranja, sin fill. Indica "estoy esperando que elijas fecha".
  dateBtnEditing: {
    borderColor: colors.orange,
  },
  // Estado "rellenado": la caja tiene una fecha elegida.
  // Borde naranja + bg peach. Indica "esta fecha está seleccionada".
  dateBtnFilled: {
    borderColor: colors.orange,
    backgroundColor: colors.orangeSoft,
  },
  dateBtnLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  dateBtnValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: colors.textDark,
  },
  dateBtnValueEmpty: {
    color: colors.textMuted,
    fontStyle: 'italic',
    fontWeight: fontWeight.semibold as '600',
  },

  // Picker dentro del modal — bg blanco para máximo contraste con el texto
  // del spinner iOS (sobre bgLight cream el texto se ve gris claro).
  pickerWrap: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingTop: spacing.xs,
    alignItems: 'center',
  },
  pickerDoneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerDoneTxt: {
    color: colors.navy,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
  },

  // Footer del modal
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  footerLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  footerLinkTxt: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: fontWeight.semibold as '600',
    textDecorationLine: 'underline',
  },
  btnSecondary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgLight,
  },
  btnSecondaryTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
    color: colors.textDark,
  },
  btnPrimary: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
  },
  btnPrimaryDisabled: {
    backgroundColor: colors.borderSoft,
  },
  btnPrimaryTxt: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: colors.white,
    letterSpacing: 0.3,
  },
});
