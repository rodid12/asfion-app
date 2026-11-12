import React, { useEffect, useState } from 'react';
import type { ComponentType, ErrorInfo, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { fontSize, fontWeight } from '@/theme/typography';

type TareaListProps = NativeStackScreenProps<RootStackParamList, 'TareaList'>;
type TareaFormProps = NativeStackScreenProps<RootStackParamList, 'TareaForm'>;

interface BoundaryProps {
  children: ReactNode;
  onBack: () => void;
  onRetry: () => void;
}

interface BoundaryState {
  error: Error | null;
}

class TareaErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ASFION:Tareas] Error aislado', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return <SafeFallback onBack={this.props.onBack} onRetry={this.props.onRetry} />;
    }
    return this.props.children;
  }
}

function SafeModuleScreen<P extends { navigation: { goBack: () => void } }>({
  loader,
  screenProps,
}: {
  loader: () => ComponentType<P>;
  screenProps: P;
}) {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setComponent(null);
    setFailed(false);
    try {
      const loaded = loader();
      if (active) setComponent(() => loaded);
    } catch (error) {
      console.error('[ASFION:Tareas] No se pudo cargar el módulo', error);
      if (active) setFailed(true);
    }
    return () => { active = false; };
  }, [attempt, loader]);

  const retry = () => setAttempt(value => value + 1);
  if (failed) return <SafeFallback onBack={screenProps.navigation.goBack} onRetry={retry} />;
  if (!Component) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.orange} /><Text style={styles.loadingText}>Abriendo Tareas…</Text></View>;
  }
  return (
    <TareaErrorBoundary key={attempt} onBack={screenProps.navigation.goBack} onRetry={retry}>
      <Component {...screenProps} />
    </TareaErrorBoundary>
  );
}

const loadTareaList = () => require('./TareaListScreen').TareaListScreen as ComponentType<TareaListProps>;
const loadTareaForm = () => require('./TareaFormScreen').TareaFormScreen as ComponentType<TareaFormProps>;

export function SafeTareaListScreen(props: TareaListProps) {
  return <SafeModuleScreen loader={loadTareaList} screenProps={props} />;
}

export function SafeTareaFormScreen(props: TareaFormProps) {
  return <SafeModuleScreen loader={loadTareaForm} screenProps={props} />;
}

function SafeFallback({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.emoji}>🛡️</Text>
        <Text style={styles.title}>Tareas no está disponible por el momento</Text>
        <Text style={styles.body}>
          El resto de ASFION sigue funcionando normalmente. Tus cargas y eventos no fueron afectados.
        </Text>
        <Pressable onPress={onRetry} style={styles.primary}><Text style={styles.primaryText}>REINTENTAR</Text></Pressable>
        <Pressable onPress={onBack} style={styles.secondary}><Text style={styles.secondaryText}>VOLVER AL MENÚ</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.bgLight },
  loadingText: { color: colors.textMuted, fontSize: fontSize.sm },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgLight },
  card: { width: '100%', maxWidth: 520, padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.white },
  emoji: { fontSize: 36 },
  title: { marginTop: spacing.md, color: colors.navyDeep, fontSize: fontSize.xl, fontWeight: fontWeight.bold as '700' },
  body: { marginTop: spacing.md, color: colors.textMuted, fontSize: fontSize.base, lineHeight: 23 },
  primary: { minHeight: 52, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.orange },
  primaryText: { color: colors.white, fontWeight: fontWeight.bold as '700' },
  secondary: { minHeight: 48, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.navyDeep, fontWeight: fontWeight.semibold as '600' },
});
