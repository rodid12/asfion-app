import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { MainTabsScreen } from '@/screens/MainTabsScreen';
import { ParicionFormScreen } from '@/screens/pariciones/ParicionFormScreen';
import { ParicionDetailScreen } from '@/screens/pariciones/ParicionDetailScreen';
import { LluviaFormScreen } from '@/screens/lluvias/LluviaFormScreen';
import { MortandadFormScreen } from '@/screens/mortandad/MortandadFormScreen';
import { PastoreoFormScreen } from '@/screens/pastoreo/PastoreoFormScreen';
import { CompraFormScreen } from '@/screens/compras/CompraFormScreen';
import { CompraDetailScreen } from '@/screens/compras/CompraDetailScreen';
import { useAuth } from '@/auth/context';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/colors';
import { TabProvider } from './TabContext';
import { useClientConfig } from '@/config/ClientConfigContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Header global del Stack — consistente con el ScreenHeader de los listados:
//  - bg = navyDeep (mismo color que ScreenHeader → continuidad visual cuando
//    se navega desde una lista a un form o detalle)
//  - title 18px bold blanco
//  - headerBackButtonDisplayMode: 'minimal' → en iOS muestra solo el chevron
//  - headerBackTitle: '' → fallback para versiones viejas
//  - headerTitleAlign: 'center' → centrado tipo iOS estándar
const headerStyle = {
  headerStyle: { backgroundColor: colors.navyDeep },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18, color: colors.white },
  headerTitleAlign: 'center' as const,
  headerBackTitle: '',
  headerBackButtonDisplayMode: 'minimal' as const,
};

export function RootNavigator() {
  const { user, loading } = useAuth();
  const clientConfig = useClientConfig();
  // Helper: solo registramos las rutas de Form de módulos habilitados.
  // Si un cliente tiene solo Pariciones+Lluvias, MortandadForm y PastoreoForm
  // ni siquiera existen en el stack — un nav.navigate('MortandadForm') daría
  // error, lo que está bien porque la UI tampoco ofrece esa navegación.
  const hasModulo = (k: 'pariciones' | 'lluvias' | 'mortandad' | 'pastoreo' | 'compras') =>
    clientConfig.modulosHabilitados.includes(k);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgLight }}>
        <ActivityIndicator color={colors.navy} size="large" />
      </View>
    );
  }

  // TabProvider vive arriba del Stack para que pantallas pusheadas
  // (ej: ParicionForm) puedan leer y cambiar el tab activo con useTabNav
  // al volver atrás.
  return (
    <NavigationContainer>
      <TabProvider initial="menu">
        <Stack.Navigator screenOptions={headerStyle}>
          {user == null ? (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          ) : (
            <>
              {/* MainTabs es la raíz autenticada: aloja los 6 tabs propios */}
              <Stack.Screen
                name="MainTabs"
                component={MainTabsScreen}
                options={{ headerShown: false }}
              />
              {/* Los Form se abren por encima de los tabs con push.
                  Registramos condicionalmente según los módulos del cliente:
                  si Mortandad no está habilitada, MortandadForm no existe
                  en el stack. */}
              {/* Forms y detalles: el title específico ("Nueva parición" /
                  "Editar parición" / etc.) lo setea cada screen con
                  nav.setOptions en su useEffect — ver isEdit en cada Form. */}
              {hasModulo('pariciones') && (
                <>
                  <Stack.Screen name="ParicionDetail" component={ParicionDetailScreen} options={{ title: 'Detalle' }} />
                  <Stack.Screen name="ParicionForm"   component={ParicionFormScreen}   options={{ title: 'Parición' }} />
                </>
              )}
              {hasModulo('lluvias') && (
                <Stack.Screen name="LluviaForm" component={LluviaFormScreen} options={{ title: 'Lluvia' }} />
              )}
              {hasModulo('mortandad') && (
                <Stack.Screen name="MortandadForm" component={MortandadFormScreen} options={{ title: 'Mortandad' }} />
              )}
              {hasModulo('pastoreo') && (
                <Stack.Screen name="PastoreoForm" component={PastoreoFormScreen} options={{ title: 'Pastoreo' }} />
              )}
              {hasModulo('compras') && (
                <>
                  <Stack.Screen name="CompraDetail" component={CompraDetailScreen} options={{ title: 'Detalle' }} />
                  <Stack.Screen name="CompraForm"   component={CompraFormScreen}   options={{ title: 'Compra' }} />
                </>
              )}
            </>
          )}
        </Stack.Navigator>
      </TabProvider>
    </NavigationContainer>
  );
}
