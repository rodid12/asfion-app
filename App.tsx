// Root de la app. Orden de providers importa:
//   SafeAreaProvider → RepositoryProvider → ClientConfigProvider → NetworkProvider → AuthProvider → RootNavigator
//
// Antes ClientConfigProvider iba lo más afuera posible, pero al hacer el
// rewrite a runtime fetch (post-multi-cliente) ahora depende del
// RepositoryProvider para llamar a repo.getClienteConfig() — por eso el
// orden está invertido: Repository PRIMERO, luego ClientConfig.
//
// AuthProvider sigue dependiendo del Repository para hacer login.

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
        <RepositoryProvider kind="supabase">
          <ClientConfigProvider>
            <NetworkProvider>
              <AuthProvider>
                <RootNavigator />
                <StatusBar style="light" />
              </AuthProvider>
            </NetworkProvider>
          </ClientConfigProvider>
        </RepositoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
