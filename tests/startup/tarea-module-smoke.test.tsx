import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockListTareas = jest.fn(async () => []);
const mockListOperariosTareas = jest.fn(async () => []);
const mockSubscribeTareas = jest.fn(() => jest.fn());
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  NavigationIndependentTree: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: undefined }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: ({ name, component: Component }: { name: string; component: React.ComponentType }) =>
      name === 'TareaList' ? <Component /> : null,
  }),
}));

jest.mock('@/auth/context', () => ({
  useAuth: () => ({ user: { email: 'zoe@carahuasi.test', nombre: 'Zoe', rol: 'administrador' } }),
}));

jest.mock('@/data', () => ({
  useRepository: () => ({
    listTareas: mockListTareas,
    listOperariosTareas: mockListOperariosTareas,
    subscribeTareas: mockSubscribeTareas,
    listTareaHistorial: jest.fn(async () => []),
    saveTareaAdmin: jest.fn(),
    informarTarea: jest.fn(),
    eliminarTarea: jest.fn(),
  }),
}));

import { TareaModuleModal } from '@/screens/tareas/TareaModuleModal';

describe('módulo Seguimiento aislado', () => {
  it('abre su navegador propio y carga una lista vacía sin afectar la aplicación', async () => {
    const onClose = jest.fn();
    const screen = render(<TareaModuleModal onClose={onClose} />);

    await waitFor(() => expect(mockListTareas).toHaveBeenCalled());
    expect(screen.getByText('Sin tareas')).toBeTruthy();

    act(() => screen.unmount());
  });
});
