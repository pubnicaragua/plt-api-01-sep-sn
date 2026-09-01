import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type VehicleStatus = 'Disponible' | 'En servicio' | 'Mantenimiento' | 'Fuera de servicio'

export interface Vehicle {
  id: string
  plate: string
  model: string
  type: string
  capacityKg: number
  year: number
  status: VehicleStatus
  driver: string
  lastMaintenance: string
  nextMaintenance: string
  totalTrips: number
}

export interface MaintenanceRecord {
  id: string
  vehicleId: string
  plate: string
  date: string
  description: string
  cost: number
}

interface VehicleRow {
  id: string
  plate: string
  model: string
  type: string
  capacity_kg: number
  year: number
  status: string
  driver: string
  last_maintenance: string
  next_maintenance: string
  total_trips: number
}

interface MaintenanceRow {
  id: string
  vehicle_id: string
  plate: string
  maintenance_date: string
  description: string
  cost: number
}

const VEHICLE_SEED: Array<Omit<Vehicle, 'status'> & { status: VehicleStatus }> = [
  { id: 'vh-001', plate: 'M 123-456', model: 'Ford Transit 2023', type: 'Panel', capacityKg: 1200, year: 2023, status: 'En servicio', driver: 'Juan Pérez', lastMaintenance: '10 Ago 2026', nextMaintenance: '10 Sep 2026', totalTrips: 152 },
  { id: 'vh-002', plate: 'M 234-567', model: 'Nissan NV200 2022', type: 'Panel', capacityKg: 750, year: 2022, status: 'En servicio', driver: 'Roberto Sánchez', lastMaintenance: '18 Ago 2026', nextMaintenance: '18 Sep 2026', totalTrips: 138 },
  { id: 'vh-003', plate: 'M 345-678', model: 'Chevrolet Express 2021', type: 'Van', capacityKg: 900, year: 2021, status: 'En servicio', driver: 'Ana López', lastMaintenance: '22 Ago 2026', nextMaintenance: '22 Sep 2026', totalTrips: 141 },
  { id: 'vh-004', plate: 'M 456-789', model: 'Mercedes Sprinter 2022', type: 'Van', capacityKg: 1400, year: 2022, status: 'Disponible', driver: 'Pedro Ruiz', lastMaintenance: '05 Ago 2026', nextMaintenance: '05 Sep 2026', totalTrips: 96 },
  { id: 'vh-005', plate: 'M 567-890', model: 'Renault Kangoo 2023', type: 'Panel', capacityKg: 650, year: 2023, status: 'Disponible', driver: 'Miguel Torres', lastMaintenance: '28 Jul 2026', nextMaintenance: '28 Ago 2026', totalTrips: 87 },
  { id: 'vh-006', plate: 'M 678-901', model: 'VW Caddy 2020', type: 'Panel', capacityKg: 550, year: 2020, status: 'Mantenimiento', driver: 'Carlos Díaz', lastMaintenance: '25 Ago 2026', nextMaintenance: '25 Sep 2026', totalTrips: 64 },
  { id: 'vh-007', plate: 'M 789-012', model: 'Isuzu NPR 2021', type: 'Camión', capacityKg: 3200, year: 2021, status: 'Disponible', driver: 'Sin asignar', lastMaintenance: '15 Ago 2026', nextMaintenance: '15 Sep 2026', totalTrips: 210 },
  { id: 'vh-008', plate: 'M 890-123', model: 'Hyundai HD65 2022', type: 'Camión', capacityKg: 4000, year: 2022, status: 'Fuera de servicio', driver: 'Sin asignar', lastMaintenance: '01 Ago 2026', nextMaintenance: '01 Sep 2026', totalTrips: 178 },
]

const MAINTENANCE_SEED = [
  { id: 'mt-001', vehicleId: 'vh-006', date: '25 Ago 2026', description: 'Cambio de aceite, frenos y alineación', cost: 220 },
  { id: 'mt-002', vehicleId: 'vh-008', date: '01 Ago 2026', description: 'Reparación de transmisión', cost: 640 },
  { id: 'mt-003', vehicleId: 'vh-001', date: '10 Ago 2026', description: 'Servicio preventivo 10,000 km', cost: 180 },
  { id: 'mt-004', vehicleId: 'vh-003', date: '22 Ago 2026', description: 'Cambio de llantas traseras', cost: 260 },
  { id: 'mt-005', vehicleId: 'vh-004', date: '05 Ago 2026', description: 'Revisión de suspensión y balanceo', cost: 140 },
]

@Injectable()
export class VehiclesStore implements OnModuleDestroy {
  private readonly db: DatabaseSync

