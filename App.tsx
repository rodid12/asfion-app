// Root de la app. Orden de providers importa:
//   SafeAreaProvider → ClientConfigProvider → RepositoryProvider → AuthProvider → RootNavigator
//
// ClientConfigProvider va lo más afuera posible (después de Safe Area) para
// que TODO el árbol pueda leer la config del cliente — branding, módulos
// habilitados, catálogos.
//
// El RepositoryProvider va antes de AuthProvider porque AuthProvider depende
// del repositorio para hacer login.

import 'react-native-get-random-values'; // polyfill para uuid en RN
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ClientConfigProvider } from '@/config/ClientConfigContext';
import { RepositoryProvider } from '@/data';
import { NetworkProvider } from '@/data/network';
import { AuthProvider } from '@/auth/context';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClientConfigProvider>
          <RepositoryProvider kind="supabase">
            <NetworkProvider>
              <AuthProvider>
                <RootNavigator />
                <StatusBar style="light" />
              </AuthProvider>
            </NetworkProvider>
          </RepositoryProvider>
        </ClientConfigProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
