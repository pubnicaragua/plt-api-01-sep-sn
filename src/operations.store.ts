import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Client, Driver, HistoryEvent, Incident, ReportSummary, Trip, TripStatus } from './domain'
import { SettingsStore } from './settings.store'
import { VehiclesStore } from './vehicles.store'

function freshDate(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(date)
}

function formatDateOffset(daysAhead: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(date)
}

function collectOnDay(day: number) {
  const clamped = Math.max(1, Math.min(28, day))
  const now = new Date()
  if (now.getDate() <= clamped) {
    const target = new Date(now.getFullYear(), now.getMonth(), clamped)
    return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(target)
  }
  const target = new Date(now.getFullYear(), now.getMonth() + 1, clamped)
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(target)
}

@Injectable()
export class OperationsStore implements OnModuleDestroy {
  private readonly db: DatabaseSync
  private trips: Trip[]

  constructor(
    private readonly settings: SettingsStore,
    private readonly vehiclesStore: VehiclesStore,
  ) {
    const databasePath = resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite')
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath, { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        client TEXT NOT NULL,
        driver TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        trip_date TEXT NOT NULL,
        packages INTEGER NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        recipient_name TEXT,
        recipient_phone TEXT,
        fragile INTEGER NOT NULL DEFAULT 0
      )
    `)
    this.migrateTrips()
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM trips').get() as { count: number }).count)
    if (count === 0) this.seedTrips()
    else this.ensureSeedTrips()
    this.trips = this.loadTrips()
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        trips INTEGER NOT NULL DEFAULT 0,
        active_requests INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Activo'
      );
      CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        vehicle TEXT NOT NULL DEFAULT '',
        plate TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Disponible',
        route TEXT NOT NULL DEFAULT 'Sin viaje activo',
        latitude REAL NOT NULL DEFAULT 12.114993,
        longitude REAL NOT NULL DEFAULT -86.236174
      );
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        trip TEXT NOT NULL DEFAULT '',
        driver TEXT NOT NULL DEFAULT '',
        client TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'Media',
        status TEXT NOT NULL DEFAULT 'Abierta',
        description TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        evidence TEXT NOT NULL DEFAULT ''
      );
    `)
    this.migrateClients()
    this.migrateIncidents()
    if (Number((this.db.prepare('SELECT COUNT(*) AS count FROM clients').get() as { count: number }).count) === 0) this.seedClients()
    else this.dedupeClients()
    if (Number((this.db.prepare('SELECT COUNT(*) AS count FROM drivers').get() as { count: number }).count) === 0) this.seedDrivers()
    else this.ensureSeedDrivers()
    if (Number((this.db.prepare('SELECT COUNT(*) AS count FROM incidents').get() as { count: number }).count) === 0) this.seedIncidents()
    this.clients = this.loadClients()
    this.drivers = this.loadDrivers()
    this.incidents = this.loadIncidents()
  }

  private readonly tripColumns: Array<[string, string]> = [
    ['origin_lat', 'REAL'],
    ['origin_lng', 'REAL'],
    ['destination_lat', 'REAL'],
    ['destination_lng', 'REAL'],
    ['distance_km', 'REAL NOT NULL DEFAULT 0'],
    ['estimated_cost_cs', 'REAL NOT NULL DEFAULT 0'],
    ['service_type', 'TEXT NOT NULL DEFAULT \'Urbano\''],
    ['contact_name', 'TEXT NOT NULL DEFAULT \'\''],
    ['contact_phone', 'TEXT NOT NULL DEFAULT \'\''],
    ['pickup_time', 'TEXT NOT NULL DEFAULT \'\''],
    ['origin_refs', 'TEXT NOT NULL DEFAULT \'\''],
    ['destination_refs', 'TEXT NOT NULL DEFAULT \'\''],
    ['payment_method', 'TEXT NOT NULL DEFAULT \'\''],
    ['payment_ref', 'TEXT NOT NULL DEFAULT \'\''],
    ['payment_amount', 'REAL NOT NULL DEFAULT 0'],
    ['payment_date', 'TEXT NOT NULL DEFAULT \'\''],
    ['payment_status', 'TEXT NOT NULL DEFAULT \'Sin pagar\''],
    ['due_date', 'TEXT NOT NULL DEFAULT \'\''],
  ]

  private migrateTrips() {
    const existing = new Set((this.db.prepare('PRAGMA table_info(trips)').all() as unknown as Array<{ name: string }>).map((column) => column.name))
    for (const [name, definition] of this.tripColumns) {
      if (!existing.has(name)) this.db.exec(`ALTER TABLE trips ADD COLUMN ${name} ${definition}`)
    }
  }

  private readonly seedData: Trip[] = [
    { id: '#4791', client: 'Logística Nica SA', driver: 'Sin asignar', origin: 'Altamira', destination: 'Carretera Masaya', date: freshDate(0), packages: 5, status: 'Pendiente', originLat: 12.132, originLng: -86.261, destinationLat: 12.115, destinationLng: -86.247, distanceKm: 8.2, estimatedCostCs: 149.7, serviceType: 'Urbano' },
    { id: '#4790', client: 'Farmacias Kielsa', driver: 'Juan Pérez', origin: 'Villa Fontana', destination: 'Las Colinas', date: freshDate(0), packages: 2, status: 'Asignado', originLat: 12.118, originLng: -86.245, destinationLat: 12.129, destinationLng: -86.262, distanceKm: 5.8, estimatedCostCs: 129.3, serviceType: 'Urbano' },
    { id: '#4789', client: 'TecnoPartes Nicaragua', driver: 'Roberto Sánchez', origin: 'Ciudad Jardín', destination: 'Los Robles', date: freshDate(0), packages: 1, status: 'En camino', originLat: 12.145, originLng: -86.238, destinationLat: 12.126, destinationLng: -86.274, distanceKm: 11.4, estimatedCostCs: 176.9, serviceType: 'Express' },
    { id: '#4788', client: 'Distribuidora El Corral', driver: 'Ana López', origin: 'Bello Horizonte', destination: 'San Judas', date: freshDate(0), packages: 8, status: 'En entrega', originLat: 12.136, originLng: -86.279, destinationLat: 12.108, destinationLng: -86.232, distanceKm: 7.6, estimatedCostCs: 144.6, serviceType: 'Urbano' },
    { id: '#4787', client: 'María García', driver: 'Pedro Ruiz', origin: 'Camino de Oriente', destination: 'Linda Vista', date: freshDate(0), packages: 3, status: 'Completado', originLat: 12.101, originLng: -86.218, destinationLat: 12.127, destinationLng: -86.288, distanceKm: 9.3, estimatedCostCs: 159.05, serviceType: 'Urbano' },
    { id: '#4786', client: 'Alimentos NicaFresh', driver: 'Sin asignar', origin: 'Mercado Oriental', destination: 'Sabana Grande', date: freshDate(0), packages: 12, status: 'Pendiente', originLat: 12.129, originLng: -86.207, destinationLat: 12.114, destinationLng: -86.256, distanceKm: 12.8, estimatedCostCs: 188.8, serviceType: 'Programado' },
    { id: '#4785', client: 'Industrias Vega', driver: 'Miguel Torres', origin: 'Plaza Inter', destination: 'Colonia Centroamérica', date: freshDate(1), packages: 4, status: 'Completado', originLat: 12.105, originLng: -86.27, destinationLat: 12.119, destinationLng: -86.242, distanceKm: 6.4, estimatedCostCs: 134.4, serviceType: 'Urbano' },
    { id: '#4784', client: 'Electrónica Plus', driver: 'Carlos Díaz', origin: 'Bolonia', destination: 'Santo Domingo', date: freshDate(1), packages: 2, status: 'Completado', originLat: 12.124, originLng: -86.253, destinationLat: 12.109, destinationLng: -86.231, distanceKm: 4.9, estimatedCostCs: 121.65, serviceType: 'Urbano' },
    { id: '#4783', client: 'Papelería Libélula', driver: 'Sin asignar', origin: 'Rubenia', destination: 'El Paraisito', date: freshDate(0), packages: 2, status: 'Pendiente', originLat: 12.112, originLng: -86.213, destinationLat: 12.098, destinationLng: -86.246, distanceKm: 7.2, estimatedCostCs: 141.2, serviceType: 'Urbano' },
    { id: '#4782', client: 'Café Las Palmas', driver: 'Sin asignar', origin: 'Linda Vista', destination: 'Zumen', date: freshDate(0), packages: 4, status: 'Pendiente', originLat: 12.127, originLng: -86.288, destinationLat: 12.096, destinationLng: -86.262, distanceKm: 10.6, estimatedCostCs: 170.1, serviceType: 'Express' },
    { id: '#4781', client: 'Ferretería El Martillo', driver: 'Sin asignar', origin: 'Los Laureles', destination: 'Ciudad Sandino', date: freshDate(0), packages: 6, status: 'Pendiente', originLat: 12.142, originLng: -86.29, destinationLat: 12.152, destinationLng: -86.343, distanceKm: 13.2, estimatedCostCs: 192.2, serviceType: 'Programado' },
    { id: '#4780', client: 'Clínica San Miguel', driver: 'Pedro Ruiz', origin: 'Plaza España', destination: 'Las Brisas', date: freshDate(1), packages: 3, status: 'Completado', originLat: 12.141, originLng: -86.266, destinationLat: 12.111, destinationLng: -86.257, distanceKm: 4.2, estimatedCostCs: 115.7, serviceType: 'Urbano' },
    { id: '#VJ-2847', client: 'Grupo Emuná', driver: 'Carlos Díaz', origin: 'Incoex, Oficinas', destination: 'km 15 Carretera Veracruz', date: freshDate(0), packages: 4, status: 'Asignado', originLat: 12.122, originLng: -86.249, destinationLat: 12.089, destinationLng: -86.203, distanceKm: 12.4, estimatedCostCs: 162.5, serviceType: 'Urbano', pickupTime: '09:30 AM', contactName: 'María González López', contactPhone: '8888-7654', recipientName: 'María González López', recipientPhone: '8888-7654', description: 'Manejar con cuidado. Contiene material frágil.', fragile: true },
    { id: '#VJ-2848', client: 'Distribuidora El Corral', driver: 'Carlos Díaz', origin: 'Incoex, Oficinas', destination: 'La Loma managua', date: freshDate(0), packages: 2, status: 'Asignado', originLat: 12.126, originLng: -86.244, destinationLat: 12.117, destinationLng: -86.212, distanceKm: 7.9, estimatedCostCs: 143.6, serviceType: 'Urbano', pickupTime: '11:00 AM', contactName: 'Saúl López', contactPhone: '8765-4321' },
    { id: '#VJ-2849', client: 'Alimentos NicaFresh', driver: 'Carlos Díaz', origin: 'Incoex, Oficinas', destination: 'Aeropuerto, managua', date: freshDate(0), packages: 3, status: 'Asignado', originLat: 12.131, originLng: -86.228, destinationLat: 12.140, destinationLng: -86.180, distanceKm: 10.8, estimatedCostCs: 156.3, serviceType: 'Express', pickupTime: '02:30 PM', contactName: 'María García López', contactPhone: '8712-9034' },
    { id: '#VJ-2846', client: 'Electrónica Plus', driver: 'Carlos Díaz', origin: 'Incoex, Oficinas', destination: 'Colonia Centroamérica', date: freshDate(1), packages: 2, status: 'Completado', originLat: 12.118, originLng: -86.256, destinationLat: 12.121, destinationLng: -86.240, distanceKm: 5.2, estimatedCostCs: 128.9, serviceType: 'Urbano', pickupTime: '08:15 AM', contactName: 'Mario Castillo', contactPhone: '8541-0892' },
    { id: '#VJ-2845', client: 'Farmacias Kielsa', driver: 'Carlos Díaz', origin: 'Villa Fontana', destination: 'Plaza España', date: freshDate(2), packages: 1, status: 'Completado', originLat: 12.118, originLng: -86.245, destinationLat: 12.141, destinationLng: -86.266, distanceKm: 3.1, estimatedCostCs: 112.4, serviceType: 'Urbano', pickupTime: '10:05 AM', contactName: 'Ana Osorio', contactPhone: '8622-1147' },
  ]

  private drivers: Driver[] = [
    { id: 'drv-001', name: 'Juan Pérez', phone: '8123-4567', vehicle: 'Ford Transit 2023', plate: 'M 123-456', status: 'En viaje', route: 'Villa Fontana → Las Colinas', latitude: 12.126, longitude: -86.261 },
    { id: 'drv-002', name: 'Roberto Sánchez', phone: '8234-5678', vehicle: 'Nissan NV200', plate: 'M 234-567', status: 'En viaje', route: 'Ciudad Jardín → Los Robles', latitude: 12.112, longitude: -86.246 },
    { id: 'drv-003', name: 'Ana López', phone: '8345-6789', vehicle: 'Chevrolet Express', plate: 'M 345-678', status: 'En entrega', route: 'Bello Horizonte → San Judas', latitude: 12.135, longitude: -86.279 },
    { id: 'drv-004', name: 'Pedro Ruiz', phone: '8456-7890', vehicle: 'Mercedes Sprinter', plate: 'M 456-789', status: 'Disponible', route: 'Sin viaje activo', latitude: 12.121, longitude: -86.244 },
    { id: 'drv-005', name: 'Miguel Torres', phone: '8567-8901', vehicle: 'Renault Kangoo', plate: 'M 567-890', status: 'Disponible', route: 'Sin viaje activo', latitude: 12.102, longitude: -86.268, external: true },
    { id: 'drv-006', name: 'Carlos Díaz', phone: '8678-9012', vehicle: 'VW Caddy', plate: 'M 678-901', status: 'Disponible', route: 'Sin viaje activo', latitude: 12.139, longitude: -86.231 },
    { id: 'drv-007', name: 'José Martínez', phone: '8912-3456', vehicle: 'Toyota Hiace', plate: 'M 890-123', status: 'Disponible', route: 'Sin viaje activo', latitude: 12.116, longitude: -86.239, external: true },
  ]

  private clients: Client[] = [
    { id: 'cli-001', name: 'Logística Nica SA', type: 'Logística Nica SA', phone: '8811-2222', email: 'contacto@logisticanica.com.ni', trips: 45, activeRequests: 2, status: 'Activo' },
    { id: 'cli-002', name: 'Farmacias Kielsa', type: 'Farmacias Kielsa SA', phone: '8833-4444', email: 'ops@kielsa.com.ni', trips: 38, activeRequests: 1, status: 'Activo' },
    { id: 'cli-003', name: 'TecnoPartes Nicaragua', type: 'TecnoPartes SA', phone: '8855-6666', email: 'envios@tecnopartes.com.ni', trips: 22, activeRequests: 1, status: 'Activo' },
    { id: 'cli-004', name: 'Distribuidora El Corral', type: 'Dist. El Corral SA', phone: '8877-8888', email: 'logistica@elcorral.com.ni', trips: 67, activeRequests: 1, status: 'Activo' },
    { id: 'cli-005', name: 'Alimentos NicaFresh', type: 'Alimentos NicaFresh', phone: '8899-0000', email: 'pedidos@nicafresh.com.ni', trips: 28, activeRequests: 1, status: 'Activo' },
  ]

  private incidents: Incident[] = [
    { id: 'INC-0034', trip: '#4778', driver: 'Juan Pérez', client: 'Logística Nica SA', type: 'Retraso', priority: 'Alta', status: 'Abierta' },
    { id: 'INC-0033', trip: '#4783', driver: '—', client: 'Papelería Libélula', type: 'Cliente ausente', priority: 'Media', status: 'Abierta' },
    { id: 'INC-0032', trip: '#4776', driver: 'Carlos Díaz', client: 'Electrónica Plus', type: 'Problema con paquete', priority: 'Alta', status: 'En proceso' },
    { id: 'INC-0031', trip: '#4770', driver: 'Ana López', client: 'Alimentos NicaFresh', type: 'Problema con dirección', priority: 'Media', status: 'En proceso' },
    { id: 'INC-0030', trip: '#4765', driver: 'Roberto Sánchez', client: 'TecnoPartes Nicaragua', type: 'Retraso', priority: 'Baja', status: 'Resuelta' },
  ]

  private readonly history: HistoryEvent[] = [
    { id: 'EVT-001', time: '09:42', date: '27 Ago', type: 'Entrega', title: 'Entrega completada', detail: 'Viaje #4782 · María García · Pedro Ruiz', color: 'mint' },
    { id: 'EVT-002', time: '09:38', date: '27 Ago', type: 'Asignación', title: 'Conductor asignado', detail: 'Viaje #4790 · Farmacias Kielsa · Juan Pérez', color: 'blue' },
    { id: 'EVT-003', time: '09:35', date: '27 Ago', type: 'Solicitud', title: 'Nueva solicitud recibida', detail: 'Solicitud #SR-0125 · Logística Nica SA', color: 'blue' },
    { id: 'EVT-004', time: '09:30', date: '27 Ago', type: 'Incidencia', title: 'Incidencia reportada', detail: 'Viaje #4778 · Retraso en la Pista Juan Pablo II', color: 'gold' },
    { id: 'EVT-005', time: '09:25', date: '27 Ago', type: 'Recogida', title: 'Recogida confirmada', detail: 'Viaje #4785 · 4 paquetes en Plaza Inter', color: 'mint' },
    { id: 'EVT-006', time: '09:20', date: '27 Ago', type: 'Conexión', title: 'Conductor conectado', detail: 'Roberto Sánchez · Nissan NV200', color: 'slate' },
  ]

  private seedClients() {
    const insert = this.db.prepare('INSERT INTO clients (id, name, type, phone, email, address, contact, tax_id, notes, trips, active_requests, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const client of this.clients) insert.run(client.id, client.name, client.type, client.phone, client.email, client.address ?? '', client.contact ?? '', client.taxId ?? '', client.notes ?? '', client.trips, client.activeRequests, client.status)
  }

  private seedIncidents() {
    const insert = this.db.prepare('INSERT INTO incidents (id, trip, driver, client, type, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const incident of this.incidents) insert.run(incident.id, incident.trip, incident.driver, incident.client, incident.type, incident.priority, incident.status)
  }

  private migrateClients() {
    const columns = new Set((this.db.prepare('PRAGMA table_info(clients)').all() as unknown as Array<{ name: string }>).map((column) => column.name))
    if (!columns.has('address')) this.db.exec("ALTER TABLE clients ADD COLUMN address TEXT NOT NULL DEFAULT ''")
    if (!columns.has('contact')) this.db.exec("ALTER TABLE clients ADD COLUMN contact TEXT NOT NULL DEFAULT ''")
    if (!columns.has('tax_id')) this.db.exec("ALTER TABLE clients ADD COLUMN tax_id TEXT NOT NULL DEFAULT ''")
    if (!columns.has('notes')) this.db.exec("ALTER TABLE clients ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
    if (!columns.has('credit_days')) this.db.exec('ALTER TABLE clients ADD COLUMN credit_days INTEGER NOT NULL DEFAULT 0')
    if (!columns.has('due_day')) this.db.exec('ALTER TABLE clients ADD COLUMN due_day INTEGER NOT NULL DEFAULT 0')
    const driverColumns = new Set((this.db.prepare('PRAGMA table_info(drivers)').all() as unknown as Array<{ name: string }>).map((column) => column.name))
    if (!driverColumns.has('email')) this.db.exec("ALTER TABLE drivers ADD COLUMN email TEXT NOT NULL DEFAULT ''")
    if (!driverColumns.has('external')) this.db.exec('ALTER TABLE drivers ADD COLUMN external INTEGER NOT NULL DEFAULT 0')
  }

  private migrateIncidents() {
    const columns = new Set((this.db.prepare('PRAGMA table_info(incidents)').all() as unknown as Array<{ name: string }>).map((column) => column.name))
    if (!columns.has('description')) this.db.exec("ALTER TABLE incidents ADD COLUMN description TEXT NOT NULL DEFAULT ''")
    if (!columns.has('latitude')) this.db.exec('ALTER TABLE incidents ADD COLUMN latitude REAL')
    if (!columns.has('longitude')) this.db.exec('ALTER TABLE incidents ADD COLUMN longitude REAL')
    if (!columns.has('evidence')) this.db.exec("ALTER TABLE incidents ADD COLUMN evidence TEXT NOT NULL DEFAULT ''")
  }

  private dedupeClients() {
    const rows = this.db.prepare('SELECT id, name, email, phone, address, contact, tax_id, notes, type FROM clients ORDER BY rowid ASC').all() as unknown as Array<Record<string, unknown>>
    const kept = new Map<string, string>()
    const duplicateIds: string[] = []
    for (const row of rows) {
      const key = String(row.email ?? '').trim().toLowerCase() || String(row.name ?? '').trim().toLowerCase()
      const existing = kept.get(key)
      if (existing === undefined) {
        kept.set(key, String(row.id))
      } else if (existing !== String(row.id)) {
        const newer = this.db.prepare('UPDATE clients SET phone = COALESCE(NULLIF(?, \'\'), phone), address = COALESCE(NULLIF(?, \'\'), address), contact = COALESCE(NULLIF(?, \'\'), contact), tax_id = COALESCE(NULLIF(?, \'\'), tax_id), notes = COALESCE(NULLIF(?, \'\'), notes) WHERE id = ?')
        newer.run(String(row.phone ?? ''), String(row.address ?? ''), String(row.contact ?? ''), String(row.tax_id ?? ''), String(row.notes ?? ''), existing)
        duplicateIds.push(String(row.id))
      }
    }
    for (const id of duplicateIds) this.db.prepare('DELETE FROM clients WHERE id = ?').run(id)
    if (duplicateIds.length > 0) console.log(`[incoex] ${duplicateIds.length} cliente(s) duplicado(s) fusionados en uno solo`)
  }

  private loadIncidents() {
    const rows = this.db.prepare('SELECT * FROM incidents ORDER BY rowid DESC').all() as unknown as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      trip: String(row.trip),
      driver: String(row.driver),
      client: String(row.client),
      type: String(row.type),
      priority: row.priority as Incident['priority'],
      status: row.status as Incident['status'],
      description: row.description?.toString(),
      latitude: row.latitude === null || row.latitude === undefined ? undefined : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined ? undefined : Number(row.longitude),
      evidence: row.evidence?.toString() || undefined,
    }))
  }

  private loadClients() {
    const rows = this.db.prepare('SELECT * FROM clients ORDER BY name').all() as unknown as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      phone: String(row.phone),
      email: String(row.email),
      address: String(row.address ?? ''),
      contact: String(row.contact ?? ''),
      taxId: String(row.tax_id ?? ''),
      notes: String(row.notes ?? ''),
      trips: Number(row.trips),
      activeRequests: Number(row.active_requests),
      status: row.status as Client['status'],
      creditDays: Number(row.credit_days ?? 0),
      dueDay: Number(row.due_day ?? 0),
    }))
  }

  private seedDrivers() {
    const insert = this.db.prepare('INSERT INTO drivers (id, name, phone, email, vehicle, plate, status, route, latitude, longitude, external) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const driver of this.drivers) insert.run(driver.id, driver.name, driver.phone, driver.email ?? '', driver.vehicle, driver.plate, driver.status, driver.route, driver.latitude, driver.longitude, driver.external ? 1 : 0)
  }

  private ensureSeedDrivers() {
    const exists = this.db.prepare('SELECT 1 AS present FROM drivers WHERE id = ?')
    const insert = this.db.prepare('INSERT INTO drivers (id, name, phone, vehicle, plate, status, route, latitude, longitude, external) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const driver of this.drivers) {
      if (!exists.get(driver.id)) insert.run(driver.id, driver.name, driver.phone, driver.vehicle, driver.plate, driver.status, driver.route, driver.latitude, driver.longitude, driver.external ? 1 : 0)
    }
  }

  private loadDrivers() {
    const rows = this.db.prepare('SELECT * FROM drivers ORDER BY name').all() as unknown as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      phone: String(row.phone),
      email: String(row.email ?? ''),
      vehicle: String(row.vehicle),
      plate: String(row.plate),
      status: row.status as Driver['status'],
      route: String(row.route),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      external: Boolean(row.external ?? 0),
    }))
  }

  private seedTrips() {
    const insert = this.db.prepare('INSERT INTO trips (id, client, driver, origin, destination, trip_date, packages, status, description, recipient_name, recipient_phone, fragile, origin_lat, origin_lng, destination_lat, destination_lng, distance_km, estimated_cost_cs, service_type, contact_name, contact_phone, pickup_time, origin_refs, destination_refs, payment_method, payment_ref, payment_amount, payment_date, payment_status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const trip of [...this.seedData].reverse()) this.writeSeedTrip(insert, trip)
  }

  private ensureSeedTrips() {
    const exists = this.db.prepare('SELECT 1 AS present FROM trips WHERE id = ?')
    const insert = this.db.prepare('INSERT INTO trips (id, client, driver, origin, destination, trip_date, packages, status, description, recipient_name, recipient_phone, fragile, origin_lat, origin_lng, destination_lat, destination_lng, distance_km, estimated_cost_cs, service_type, contact_name, contact_phone, pickup_time, origin_refs, destination_refs, payment_method, payment_ref, payment_amount, payment_date, payment_status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const recentDates = new Set(Array.from({ length: 16 }, (_, offset) => freshDate(offset)))
    const syncSeed = this.db.prepare('UPDATE trips SET trip_date = ?, distance_km = ?, estimated_cost_cs = ? WHERE id = ?')
    for (const trip of [...this.seedData].reverse()) {
      if (exists.get(trip.id)) {
        const row = this.db.prepare('SELECT trip_date, distance_km, estimated_cost_cs FROM trips WHERE id = ?').get(trip.id) as unknown as { trip_date: string; distance_km: number | null; estimated_cost_cs: number | null }
        const staleDate = !recentDates.has(row.trip_date)
        const staleCost = row.estimated_cost_cs === null || Number(row.estimated_cost_cs) !== Number(trip.estimatedCostCs)
        const staleDistance = Number(row.distance_km ?? 0) !== Number(trip.distanceKm ?? 0)
        if (staleDate || staleCost || staleDistance) syncSeed.run(trip.date, trip.distanceKm ?? null, trip.estimatedCostCs ?? null, trip.id)
      } else {
        this.writeSeedTrip(insert, trip)
      }
    }
  }

  private writeSeedTrip(statement: ReturnType<DatabaseSync['prepare']>, trip: Trip) {
    statement.run(trip.id, trip.client, trip.driver, trip.origin, trip.destination, trip.date, trip.packages, trip.status, trip.description ?? null, trip.recipientName ?? null, trip.recipientPhone ?? null, trip.fragile ? 1 : 0, trip.originLat ?? null, trip.originLng ?? null, trip.destinationLat ?? null, trip.destinationLng ?? null, trip.distanceKm ?? null, trip.estimatedCostCs ?? null, trip.serviceType ?? 'Urbano', trip.contactName ?? '', trip.contactPhone ?? '', trip.pickupTime ?? '', trip.originRefs ?? '', trip.destinationRefs ?? '', trip.paymentMethod ?? '', trip.paymentRef ?? '', trip.paymentAmount ?? 0, trip.paymentDate ?? '', trip.paymentStatus ?? 'Sin pagar', trip.dueDate ?? '')
  }

  private loadTrips() {
    const rows = this.db.prepare('SELECT * FROM trips ORDER BY rowid DESC').all() as unknown as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: String(row.id),
      client: String(row.client),
      driver: String(row.driver),
      origin: String(row.origin),
      destination: String(row.destination),
      date: String(row.trip_date),
      packages: Number(row.packages),
      status: row.status as TripStatus,
      description: row.description?.toString(),
      recipientName: row.recipient_name?.toString(),
      recipientPhone: row.recipient_phone?.toString(),
      fragile: Boolean(row.fragile),
      originLat: row.origin_lat === null || row.origin_lat === undefined ? undefined : Number(row.origin_lat),
      originLng: row.origin_lng === null || row.origin_lng === undefined ? undefined : Number(row.origin_lng),
      destinationLat: row.destination_lat === null || row.destination_lat === undefined ? undefined : Number(row.destination_lat),
      destinationLng: row.destination_lng === null || row.destination_lng === undefined ? undefined : Number(row.destination_lng),
      distanceKm: row.distance_km === null || row.distance_km === undefined ? undefined : Number(row.distance_km),
      estimatedCostCs: row.estimated_cost_cs === null || row.estimated_cost_cs === undefined ? undefined : Number(row.estimated_cost_cs),
      serviceType: (row.service_type?.toString() ?? 'Urbano') as Trip['serviceType'],
      contactName: row.contact_name?.toString(),
      contactPhone: row.contact_phone?.toString(),
      pickupTime: row.pickup_time?.toString(),
      originRefs: row.origin_refs?.toString(),
      destinationRefs: row.destination_refs?.toString(),
      paymentMethod: (row.payment_method?.toString() ?? '') as Trip['paymentMethod'],
      paymentRef: row.payment_ref?.toString(),
      paymentAmount: row.payment_amount === undefined || row.payment_amount === null ? undefined : Number(row.payment_amount),
      paymentDate: row.payment_date?.toString(),
      paymentStatus: (row.payment_status?.toString() ?? 'Sin pagar') as Trip['paymentStatus'],
      dueDate: row.due_date?.toString(),
    }))
  }

  private writeTrip(statement: ReturnType<DatabaseSync['prepare']>, trip: Trip) {
    statement.run(trip.id, trip.client, trip.driver, trip.origin, trip.destination, trip.date, trip.packages, trip.status, trip.description ?? null, trip.recipientName ?? null, trip.recipientPhone ?? null, trip.fragile ? 1 : 0)
  }

  private persistTrip(trip: Trip) {
    const update = this.db.prepare('UPDATE trips SET client = ?, driver = ?, origin = ?, destination = ?, trip_date = ?, packages = ?, status = ?, description = ?, recipient_name = ?, recipient_phone = ?, fragile = ?, origin_lat = ?, origin_lng = ?, destination_lat = ?, destination_lng = ?, distance_km = ?, estimated_cost_cs = ?, service_type = ?, contact_name = ?, contact_phone = ?, pickup_time = ?, origin_refs = ?, destination_refs = ?, payment_method = ?, payment_ref = ?, payment_amount = ?, payment_date = ?, payment_status = ?, due_date = ? WHERE id = ?')
    update.run(trip.client, trip.driver, trip.origin, trip.destination, trip.date, trip.packages, trip.status, trip.description ?? null, trip.recipientName ?? null, trip.recipientPhone ?? null, trip.fragile ? 1 : 0, trip.originLat ?? null, trip.originLng ?? null, trip.destinationLat ?? null, trip.destinationLng ?? null, trip.distanceKm ?? null, trip.estimatedCostCs ?? null, trip.serviceType ?? 'Urbano', trip.contactName ?? '', trip.contactPhone ?? '', trip.pickupTime ?? '', trip.originRefs ?? '', trip.destinationRefs ?? '', trip.paymentMethod ?? '', trip.paymentRef ?? '', trip.paymentAmount ?? 0, trip.paymentDate ?? '', trip.paymentStatus ?? 'Sin pagar', trip.dueDate ?? '', trip.id)
  }

  onModuleDestroy() { this.db.close() }

  getSummary() {
    const activeStatuses = ['Asignado', 'En camino', 'En entrega']
    const activeTrips = this.trips.filter((trip) => activeStatuses.includes(trip.status))
    const pendingTrips = this.trips.filter((trip) => trip.status === 'Pendiente').length
    const today = freshDate(0)
    return {
      tripsToday: this.trips.filter((trip) => trip.date === today).length,
      activeTrips: activeTrips.length,
      pendingTrips,
      completedTrips: this.trips.filter((trip) => trip.date === today && trip.status === 'Completado').length,
      activeDrivers: this.drivers.filter((driver) => driver.status !== 'Fuera de servicio').length,
      availableDrivers: this.drivers.filter((driver) => driver.status === 'Disponible').length,
      registeredClients: this.clients.length,
      activeClients: this.clients.filter((client) => client.status === 'Activo').length,
      packagesInTransit: activeTrips.reduce((sum, trip) => sum + trip.packages, 0),
      delayedTrips: this.incidents.filter((incident) => incident.type === 'Retraso' && incident.status !== 'Resuelta').length,
      openIncidents: this.incidents.filter((incident) => incident.status !== 'Resuelta').length,
    }
  }

  listTrips(status?: TripStatus, driver?: string) {
    const driverFiltered = driver && driver !== 'undefined' && driver !== ''
      ? this.trips.filter((trip) => trip.driver.toLowerCase() === driver.toLowerCase())
      : this.trips
    return status ? driverFiltered.filter((trip) => trip.status === status) : driverFiltered
  }
  listDrivers() { return this.drivers }
  listClients() { return this.clients }
  listIncidents() { return this.incidents }
  listHistory() { return this.history }

  createClient(input: { name: string; phone?: string; email?: string; type?: string; address?: string; contact?: string; taxId?: string; notes?: string; creditDays?: number; dueDay?: number }) {
    const email = (input.email ?? '').trim().toLowerCase()
    const name = (input.name ?? '').trim()
    const existing = this.db.prepare('SELECT * FROM clients WHERE email = ? AND email != \'\' ORDER BY rowid ASC LIMIT 1').get(email) ?? this.db.prepare('SELECT * FROM clients WHERE lower(name) = ? ORDER BY rowid ASC LIMIT 1').get(name.toLowerCase())
    if (existing) {
      const row = existing as unknown as Record<string, unknown>
      this.db.prepare('UPDATE clients SET name = ?, type = ?, phone = ?, email = ?, address = ?, contact = ?, tax_id = ?, notes = ?, credit_days = ?, due_day = ? WHERE id = ?')
        .run(name, input.type ?? String(row.type), input.phone ?? String(row.phone), email || String(row.email), input.address ?? String(row.address), input.contact ?? String(row.contact), input.taxId ?? String(row.tax_id), input.notes ?? String(row.notes), input.creditDays ?? Number(row.credit_days ?? 0), input.dueDay ?? Number(row.due_day ?? 0), String(row.id))
      return { ...this.listClients().find((client) => client.id === row.id), existed: true }
    }
    const client: Client = {
      id: `cli-${String(Date.now()).slice(-6)}`,
      name,
      type: input.type ?? name,
      phone: input.phone ?? '',
      email: email || '',
      address: input.address ?? '',
      contact: input.contact ?? '',
      taxId: input.taxId ?? '',
      notes: input.notes ?? '',
      trips: 0,
      activeRequests: 0,
      status: 'Activo',
      creditDays: Math.max(0, Math.round(input.creditDays ?? 0)),
      dueDay: Math.max(0, Math.min(28, Math.round(input.dueDay ?? 0))),
    }
    this.clients.unshift(client)
    this.db.prepare('INSERT INTO clients (id, name, type, phone, email, address, contact, tax_id, notes, credit_days, due_day, trips, active_requests, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(client.id, client.name, client.type, client.phone, client.email, client.address ?? '', client.contact ?? '', client.taxId ?? '', client.notes ?? '', client.creditDays ?? 0, client.dueDay ?? 0, client.trips, client.activeRequests, client.status)
    return client
  }

  updateClient(id: string, input: { phone?: string; email?: string; address?: string; contact?: string; taxId?: string; notes?: string; creditDays?: number; dueDay?: number }) {
    const client = this.clients.find((candidate) => candidate.id === id)
    if (!client) throw new NotFoundException('Cliente no encontrado')
    if (input.phone !== undefined) client.phone = input.phone
    if (input.email !== undefined) client.email = input.email.trim().toLowerCase()
    if (input.address !== undefined) client.address = input.address
    if (input.contact !== undefined) client.contact = input.contact
    if (input.taxId !== undefined) client.taxId = input.taxId
    if (input.notes !== undefined) client.notes = input.notes
    if (input.creditDays !== undefined) client.creditDays = Math.max(0, Math.round(input.creditDays))
    if (input.dueDay !== undefined) client.dueDay = Math.max(0, Math.min(28, Math.round(input.dueDay)))
    this.db.prepare('UPDATE clients SET phone = ?, email = ?, address = ?, contact = ?, tax_id = ?, notes = ?, credit_days = ?, due_day = ? WHERE id = ?')
      .run(client.phone, client.email, client.address ?? '', client.contact ?? '', client.taxId ?? '', client.notes ?? '', client.creditDays ?? 0, client.dueDay ?? 0, id)
    return client
  }

  deleteClient(id: string) {
    const index = this.clients.findIndex((candidate) => candidate.id === id)
    if (index === -1) throw new NotFoundException('Cliente no encontrado')
    this.clients.splice(index, 1)
    this.db.prepare('DELETE FROM clients WHERE id = ?').run(id)
    return { deleted: id }
  }

  createDriver(input: { name: string; phone?: string; email?: string; vehicle?: string; plate?: string; external?: boolean }) {
    const phone = (input.phone ?? '').trim()
    const name = (input.name ?? '').trim()
    const existing = this.db.prepare('SELECT * FROM drivers WHERE phone = ? AND phone != \'\' ORDER BY rowid ASC LIMIT 1').get(phone) ?? this.db.prepare('SELECT * FROM drivers WHERE lower(name) = ? ORDER BY rowid ASC LIMIT 1').get(name.toLowerCase())
    if (existing) {
      const row = existing as unknown as Record<string, unknown>
      this.db.prepare('UPDATE drivers SET name = ?, vehicle = ?, plate = ?, email = ?, external = ? WHERE id = ?')
        .run(name, input.vehicle ?? String(row.vehicle), input.plate ?? String(row.plate), (input.email ?? String(row.email)).trim(), input.external ? 1 : Number(row.external ?? 0), String(row.id))
      const updated = this.listDrivers().find((driver) => driver.id === row.id)
      return updated ? { ...updated, existed: true } : updated
    }
    const driver: Driver = {
      id: `drv-${String(Date.now()).slice(-6)}`,
      name,
      phone,
      email: (input.email ?? '').trim(),
      vehicle: input.vehicle ?? 'Sin vehículo asignado',
      plate: input.plate ?? '—',
      status: 'Disponible',
      route: 'Sin viaje activo',
      latitude: 12.114993 + (this.drivers.length % 3) * 0.01,
      longitude: -86.236174 + (this.drivers.length % 2) * 0.012,
      external: Boolean(input.external),
    }
    this.drivers.push(driver)
    this.db.prepare('INSERT INTO drivers (id, name, phone, email, vehicle, plate, status, route, latitude, longitude, external) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(driver.id, driver.name, driver.phone, driver.email ?? '', driver.vehicle, driver.plate, driver.status, driver.route, driver.latitude, driver.longitude, driver.external ? 1 : 0)
    return driver
  }

  updateDriver(id: string, input: { vehicle?: string; plate?: string; external?: boolean }) {
    const driver = this.drivers.find((candidate) => candidate.id === id)
    if (!driver) throw new NotFoundException('Conductor no encontrado')
    if (input.vehicle !== undefined) driver.vehicle = input.vehicle
    if (input.plate !== undefined) driver.plate = input.plate
    if (input.external !== undefined) driver.external = Boolean(input.external)
    this.db.prepare('UPDATE drivers SET vehicle = ?, plate = ?, external = ? WHERE id = ?')
      .run(driver.vehicle, driver.plate, driver.external ? 1 : 0, id)
    return driver
  }

  deleteDriver(id: string) {
    const index = this.drivers.findIndex((candidate) => candidate.id === id)
    if (index === -1) throw new NotFoundException('Conductor no encontrado')
    const driver = this.drivers[index]
    const inActiveTrip = this.trips.some((trip) => trip.driver === driver.name && ['Asignado', 'En camino', 'En entrega'].includes(trip.status))
    if (inActiveTrip) throw new BadRequestException(`${driver.name} tiene viajes activos; complétalos o cancélalos antes de eliminar`)
    this.drivers.splice(index, 1)
    this.db.prepare('DELETE FROM drivers WHERE id = ?').run(id)
    return { deleted: id }
  }

  deleteTrip(id: string) {
    const normalized = id.startsWith('#') ? id : `#${id}`
    const trip = this.trips.find((candidate) => candidate.id === normalized)
    if (!trip) throw new NotFoundException('Viaje no encontrado')
    if (trip.driver !== 'Sin asignar' && ['Asignado', 'En camino', 'En entrega'].includes(trip.status)) {
      const driver = this.drivers.find((candidate) => candidate.name === trip.driver)
      if (driver) {
        driver.status = 'Disponible'
        driver.route = 'Sin viaje activo'
        this.db.prepare('UPDATE drivers SET status = ?, route = ? WHERE id = ?').run(driver.status, driver.route, driver.id)
      }
    }
    this.trips = this.trips.filter((candidate) => candidate.id !== normalized)
    this.db.prepare('DELETE FROM trips WHERE id = ?').run(normalized)
    return { deleted: normalized }
  }

  createIncident(input: { trip: string; driver: string; client: string; type: string; priority: Incident['priority']; description?: string; latitude?: number; longitude?: number; evidence?: string }) {
    const incident: Incident = {
      id: `INC-${String(Date.now()).slice(-6)}`,
      trip: input.trip,
      driver: input.driver,
      client: input.client,
      type: input.type,
      priority: input.priority,
      status: 'Abierta',
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      evidence: input.evidence,
    }
    this.incidents.unshift(incident)
    this.db.prepare('INSERT INTO incidents (id, trip, driver, client, type, priority, status, description, latitude, longitude, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(incident.id, incident.trip, incident.driver, incident.client, incident.type, incident.priority, incident.status, incident.description ?? '', incident.latitude ?? null, incident.longitude ?? null, incident.evidence ?? '')
    return incident
  }

  updateIncidentStatus(id: string, status: Incident['status']) {
    const incident = this.incidents.find((candidate) => candidate.id === id)
    if (!incident) throw new NotFoundException('Incidencia no encontrada')
    incident.status = status
    this.db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(status, id)
    return incident
  }

  getTrackingOverview() {
    return {
      activeOperations: this.getSummary().activeTrips,
      drivers: this.drivers,
      trips: this.trips.filter((trip) => trip.status !== 'Completado' && trip.status !== 'Cancelado' && trip.status !== 'Anulado'),
      incidents: this.incidents.filter((incident) => incident.status !== 'Resuelta'),
    }
  }

  getReports(): ReportSummary {
    const completed = this.trips.filter((trip) => trip.status === 'Completado')
    const cancelled = this.trips.filter((trip) => trip.status === 'Cancelado' || trip.status === 'Anulado')
    const withDistance = this.trips.filter((trip) => Number.isFinite(trip.distanceKm) && (trip.distanceKm ?? 0) > 0)
    const totalDistanceKm = Number(withDistance.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0).toFixed(1))
    const totalRevenueCs = Number(completed.reduce((sum, trip) => sum + (trip.estimatedCostCs ?? 0), 0).toFixed(2))
    const averageDistanceKm = withDistance.length ? Number((totalDistanceKm / withDistance.length).toFixed(1)) : 0
    const groupByDate = (source: Trip[]) => {
      const counts = new Map<string, number>()
      const order: string[] = []
      for (const trip of source) {
        counts.set(trip.date, (counts.get(trip.date) ?? 0) + 1)
        if (!order.includes(trip.date)) order.push(trip.date)
      }
      const labels = order.slice(0, 5).reverse()
      return { labels, values: labels.map((label) => counts.get(label) ?? 0) }
    }
    const weekly = groupByDate(this.trips)
    const daily = groupByDate(completed)
    const topBy = (selector: (trip: Trip) => string, filter: (trip: Trip) => boolean = () => true) => {
      const counts = new Map<string, number>()
      for (const trip of this.trips.filter(filter)) {
        const key = selector(trip)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, trips]) => ({ name, trips }))
    }
    const vehicleByPlate = new Map(this.vehiclesStore.list().map((vehicle) => [vehicle.plate, vehicle]))
    const vehicleOfTrip = (trip: Trip) => {
      const driver = this.drivers.find((candidate) => candidate.name === trip.driver)
      if (!driver) return null
      return vehicleByPlate.get(driver.plate) ?? null
    }
    const vehicleStats = new Map<string, { plate: string; model: string; trips: number; km: number; incomeCs: number }>()
    const driverStats = new Map<string, { name: string; vehicle: string; trips: number; incomeCs: number }>()
    for (const trip of completed) {
      const vehicle = vehicleOfTrip(trip)
      if (vehicle) {
        const key = vehicle.plate
        const current = vehicleStats.get(key) ?? { plate: vehicle.plate, model: vehicle.model, trips: 0, km: 0, incomeCs: 0 }
        current.trips += 1
        current.km += trip.distanceKm ?? 0
        current.incomeCs += trip.estimatedCostCs ?? 0
        vehicleStats.set(key, current)
      }
      const driver = this.drivers.find((candidate) => candidate.name === trip.driver)
      const current = driverStats.get(trip.driver) ?? { name: trip.driver, vehicle: driver?.vehicle ?? '—', trips: 0, incomeCs: 0 }
      current.trips += 1
      current.incomeCs += trip.estimatedCostCs ?? 0
      driverStats.set(trip.driver, current)
    }
    const topVehicles = Array.from(vehicleStats.values())
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 5)
      .map((vehicle) => ({ ...vehicle, km: Number(vehicle.km.toFixed(1)), incomeCs: Number(vehicle.incomeCs.toFixed(2)) }))
    const driverVehicle = Array.from(driverStats.values())
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 5)
      .map((entry) => ({ ...entry, incomeCs: Number(entry.incomeCs.toFixed(2)) }))
    return {
      totalTrips: this.trips.length,
      completedTrips: completed.length,
      cancelledTrips: cancelled.length,
      averageDistanceKm,
      totalDistanceKm,
      totalRevenueCs,
      weeklyTrips: weekly.values,
      weeklyLabels: weekly.labels,
      dailyDeliveries: daily.values,
      dailyLabels: daily.labels,
      topDrivers: topBy((trip) => trip.driver, (trip) => trip.driver !== 'Sin asignar'),
      topClients: topBy((trip) => trip.client),
      topVehicles,
      driverVehicle,
    }
  }

  createTrip(input: {
    client: string
    origin: string
    destination: string
    packages: number
    description?: string
    recipientName?: string
    recipientPhone?: string
    fragile?: boolean
    originLat?: number
    originLng?: number
    destinationLat?: number
    destinationLng?: number
    distanceKm?: number
    serviceType?: 'Urbano' | 'Express' | 'Programado'
    transport?: 'Moto' | 'Vehículo' | 'Camión'
    autoAssign?: boolean
    contactName?: string
    contactPhone?: string
    originRefs?: string
    destinationRefs?: string
  }) {
    const nextNumber = 4792 + this.trips.length
    const distanceKm = Math.max(0, input.distanceKm ?? 0)
    const rate = this.settings.getVehicleRate(input.transport ?? 'Vehículo')
    const estimatedCostCs = Number((rate.baseFeeCs + distanceKm * rate.farePerKmCs).toFixed(2))
    const clientAccount = this.clients.find((candidate) => candidate.name.toLowerCase() === (input.client ?? '').toLowerCase())
    const dueDate = clientAccount && ((clientAccount.creditDays ?? 0) > 0 || (clientAccount.dueDay ?? 0) > 0)
      ? ((clientAccount.creditDays ?? 0) > 0 ? formatDateOffset(clientAccount.creditDays!) : collectOnDay(clientAccount.dueDay!))
      : ''
    const trip: Trip = {
      id: `#${nextNumber}`,
      client: input.client,
      driver: 'Sin asignar',
      origin: input.origin,
      destination: input.destination,
      date: new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(new Date()),
      packages: input.packages,
      status: 'Pendiente',
      description: input.description,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      fragile: input.fragile,
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      distanceKm,
      estimatedCostCs,
      serviceType: input.serviceType ?? 'Urbano',
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      originRefs: input.originRefs,
      destinationRefs: input.destinationRefs,
      paymentStatus: 'Sin pagar',
      dueDate,
    }
    this.trips.unshift(trip)
    const insert = this.db.prepare('INSERT INTO trips (id, client, driver, origin, destination, trip_date, packages, status, description, recipient_name, recipient_phone, fragile, origin_lat, origin_lng, destination_lat, destination_lng, distance_km, estimated_cost_cs, service_type, contact_name, contact_phone, pickup_time, origin_refs, destination_refs, payment_method, payment_ref, payment_amount, payment_date, payment_status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run(trip.id, trip.client, trip.driver, trip.origin, trip.destination, trip.date, trip.packages, trip.status, trip.description ?? null, trip.recipientName ?? null, trip.recipientPhone ?? null, trip.fragile ? 1 : 0, trip.originLat ?? null, trip.originLng ?? null, trip.destinationLat ?? null, trip.destinationLng ?? null, trip.distanceKm ?? null, trip.estimatedCostCs ?? null, trip.serviceType ?? 'Urbano', trip.contactName ?? '', trip.contactPhone ?? '', trip.pickupTime ?? '', trip.originRefs ?? '', trip.destinationRefs ?? '', trip.paymentMethod ?? '', trip.paymentRef ?? '', trip.paymentAmount ?? 0, trip.paymentDate ?? '', trip.paymentStatus ?? 'Sin pagar', trip.dueDate ?? '')
    if (input.autoAssign) {
      this.assignAutomatically(trip)
    }
    return trip
  }

  updateTripPayment(id: string, input: { method?: Trip['paymentMethod']; ref?: string; amount?: number; date?: string; dueDate?: string }) {    const trip = this.getTrip(id)
    if (input.method !== undefined) trip.paymentMethod = input.method
    if (input.ref !== undefined) trip.paymentRef = input.ref
    if (input.amount !== undefined) trip.paymentAmount = Math.max(0, Number(input.amount) || 0)
    if (input.date !== undefined) trip.paymentDate = input.date
    if (input.dueDate !== undefined) trip.dueDate = input.dueDate
    const expected = trip.estimatedCostCs ?? 0
    if ((trip.paymentAmount ?? 0) >= expected && expected > 0) trip.paymentStatus = 'Pagado'
    else if ((trip.paymentAmount ?? 0) > 0) trip.paymentStatus = 'Parcial'
    else trip.paymentStatus = 'Sin pagar'
    this.persistTrip(trip)
    return trip
  }

  updateTripFare(id: string, amount: number) {
    const trip = this.getTrip(id)
    trip.estimatedCostCs = Math.max(0, Number(amount) || 0)
    const expected = trip.estimatedCostCs
    if ((trip.paymentAmount ?? 0) >= expected && expected > 0) trip.paymentStatus = 'Pagado'
    else if ((trip.paymentAmount ?? 0) > 0) trip.paymentStatus = 'Parcial'
    else trip.paymentStatus = 'Sin pagar'
    this.persistTrip(trip)
    return trip
  }

  private assignAutomatically(trip: Trip) {
    const preferred = ['Carlos Díaz', 'José Martínez', 'Juan Pérez']
    const driver =
      this.drivers.find((candidate) => preferred.includes(candidate.name) && candidate.status === 'Disponible')
      ?? this.drivers.find((candidate) => candidate.status === 'Disponible')
    if (!driver) return
    trip.driver = driver.name
    trip.status = 'Asignado'
    driver.status = 'En viaje'
    driver.route = `${trip.origin} → ${trip.destination}`
    this.persistTrip(trip)
    this.db.prepare('UPDATE drivers SET status = ?, route = ? WHERE id = ?').run(driver.status, driver.route, driver.id)
  }

  login(input: { email: string; role: 'company' | 'driver' | 'admin' }) {
    const normalized = input.email.trim().toLowerCase()
    const demoDrivers: Record<string, string> = {
      'carlos.diaz@incoex.com.ni': 'drv-006',
      'jose.martinez@incoex.com.ni': 'drv-007',
      'conductor@incoex.com.ni': 'drv-006',
    }
    const driverId = input.role === 'driver' ? (demoDrivers[normalized] ?? 'drv-006') : undefined
    const driver = driverId ? this.drivers.find((candidate) => candidate.id === driverId) : undefined
    return {
      accessToken: 'prototype-token-replace-before-production',
      user: {
        id: driver?.id ?? (input.role === 'company' ? 'cli-001' : 'admin-001'),
        email: input.email,
        role: input.role,
        displayName: driver?.name ?? (input.role === 'driver' ? 'Carlos Díaz' : input.role === 'company' ? 'Mario Martínez' : 'Mario Martínez'),
        vehicle: driver?.vehicle,
        plate: driver?.plate,
        phone: driver?.phone,
      },
    }
  }

  register(input: { name: string; companyName: string; email: string; role: 'company' | 'driver' }) {
    return {
      accessToken: 'prototype-token-replace-before-production',
      user: {
        id: `${input.role}-${Date.now()}`,
        email: input.email,
        role: input.role,
        displayName: input.name,
      },
      profile: {
        name: input.name,
        companyName: input.companyName,
      },
    }
  }

  getTrip(id: string) {
    const trip = this.trips.find((candidate) => candidate.id === id || candidate.id === `#${id.replace('#', '')}`)
    if (!trip) throw new NotFoundException('Viaje no encontrado')
    return trip
  }

  assignTrip(id: string, driverId: string) {
    const trip = this.getTrip(id)
    const driver = this.drivers.find((candidate) => candidate.id === driverId)
    if (!driver) throw new NotFoundException('Conductor no encontrado')
    if (driver.status === 'Fuera de servicio') {
      throw new BadRequestException('El conductor está fuera de servicio')
    }
    trip.driver = driver.name
    trip.status = 'Asignado'
    driver.status = 'En viaje'
    driver.route = `${trip.origin} → ${trip.destination}`
    this.persistTrip(trip)
    return trip
  }

  getTracking(id: string) {
    const trip = this.getTrip(id)
    const route = []
    if (Number.isFinite(trip.originLat) && Number.isFinite(trip.originLng) && Number.isFinite(trip.destinationLat) && Number.isFinite(trip.destinationLng)) {
      route.push(
        { latitude: Number(trip.originLat), longitude: Number(trip.originLng), label: 'Recogida' },
        { latitude: (Number(trip.originLat) + Number(trip.destinationLat)) / 2, longitude: (Number(trip.originLng) + Number(trip.destinationLng)) / 2, label: 'En tránsito' },
        { latitude: Number(trip.destinationLat), longitude: Number(trip.destinationLng), label: 'Destino' },
      )
    } else {
      route.push(
        { latitude: 12.128, longitude: -86.264, label: 'Centro de distribución' },
        { latitude: 12.121, longitude: -86.253, label: 'En tránsito' },
        { latitude: 12.114, longitude: -86.244, label: 'Destino' },
      )
    }
    return {
      tripId: trip.id,
      status: trip.status,
      driver: trip.driver,
      lastUpdate: new Date().toISOString(),
      distanceKm: trip.distanceKm ?? 0,
      estimatedCostCs: trip.estimatedCostCs ?? 0,
      route,
    }
  }

  private readonly allowedTransitions: Record<TripStatus, TripStatus[]> = {
    Pendiente: ['Asignado', 'Cancelado', 'Anulado'],
    Asignado: ['En camino', 'Cancelado', 'Anulado'],
    'En camino': ['En entrega', 'Cancelado', 'Anulado'],
    'En entrega': ['Completado', 'Cancelado', 'Anulado'],
    Completado: ['Anulado'],
    Cancelado: [],
    Anulado: [],
  }

  updateTripStatus(id: string, status: TripStatus) {
    const trip = this.getTrip(id)
    if (status === trip.status) return trip
    const allowed = this.allowedTransitions[trip.status]
    if (!allowed.includes(status)) {
      throw new BadRequestException(`No se puede pasar el viaje de ${trip.status} a ${status}`)
    }
    if ((status === 'Cancelado' || status === 'Anulado') && trip.driver !== 'Sin asignar') {
      const driver = this.drivers.find((candidate) => candidate.name === trip.driver)
      if (driver) {
        driver.status = 'Disponible'
        driver.route = 'Sin viaje activo'
      }
    }
    trip.status = status
    this.persistTrip(trip)
    return trip
  }

  exportCsv(collection: 'trips' | 'drivers' | 'clients' | 'incidents' | 'packages') {
    const escape = (value: string | number) => {
      const text = String(value).replaceAll('"', '""')
      return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text}"` : text
    }
    const rows: string[] = []
    if (collection === 'trips') {
      rows.push('ID,Cliente,Conductor,Origen,Destino,Fecha,Paquetes,Estado,DistanciaKm,CostoEstimadoCs,TipoServicio')
      for (const trip of this.trips) rows.push([trip.id, trip.client, trip.driver, trip.origin, trip.destination, trip.date, trip.packages, trip.status, trip.distanceKm ?? '', trip.estimatedCostCs ?? '', trip.serviceType ?? 'Urbano'].map(escape).join(','))
    } else if (collection === 'drivers') {
      rows.push('ID,Nombre,Teléfono,Vehículo,Placa,Estado,Ruta')
      for (const driver of this.drivers) rows.push([driver.id, driver.name, driver.phone, driver.vehicle, driver.plate, driver.status, driver.route].map(escape).join(','))
    } else if (collection === 'clients') {
      rows.push('ID,Nombre,Tipo,Teléfono,Email,Viajes,SolicitudesActivas,Estado')
      for (const client of this.clients) rows.push([client.id, client.name, client.type, client.phone, client.email, client.trips, client.activeRequests, client.status].map(escape).join(','))
    } else if (collection === 'incidents') {
      rows.push('ID,Viaje,Conductor,Cliente,Tipo,Prioridad,Estado')
      for (const incident of this.incidents) rows.push([incident.id, incident.trip, incident.driver, incident.client, incident.type, incident.priority, incident.status].map(escape).join(','))
    } else if (collection === 'packages') {
      rows.push('Guia,Viaje,Cliente,PesoKg,Dimensiones,Estado')
      let index = 1
      for (const trip of this.trips) {
        for (let packageIndex = 1; packageIndex <= Math.min(trip.packages, 3); packageIndex += 1) {
          const id = `PKG-${trip.id.replace('#', '')}-${packageIndex}`
          const weightKg = (1 + ((trip.packages + packageIndex) % 24)).toFixed(1)
          const dimensions = `${30 + packageIndex * 5}×${20 + packageIndex * 4}×${15 + packageIndex * 3} cm`
          rows.push([id, trip.id, trip.client, weightKg, dimensions, trip.status].map(escape).join(','))
          index += 1
        }
      }
    }
    return rows.join('\n')
  }
}