  constructor() {
    const databasePath = resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite')
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath, { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        plate TEXT NOT NULL UNIQUE,
        model TEXT NOT NULL,
        type TEXT NOT NULL,
        capacity_kg INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('Disponible', 'En servicio', 'Mantenimiento', 'Fuera de servicio')),
        driver TEXT NOT NULL DEFAULT 'Sin asignar',
        last_maintenance TEXT NOT NULL DEFAULT '',
        next_maintenance TEXT NOT NULL DEFAULT '',
        total_trips INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        plate TEXT NOT NULL,
        maintenance_date TEXT NOT NULL,
        description TEXT NOT NULL,
        cost REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
      CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
      CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id);
    `)
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM vehicles').get() as { count: number }).count)
    if (count === 0) this.seed()
  }

  list() {
    const rows = this.db.prepare("SELECT * FROM vehicles ORDER BY CASE status WHEN 'Disponible' THEN 1 WHEN 'En servicio' THEN 2 WHEN 'Mantenimiento' THEN 3 ELSE 4 END, model").all() as unknown as VehicleRow[]
    return rows.map(toVehicle)
  }

  get(id: string) {
    const row = this.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as unknown as VehicleRow | undefined
    if (!row) throw new NotFoundException('Vehículo no encontrado')
    return toVehicle(row)
  }

  create(input: { plate: string; model: string; type: string; capacityKg: number; year: number }) {
    const duplicate = this.db.prepare('SELECT 1 AS present FROM vehicles WHERE plate = ?').get(input.plate)
    if (duplicate) throw new BadRequestException('Ya existe un vehículo con esa placa')
    const id = `vh-${String(Date.now()).slice(-6)}`
    const now = new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
    this.db.prepare('INSERT INTO vehicles (id, plate, model, type, capacity_kg, year, status, driver, last_maintenance, next_maintenance, total_trips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.plate, input.model, input.type, input.capacityKg, input.year, 'Disponible', 'Sin asignar', now, now, 0)
    return this.get(id)
  }

  updateStatus(id: string, status: VehicleStatus) {
    const vehicle = this.get(id)
    this.db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(status, id)
    return this.get(id)
  }

  assignDriver(id: string, driver: string) {
    const vehicle = this.get(id)
    if (vehicle.status === 'Fuera de servicio' || vehicle.status === 'Mantenimiento') {
      throw new BadRequestException(`El vehículo está en estado ${vehicle.status} y no puede asignarse`)
    }
    this.db.prepare('UPDATE vehicles SET driver = ? WHERE id = ?').run(driver || 'Sin asignar', id)
    return this.get(id)
  }

  registerMaintenance(id: string, description: string, cost: number) {
    const vehicle = this.get(id)
    const now = new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
    const maintenanceId = `mt-${String(Date.now()).slice(-6)}`
    this.db.prepare('INSERT INTO maintenance_records (id, vehicle_id, plate, maintenance_date, description, cost) VALUES (?, ?, ?, ?, ?, ?)')
      .run(maintenanceId, id, vehicle.plate, now, description, cost)
    this.db.prepare('UPDATE vehicles SET status = ?, last_maintenance = ? WHERE id = ?').run('Mantenimiento', now, id)
    return this.maintenanceHistory(id)
  }

  maintenanceHistory(vehicleId?: string) {
    const rows = vehicleId
      ? this.db.prepare('SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY maintenance_date DESC').all(vehicleId)
      : this.db.prepare('SELECT * FROM maintenance_records ORDER BY maintenance_date DESC').all()
    return (rows as unknown as MaintenanceRow[]).map(toMaintenance)
  }

  onModuleDestroy() { this.db.close() }

  private seed() {
    const insertVehicle = this.db.prepare('INSERT INTO vehicles (id, plate, model, type, capacity_kg, year, status, driver, last_maintenance, next_maintenance, total_trips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const vehicle of VEHICLE_SEED) insertVehicle.run(vehicle.id, vehicle.plate, vehicle.model, vehicle.type, vehicle.capacityKg, vehicle.year, vehicle.status, vehicle.driver, vehicle.lastMaintenance, vehicle.nextMaintenance, vehicle.totalTrips)
    const insertMaintenance = this.db.prepare('INSERT INTO maintenance_records (id, vehicle_id, plate, maintenance_date, description, cost) VALUES (?, ?, ?, ?, ?, ?)')
    for (const record of MAINTENANCE_SEED) insertMaintenance.run(record.id, record.vehicleId, this.get(record.vehicleId).plate, record.date, record.description, record.cost)
  }
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    plate: row.plate,
    model: row.model,
    type: row.type,
    capacityKg: row.capacity_kg,
    year: row.year,
    status: row.status as VehicleStatus,
    driver: row.driver,
    lastMaintenance: row.last_maintenance,
    nextMaintenance: row.next_maintenance,
    totalTrips: row.total_trips,
  }
}

function toMaintenance(row: MaintenanceRow): MaintenanceRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    plate: row.plate,
    date: row.maintenance_date,
    description: row.description,
    cost: row.cost,
  }
}