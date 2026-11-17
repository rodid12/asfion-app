import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import { TareaListScreen } from './TareaListScreen';
import { TareaFormScreen } from './TareaFormScreen';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { fontSize, fontWeight } from '@/theme/typography';

type TareaStackParamList = Pick<RootStackParamList, 'TareaList' | 'TareaForm'>;

const Stack = createNativeStackNavigator<TareaStackParamList>();

interface Props {
  onClose: () => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Barrera exclusiva del módulo. Vive dentro del Modal y por debajo de la
 * barrera global: cualquier error de Seguimiento queda contenido aquí y la
 * persona siempre puede volver al menú sin reiniciar ASFION.
 */
class TareaModuleBoundary extends React.Component<Props & { children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ASFION:Tareas] Error contenido en módulo independiente', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <View style={styles.card}>
            <Text style={styles.logo}>ASFION</Text>
            <Text style={styles.title}>Seguimiento no está disponible</Text>
            <Text style={styles.body}>
              El resto de la aplicación continúa funcionando y no se perdió ninguna carga.
            </Text>
            <Text selectable style={styles.detail}>{this.state.error.message}</Text>
            <Pressable onPress={this.props.onClose} style={styles.primary}>
              <Text style={styles.primaryText}>VOLVER AL MENÚ</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

export function TareaModuleModal({ onClose }: Props) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <TareaModuleBoundary onClose={onClose}>
        <NavigationIndependentTree>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="TareaList"
              screenOptions={{
                headerStyle: { backgroundColor: colors.navyDeep },
                headerTintColor: colors.white,
                headerTitleStyle: { fontWeight: '700', color: colors.white },
                headerTitleAlign: 'center',
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen
                name="TareaList"
                component={TareaListScreen}
                options={{
                  title: 'Seguimiento',
                  headerLeft: () => (
                    <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar Seguimiento">
                      <Text style={styles.close}>Cerrar</Text>
                    </Pressable>
                  ),
                }}
              />
              <Stack.Screen name="TareaForm" component={TareaFormScreen} options={{ title: 'Tarea' }} />
            </Stack.Navigator>
          </NavigationContainer>
        </NavigationIndependentTree>
      </TareaModuleBoundary>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.navyDeep },
  card: { width: '100%', maxWidth: 520, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.white },
  logo: { color: colors.orange, fontSize: fontSize.xl, fontWeight: fontWeight.bold as '700', letterSpacing: 1.5 },
  title: { marginTop: spacing.lg, color: colors.navyDeep, fontSize: fontSize.xl, fontWeight: fontWeight.bold as '700' },
  body: { marginTop: spacing.md, color: colors.textMuted, fontSize: fontSize.base, lineHeight: 23 },
  detail: { marginTop: spacing.md, color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
  primary: { minHeight: 54, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.orange },
  primaryText: { color: colors.white, fontWeight: fontWeight.bold as '700', letterSpacing: 1 },
});
