import { UnauthorizedException } from '@nestjs/common'
import { OperationsStore } from '../src/operations.store'
import { hashPassword } from '../src/users.store'

type StoreForTest = {
  findProfileLogin(identifier: string, password: string): Record<string, unknown> | undefined
  login(input: { email: string; password?: string; role: 'company' | 'driver' | 'admin' }): unknown
  profileResponse: jest.Mock
  issueSession: jest.Mock
  db: { prepare: jest.Mock }
  clients: unknown[]
  drivers: unknown[]
}

function makeStore(prepare: jest.Mock): StoreForTest {
  const store = Object.create(OperationsStore.prototype) as StoreForTest
  store.db = { prepare }
  store.profileResponse = jest.fn(() => ({ profile: true }))
  store.issueSession = jest.fn(() => 'profile-token')
  store.clients = []
  store.drivers = []
  return store
}

describe('login de perfiles corporativos', () => {
  it('solo busca perfiles por su usuario, nunca por el correo de la cuenta', () => {
    const profile = {
      id: 'profile-ventas',
      account_id: 'account-1',
      username: 'ventas',
      password_hash: hashPassword('Perfil@2026'),
      status: 'Activo',
      account_status: 'Activo',
      email: 'supervisor@empresa.test',
    }
    const prepare = jest.fn(() => ({ all: () => [profile] }))
    const store = makeStore(prepare)

    expect(store.findProfileLogin('ventas', 'Perfil@2026')).toMatchObject({ id: 'profile-ventas' })
    expect(store.findProfileLogin('supervisor@empresa.test', 'Perfil@2026')).toBeUndefined()
    expect(prepare).toHaveBeenCalledTimes(1)
    const query = String((prepare.mock.calls as unknown as Array<[string]>)[0][0])
    expect(query).toContain('lower(p.username)')
    expect(query).not.toContain('lower(u.email) = ?')
  })

  it('no convierte un correo del supervisor en acceso de perfil si su contraseña falla', () => {
    const supervisor = {
      id: 'account-1',
      name: 'Empresa',
      email: 'supervisor@empresa.test',
      phone: '',
      role: 'corporate',
      status: 'Activo',
      session_state: 'Cerrada',
      password_hash: hashPassword('Supervisor@2026'),
    }
    const prepare = jest.fn(() => ({ get: () => supervisor }))
    const store = makeStore(prepare)
    ;(store as StoreForTest & { findProfileLogin: jest.Mock }).findProfileLogin = jest.fn(() => ({ id: 'profile-ventas' }))

    expect(() => store.login({
      email: 'supervisor@empresa.test',
      password: 'Perfil@2026',
      role: 'company',
    })).toThrow(UnauthorizedException)
    expect(store.profileResponse).not.toHaveBeenCalled()
    expect(store.issueSession).not.toHaveBeenCalled()
  })

  it('rechaza un correo no registrado en lugar de crear una sesión corporativa genérica', () => {
    const prepare = jest.fn(() => ({ get: () => undefined }))
    const store = makeStore(prepare)

    expect(() => store.login({
      email: 'perfil@empresa.test',
      password: 'Perfil@2026',
      role: 'company',
    })).toThrow(UnauthorizedException)
  })
})
