import { OperationsStore } from '../src/operations.store'

type Driver = {
  id: string
  name: string
  phone: string
  vehicle: string
  plate: string
  status: string
}

type StoreForTest = {
  db: { prepare: jest.Mock }
  drivers: Driver[]
  clients: unknown[]
  issueSession: jest.Mock
  login: OperationsStore['login']
}

function makeStore(panelUser: Record<string, unknown>, drivers: Driver[]): StoreForTest {
  const store = Object.create(OperationsStore.prototype) as StoreForTest
  store.drivers = drivers
  store.clients = []
  store.issueSession = jest.fn(() => 'driver-token')
  store.db = {
    prepare: jest.fn((query: string) => {
      if (query.includes('FROM app_users WHERE lower(email)')) return { get: () => panelUser }
      if (query.includes('SELECT session_state')) return { get: () => undefined }
      return { get: () => undefined }
    }),
  }
  return store
}

describe('sesión del conductor', () => {
  it('usa el vehículo del conductor asociado al usuario y no el vehículo demo por defecto', () => {
    const store = makeStore(
      {
        id: 'usr-006',
        name: 'Juan Pérez',
        email: 'juan.perez@incoex.com.ni',
        phone: '8123-4567',
        role: 'driver',
        status: 'Activo',
        password_hash: '',
      },
      [
        {
          id: 'drv-001',
          name: 'Juan Pérez',
          phone: '8123-4567',
          vehicle: 'Ford Transit 2023',
          plate: 'M 123-456',
          status: 'En viaje',
        },
        {
          id: 'drv-006',
          name: 'Carlos Díaz',
          phone: '8678-9012',
          vehicle: 'VW Caddy',
          plate: 'M 678-901',
          status: 'Disponible',
        },
      ],
    )

    const response = store.login({
      email: 'juan.perez@incoex.com.ni',
      role: 'driver',
    }) as { user: { vehicle?: string; plate?: string } }

    expect(response.user.vehicle).toBe('Ford Transit 2023')
    expect(response.user.plate).toBe('M 123-456')
  })
})
