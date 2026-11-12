import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { fontSize, fontWeight } from '@/theme/typography';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  retryKey: number;
}

/**
 * Última barrera de seguridad del árbol React.
 *
 * Un error de renderizado ya no termina en el diálogo nativo “ASFION se
 * detuvo”: se reemplaza por una pantalla recuperable. No intercepta errores
 * nativos, pero sí la clase de regresión JavaScript que puede llegar por OTA.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ASFION] Error de interfaz recuperado', error, info.componentStack);
  }

  private retry = (): void => {
    this.setState(previous => ({ error: null, retryKey: previous.retryKey + 1 }));
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.logo}>ASFION</Text>
            <Text style={styles.title}>No pudimos mostrar esta pantalla</Text>
            <Text style={styles.body}>
              Tus datos guardados no fueron eliminados. Podés reintentar o cerrar y volver a abrir la aplicación.
            </Text>
            <Pressable onPress={this.retry} style={styles.button}>
              <Text style={styles.buttonText}>REINTENTAR</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.navyDeep,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
  },
  logo: {
    color: colors.orange,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: spacing.lg,
    color: colors.navyDeep,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
  },
  body: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: fontSize.base,
    lineHeight: 23,
  },
  button: {
    minHeight: 54,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.orange,
  },
  buttonText: {
    color: colors.white,
    fontWeight: fontWeight.bold as '700',
    letterSpacing: 1,
  },
});
