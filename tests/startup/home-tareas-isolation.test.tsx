import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
// Estas promesas quedan pendientes a propósito: el objetivo del smoke test es
// demostrar que el menú puede renderizarse y abrir Seguimiento sin depender de
// la actualización asíncrona de estadísticas del inicio.
const mockListPending = jest.fn(() => new Promise<never>(() => undefined));
const mockContarPariciones = jest.fn(() => new Promise<never>(() => undefined));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, addListener: mockAddListener }),
}));

jest.mock('@/auth/context', () => ({
  useAuth: () => ({
    user: { email: 'zoe@carahuasi.test', nombre: 'Zoe', rol: 'administrador' },
    logout: jest.fn(),
    isSuperAdmin: false,
    mostrarSelectorClientes: jest.fn(),
  }),
}));

jest.mock('@/data', () => ({
  useRepository: () => ({ listPending: mockListPending, contarPariciones: mockContarPariciones }),
}));

jest.mock('@/config/ClientConfigContext', () => ({
  useClientConfig: () => ({
    id: 'estancia-carahuasi',
    branding: { nombre: 'Estancia Carahuasi', tagline: 'Gestión integral del campo', logo: null },
    // La bandera remota permanece apagada para proteger versiones antiguas.
    // La versión nueva debe ofrecer Seguimiento por ser Carahuasi.
    modulosHabilitados: ['pariciones'],
    catalogos: {},
  }),
}));

jest.mock('@/navigation/TabContext', () => ({
  useTabNav: () => ({ currentTab: 'menu', switchTab: jest.fn() }),
}));

jest.mock('@/components/StatCard', () => ({ StatCard: () => null }));
jest.mock('@/components/LegalLinks', () => ({ LegalLinks: () => null }));

const mockTaskModuleLoaded = jest.fn();
jest.mock('@/screens/tareas/TareaModuleModal', () => {
  mockTaskModuleLoaded();
  return {
    TareaModuleModal: ({ onClose }: { onClose: () => void }) => {
      const { Pressable, Text } = require('react-native');
      return <Pressable onPress={onClose}><Text>Módulo Seguimiento abierto</Text></Pressable>;
    },
  };
});

import { HomeScreen } from '@/screens/HomeScreen';

describe('arranque de Carahuasi con Seguimiento habilitado', () => {
  it('muestra el menú sin evaluar el módulo y lo carga recién al tocar Seguimiento', async () => {
    const screen = render(<HomeScreen />);

    expect(screen.getByText('Seguimiento')).toBeTruthy();
    expect(screen.queryByText('PRÓXIMAMENTE')).toBeNull();
    expect(mockTaskModuleLoaded).not.toHaveBeenCalled();
    await waitFor(() => expect(mockContarPariciones).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Seguimiento'));

    expect(mockTaskModuleLoaded).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Módulo Seguimiento abierto')).toBeTruthy();
  });
});
