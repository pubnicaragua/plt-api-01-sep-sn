import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(12).toString('hex')
  const hash = scryptSync(password, salt, 48).toString('hex')
  return `${salt}.${hash}`
}

export type UserRole =
  | 'admin'
  | 'management'
  | 'operations'
  | 'finance'
  | 'support'
  | 'driver'
  | 'corporate'
  | 'store'

export interface Role {
  code: UserRole
  name: string
  description: string
  permissions: string[]
}

export interface AppUser {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  roleName: string
  status: 'Activo' | 'Inactivo'
  lastLogin: string
}

interface UserRow {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  last_login: string
}

export const ROLES: Role[] = [
  { code: 'admin', name: 'Rol 01 · Administrador General', description: 'Usuarios, roles, clientes, conductores, vehículos, solicitudes, pagos, incidencias, tarifas, reportes y auditoría.', permissions: ['*'] },
  { code: 'management', name: 'Rol 02 · Gerencia', description: 'Consulta y exportación de dashboard, operación, costos, pagos, incidencias y reportes sin mutaciones sensibles.', permissions: ['dashboard:read', 'reports:read', 'reports:export', 'trips:read', 'incidents:read', 'finance:read'] },
  { code: 'operations', name: 'Rol 03 · Operaciones o Despacho', description: 'Solicitudes, validación operativa, asignaciones, tracking, estados, retrasos y cancelaciones autorizadas.', permissions: ['trips:read', 'trips:create', 'trips:assign', 'trips:update', 'tracking:read', 'drivers:read', 'vehicles:read'] },
  { code: 'finance', name: 'Rol 04 · Finanzas o Caja', description: 'Montos, saldos, pagos, parciales, comprobantes, crédito, contra factura y reportes financieros.', permissions: ['finance:read', 'finance:write', 'reports:read', 'reports:export', 'clients:read'] },
  { code: 'support', name: 'Rol 05 · Soporte', description: 'Casos, mensajes, adjuntos, solicitudes de evidencia, escalamiento, resolución y cierre.', permissions: ['incidents:read', 'incidents:update', 'trips:read', 'chat:read', 'chat:write'] },
  { code: 'driver', name: 'Rol 06 · Conductor', description: 'Servicios disponibles y asignados, estados, ubicación, incidencias, evidencias y confirmación de entrega.', permissions: ['trips:assigned:read', 'trips:status:update', 'tracking:position:write', 'incidents:create', 'delivery:evidence:write'] },
  { code: 'corporate', name: 'Rol 07 · Usuario Corporativo', description: 'Solicitudes, direcciones, cotizaciones, pagos reportados, tracking, comprobantes y soporte de su empresa.', permissions: ['trips:create', 'trips:own:read', 'tracking:own:read', 'payments:own:read', 'support:create'] },
  { code: 'store', name: 'Rol 08 · Tienda o Recepción', description: 'Recepciones, validación física, peso, dimensiones, fotografías, observaciones e historial de carga.', permissions: ['trips:read', 'delivery:validate:write', 'packages:update', 'evidence:write'] },
]

const USER_SEED: Array<{ id: string; name: string; email: string; phone: string; role: UserRole; status: 'Activo' | 'Inactivo'; lastLogin: string }> = [
  { id: 'usr-001', name: 'Mario Martínez', email: 'mario.martinez@incoex.com.ni', phone: '8888-0001', role: 'admin', status: 'Activo', lastLogin: '01 Sep 2026 · 08:12' },
  { id: 'usr-002', name: 'Iliana Gutiérrez', email: 'iliana.gutierrez@incoex.com.ni', phone: '8888-0002', role: 'management', status: 'Activo', lastLogin: '01 Sep 2026 · 07:45' },
  { id: 'usr-003', name: 'Despacho Central', email: 'despacho@incoex.com.ni', phone: '8888-0003', role: 'operations', status: 'Activo', lastLogin: '01 Sep 2026 · 06:58' },
  { id: 'usr-004', name: 'Caja y Finanzas', email: 'finanzas@incoex.com.ni', phone: '8888-0004', role: 'finance', status: 'Activo', lastLogin: '31 Ago 2026 · 17:30' },
  { id: 'usr-005', name: 'Mesa de Ayuda', email: 'soporte@incoex.com.ni', phone: '8888-0005', role: 'support', status: 'Activo', lastLogin: '01 Sep 2026 · 08:02' },
  { id: 'usr-006', name: 'Juan Pérez', email: 'juan.perez@incoex.com.ni', phone: '8123-4567', role: 'driver', status: 'Activo', lastLogin: '01 Sep 2026 · 06:40' },
  { id: 'usr-007', name: 'Logística Nica SA', email: 'contacto@logisticanica.com.ni', phone: '8811-2222', role: 'corporate', status: 'Activo', lastLogin: '31 Ago 2026 · 15:22' },
  { id: 'usr-008', name: 'Recepción Plaza Inter', email: 'recepcion.plaza@incoex.com.ni', phone: '8888-0008', role: 'store', status: 'Activo', lastLogin: '31 Ago 2026 · 13:10' },
  { id: 'usr-009', name: 'Carlos Díaz', email: 'carlos.diaz@incoex.com.ni', phone: '8678-9012', role: 'driver', status: 'Inactivo', lastLogin: '28 Ago 2026 · 18:05' },
]

@Injectable()
export class UsersStore implements OnModuleDestroy {
  private readonly db: DatabaseSync

  constructor() {
    const databasePath = resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite')
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath, { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL CHECK (role IN ('admin', 'management', 'operations', 'finance', 'support', 'driver', 'corporate', 'store')),
        status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo')),
        last_login TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_users_role ON app_users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON app_users(status);
    `)
    const userColumns = new Set((this.db.prepare('PRAGMA table_info(app_users)').all() as unknown as Array<{ name: string }>).map((column) => column.name))
    if (!userColumns.has('password_hash')) this.db.exec("ALTER TABLE app_users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM app_users').get() as { count: number }).count)
    if (count === 0) this.seed()
  }

  listUsers() {
    const rows = this.db.prepare('SELECT * FROM app_users ORDER BY status DESC, name').all() as unknown as UserRow[]
    return rows.map(toUser)
  }

  listRoles() {
    return ROLES
  }

  createUser(input: { name: string; email: string; phone?: string; role: UserRole; password?: string }) {
    const existing = this.db.prepare('SELECT id FROM app_users WHERE email = ?').get(input.email)
    if (existing) {
      this.db.prepare('UPDATE app_users SET name = ?, phone = ?, role = ? WHERE email = ?')
        .run(input.name, input.phone ?? '', input.role, input.email)
      return this.getUser(String((existing as { id: string }).id))
    }
    const id = `usr-${String(Date.now()).slice(-6)}`
    this.db.prepare('INSERT INTO app_users (id, name, email, phone, role, status, last_login, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.name, input.email, input.phone ?? '', input.role, 'Activo', 'Sin accesos registrados', hashPassword(input.password ?? 'Incoex2026'))
    return this.getUser(id)
  }

  updateUser(id: string, input: { role?: UserRole; status?: 'Activo' | 'Inactivo'; password?: string }) {
    const user = this.getUser(id)
    if (input.role && !ROLES.some((role) => role.code === input.role)) {
      throw new BadRequestException('Rol no válido')
    }
    if (input.password) {
      this.db.prepare('UPDATE app_users SET password_hash = ? WHERE id = ?').run(hashPassword(input.password), id)
    }
    this.db.prepare('UPDATE app_users SET role = ?, status = ? WHERE id = ?')
      .run(input.role ?? user.role, input.status ?? user.status, id)
    return this.getUser(id)
  }

  getUser(id: string) {
    const row = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(id) as unknown as UserRow | undefined
    if (!row) throw new NotFoundException('Usuario no encontrado')
    return toUser(row)
  }

  deleteUser(id: string) {
    if (id === 'usr-001') throw new BadRequestException('El administrador principal no puede eliminarse')
    const user = this.getUser(id)
    this.db.prepare('DELETE FROM app_users WHERE id = ?').run(id)
    return { deleted: id, name: user.name }
  }

  onModuleDestroy() { this.db.close() }

  private seed() {
    const insert = this.db.prepare('INSERT INTO app_users (id, name, email, phone, role, status, last_login) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const user of USER_SEED) insert.run(user.id, user.name, user.email, user.phone, user.role, user.status, user.lastLogin)
  }
}

function toUser(row: UserRow): AppUser {
  const role = ROLES.find((candidate) => candidate.code === row.role) ?? ROLES[0]
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role as UserRole,
    roleName: role.name,
    status: row.status as 'Activo' | 'Inactivo',
    lastLogin: row.last_login,
  }
}