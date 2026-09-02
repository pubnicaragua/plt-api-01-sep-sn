import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type VehicleStatus = 'Disponible' | 'En servicio' | 'Mantenimiento' | 'Fuera de servicio'
export type FuelType = 'Gasolina' | 'Diésel' | 'Eléctrico' | 'Híbrido'
export type VehicleFunction = 'privado' | 'delivery' | 'camion' | ''

export interface VehicleFinancing {
  financed: boolean
  downPaymentCs: number
  leaseStart: string
  leaseTermMonths: number
  leaseMonthlyPaymentCs: number
  residualValueCs: number
  depreciationPct: number
  monthsElapsed: number
  monthsRemaining: number
  totalPaidCs: number
  remainingDebtCs: number
  monthlyDepreciationCs: number
  annualDepreciationCs: number
  monthlyCostCs: number
  financingLabel: string
}

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
  fuelType: FuelType
  consumptionLPerKm: number
  priceCs: number
  odometerKm: number
  imageUrl: string
  external?: boolean
  vehicleFunction: VehicleFunction
  logistics: string
  minTripsMonth: number
  fuelPriceCs: number
  tankCapacityL: number
  financing: VehicleFinancing
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
  fuel_type: string
  consumption_l_per_km: number
  price_cs: number
  odometer_km: number
  image_url: string
  external: number
  vehicle_function: string
  logistics: string
  min_trips_month: number
  financed: number
  down_payment_cs: number
  lease_start: string
  lease_term_months: number
  lease_monthly_payment_cs: number
  residual_value_cs: number
  depreciation_pct: number
  fuel_price_cs: number
  tank_capacity_l: number
}

interface MaintenanceRow {
  id: string
  vehicle_id: string
  plate: string
  maintenance_date: string
  description: string
  cost: number
}

const VEHICLE_SEED: Array<Omit<Vehicle, 'status' | 'vehicleFunction' | 'logistics' | 'minTripsMonth' | 'fuelPriceCs' | 'tankCapacityL' | 'financing'> & { status: VehicleStatus }> = [
  { id: 'vh-001', plate: 'M 123-456', model: 'Ford Transit 2023', type: 'Panel', capacityKg: 1200, year: 2023, status: 'En servicio', driver: 'Juan Pérez', lastMaintenance: '10 Ago 2026', nextMaintenance: '10 Sep 2026', totalTrips: 152, fuelType: 'Diésel', consumptionLPerKm: 0.12, priceCs: 1850000, odometerKm: 48250, imageUrl: '' },
  { id: 'vh-002', plate: 'M 234-567', model: 'Nissan NV200 2022', type: 'Panel', capacityKg: 750, year: 2022, status: 'En servicio', driver: 'Roberto Sánchez', lastMaintenance: '18 Ago 2026', nextMaintenance: '18 Sep 2026', totalTrips: 138, fuelType: 'Gasolina', consumptionLPerKm: 0.09, priceCs: 1350000, odometerKm: 61300, imageUrl: '' },
  { id: 'vh-003', plate: 'M 345-678', model: 'Chevrolet Express 2021', type: 'Van', capacityKg: 900, year: 2021, status: 'En servicio', driver: 'Ana López', lastMaintenance: '22 Ago 2026', nextMaintenance: '22 Sep 2026', totalTrips: 141, fuelType: 'Gasolina', consumptionLPerKm: 0.14, priceCs: 1590000, odometerKm: 73810, imageUrl: '' },
  { id: 'vh-004', plate: 'M 456-789', model: 'Mercedes Sprinter 2022', type: 'Van', capacityKg: 1400, year: 2022, status: 'Disponible', driver: 'Pedro Ruiz', lastMaintenance: '05 Ago 2026', nextMaintenance: '05 Sep 2026', totalTrips: 96, fuelType: 'Diésel', consumptionLPerKm: 0.11, priceCs: 2420000, odometerKm: 39420, imageUrl: '' },
  { id: 'vh-005', plate: 'M 567-890', model: 'Renault Kangoo 2023', type: 'Panel', capacityKg: 650, year: 2023, status: 'Disponible', driver: 'Miguel Torres', lastMaintenance: '28 Jul 2026', nextMaintenance: '28 Ago 2026', totalTrips: 87, fuelType: 'Gasolina', consumptionLPerKm: 0.08, priceCs: 1180000, odometerKm: 57120, imageUrl: '', external: true },
  { id: 'vh-006', plate: 'M 678-901', model: 'VW Caddy 2020', type: 'Panel', capacityKg: 550, year: 2020, status: 'Mantenimiento', driver: 'Carlos Díaz', lastMaintenance: '25 Ago 2026', nextMaintenance: '25 Sep 2026', totalTrips: 64, fuelType: 'Gasolina', consumptionLPerKm: 0.08, priceCs: 1080000, odometerKm: 69240, imageUrl: '' },
  { id: 'vh-007', plate: 'M 789-012', model: 'Isuzu NPR 2021', type: 'Camión', capacityKg: 3200, year: 2021, status: 'Disponible', driver: 'Sin asignar', lastMaintenance: '15 Ago 2026', nextMaintenance: '15 Sep 2026', totalTrips: 210, fuelType: 'Diésel', consumptionLPerKm: 0.19, priceCs: 3350000, odometerKm: 105430, imageUrl: '', external: true },
  { id: 'vh-008', plate: 'M 890-123', model: 'Hyundai HD65 2022', type: 'Camión', capacityKg: 4000, year: 2022, status: 'Fuera de servicio', driver: 'Sin asignar', lastMaintenance: '01 Ago 2026', nextMaintenance: '01 Sep 2026', totalTrips: 178, fuelType: 'Diésel', consumptionLPerKm: 0.21, priceCs: 3850000, odometerKm: 96480, imageUrl: '' },
]

const MAINTENANCE_SEED = [
  { id: 'mt-001', vehicleId: 'vh-006', date: '25 Ago 2026', description: 'Cambio de aceite, frenos y alineación', cost: 7420 },
  { id: 'mt-002', vehicleId: 'vh-008', date: '01 Ago 2026', description: 'Reparación de transmisión', cost: 21600 },
  { id: 'mt-003', vehicleId: 'vh-001', date: '10 Ago 2026', description: 'Servicio preventivo 10,000 km', cost: 6080 },
  { id: 'mt-004', vehicleId: 'vh-003', date: '22 Ago 2026', description: 'Cambio de llantas traseras', cost: 8780 },
  { id: 'mt-005', vehicleId: 'vh-004', date: '05 Ago 2026', description: 'Revisión de suspensión y balanceo', cost: 4730 },
]

const VEHICLE_COLUMNS = [
  'fuel_type TEXT NOT NULL DEFAULT \'Gasolina\'',
  'consumption_l_per_km REAL NOT NULL DEFAULT 0.1',
  'price_cs REAL NOT NULL DEFAULT 0',
  'odometer_km INTEGER NOT NULL DEFAULT 0',
  'image_url TEXT NOT NULL DEFAULT \'\'',
  'external INTEGER NOT NULL DEFAULT 0',
  'vehicle_function TEXT NOT NULL DEFAULT \'\'',
  'logistics TEXT NOT NULL DEFAULT \'\'',
  'min_trips_month INTEGER NOT NULL DEFAULT 0',
  'financed INTEGER NOT NULL DEFAULT 0',
  'down_payment_cs REAL NOT NULL DEFAULT 0',
  'lease_start TEXT NOT NULL DEFAULT \'\'',
  'lease_term_months INTEGER NOT NULL DEFAULT 0',
  'lease_monthly_payment_cs REAL NOT NULL DEFAULT 0',
  'residual_value_cs REAL NOT NULL DEFAULT 0',
  'depreciation_pct REAL NOT NULL DEFAULT 20',
  'fuel_price_cs REAL NOT NULL DEFAULT 0',
  'tank_capacity_l REAL NOT NULL DEFAULT 0',
]

interface SeedFinance {
  financed?: boolean
  downPaymentCs?: number
  leaseStartMonthsAgo?: number
  leaseTermMonths?: number
  leaseMonthlyPaymentCs?: number
  residualValueCs?: number
  depreciationPct?: number
  vehicleFunction: VehicleFunction
  logistics: string
  minTripsMonth: number
}

const VEHICLE_FINANCE_SEED: Record<string, SeedFinance> = {
  'M 123-456': { financed: true, downPaymentCs: 555000, leaseStartMonthsAgo: 26, leaseTermMonths: 60, leaseMonthlyPaymentCs: 42000, residualValueCs: 370000, depreciationPct: 16, vehicleFunction: 'privado', logistics: 'Servicio ejecutivo a empresas (paquetería gerencial)', minTripsMonth: 90 },
  'M 234-567': { financed: false, depreciationPct: 20, vehicleFunction: 'delivery', logistics: 'Entregas urbanas de farmacia y tiendas', minTripsMonth: 120 },
  'M 345-678': { financed: true, downPaymentCs: 477000, leaseStartMonthsAgo: 40, leaseTermMonths: 48, leaseMonthlyPaymentCs: 28500, residualValueCs: 0, depreciationPct: 18, vehicleFunction: 'delivery', logistics: 'Reparto a tiendas y supermercados', minTripsMonth: 110 },
  'M 456-789': { financed: true, downPaymentCs: 726000, leaseStartMonthsAgo: 8, leaseTermMonths: 60, leaseMonthlyPaymentCs: 39800, residualValueCs: 484000, depreciationPct: 15, vehicleFunction: 'privado', logistics: 'Servicio ejecutivo y traslado de personal', minTripsMonth: 80 },
  'M 567-890': { financed: false, depreciationPct: 20, vehicleFunction: 'delivery', logistics: '3P · Proveedor externo (coordinado, no financiado)', minTripsMonth: 100, },
  'M 678-901': { financed: false, depreciationPct: 20, vehicleFunction: 'delivery', logistics: 'Entregas exprés y paquetería urbana', minTripsMonth: 100 },
  'M 789-012': { financed: true, downPaymentCs: 1005000, leaseStartMonthsAgo: 14, leaseTermMonths: 72, leaseMonthlyPaymentCs: 46500, residualValueCs: 670000, depreciationPct: 14, vehicleFunction: 'delivery', logistics: '3P · Distribución mayorista (carga pesada)', minTripsMonth: 70 },
  'M 890-123': { financed: true, downPaymentCs: 1155000, leaseStartMonthsAgo: 3, leaseTermMonths: 72, leaseMonthlyPaymentCs: 52800, residualValueCs: 770000, depreciationPct: 14, vehicleFunction: 'delivery', logistics: 'Distribución programada de carga pesada', minTripsMonth: 70 },
}

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
    this.migrateVehicles()
    const count = Number((this.db.prepare('SELECT COUNT(*) AS count FROM vehicles').get() as { count: number }).count)
    if (count === 0) this.seed()
  }

  private migrateVehicles() {
    const existing = new Set((this.db.prepare('PRAGMA table_info(vehicles)').all() as unknown as Array<{ name: string }>).map((column) => column.name))
    let added = false
    for (const definition of VEHICLE_COLUMNS) {
      const name = definition.split(' ')[0]
      if (!existing.has(name)) {
        this.db.exec(`ALTER TABLE vehicles ADD COLUMN ${definition}`)
        added = true
      }
    }
    if (added) {
      const backfill = this.db.prepare('UPDATE vehicles SET fuel_type = ?, consumption_l_per_km = ?, price_cs = ?, odometer_km = ? WHERE plate = ?')
      for (const vehicle of VEHICLE_SEED) backfill.run(vehicle.fuelType, vehicle.consumptionLPerKm, vehicle.priceCs, vehicle.odometerKm, vehicle.plate)
    }
    this.db.exec('CREATE TABLE IF NOT EXISTS incoex_meta (key TEXT PRIMARY KEY, value TEXT)')
    if (!this.db.prepare('SELECT 1 AS present FROM incoex_meta WHERE key = ?').get('veh_external_v1')) {
      this.db.prepare("UPDATE vehicles SET external = 1 WHERE plate IN ('M 567-890', 'M 789-012') AND external = 0").run()
      this.db.prepare("INSERT INTO incoex_meta (key, value) VALUES ('veh_external_v1', '1')").run()
    }
    if (!this.db.prepare('SELECT 1 AS present FROM incoex_meta WHERE key = ?').get('veh_finance_v1')) {
      const apply = this.db.prepare('UPDATE vehicles SET vehicle_function = ?, logistics = ?, min_trips_month = ?, financed = ?, down_payment_cs = ?, lease_start = ?, lease_term_months = ?, lease_monthly_payment_cs = ?, residual_value_cs = ?, depreciation_pct = ? WHERE plate = ?')
      for (const [plate, finance] of Object.entries(VEHICLE_FINANCE_SEED)) {
        const leaseStart = finance.leaseStartMonthsAgo === undefined ? '' : isoDateMonthsAgo(finance.leaseStartMonthsAgo)
        apply.run(finance.vehicleFunction, finance.logistics, finance.minTripsMonth, finance.financed ? 1 : 0, finance.downPaymentCs ?? 0, leaseStart, finance.leaseTermMonths ?? 0, finance.leaseMonthlyPaymentCs ?? 0, finance.residualValueCs ?? 0, finance.depreciationPct ?? 20, plate)
      }
      this.db.prepare("INSERT INTO incoex_meta (key, value) VALUES ('veh_finance_v1', '1')").run()
    }
    if (!this.db.prepare('SELECT 1 AS present FROM incoex_meta WHERE key = ?').get('veh_catalog_v1')) {
      this.db.prepare("UPDATE vehicles SET vehicle_function = 'privado' WHERE vehicle_function = 'taxi'").run()
      this.db.prepare("UPDATE vehicles SET vehicle_function = '' WHERE vehicle_function = 'mixto'").run()
      const catalog = this.db.prepare('UPDATE vehicles SET tank_capacity_l = ?, fuel_price_cs = ? WHERE plate = ?')
      catalog.run(22, 54, 'M 123-456')
      catalog.run(14, 62.5, 'M 234-567')
      catalog.run(30, 62.5, 'M 345-678')
      catalog.run(34, 54, 'M 456-789')
      catalog.run(17, 62.5, 'M 567-890')
      catalog.run(15, 62.5, 'M 678-901')
      catalog.run(75, 54, 'M 789-012')
      catalog.run(83, 54, 'M 890-123')
      this.db.prepare("INSERT INTO incoex_meta (key, value) VALUES ('veh_catalog_v1', '1')").run()
    }
    if (!this.db.prepare('SELECT 1 AS present FROM incoex_meta WHERE key = ?').get('veh_catalog_v3')) {
      this.db.prepare("UPDATE vehicles SET vehicle_function = 'delivery' WHERE lower(type) LIKE '%moto%'").run()
      this.db.prepare("UPDATE vehicles SET vehicle_function = 'camion' WHERE plate IN ('M 789-012', 'M 890-123')").run()
      this.db.prepare("UPDATE vehicles SET vehicle_function = 'privado' WHERE lower(type) NOT LIKE '%moto%' AND plate NOT IN ('M 789-012', 'M 890-123')").run()
      this.db.prepare("DELETE FROM incoex_meta WHERE key = 'veh_catalog_v2'").run()
      this.db.prepare("INSERT INTO incoex_meta (key, value) VALUES ('veh_catalog_v3', '1')").run()
    }
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

  create(input: { plate: string; model: string; type: string; capacityKg: number; year: number; fuelType?: FuelType; consumptionLPerKm?: number; priceCs?: number; odometerKm?: number; external?: boolean; vehicleFunction?: VehicleFunction; logistics?: string; minTripsMonth?: number; financed?: boolean; downPaymentCs?: number; leaseStart?: string; leaseTermMonths?: number; leaseMonthlyPaymentCs?: number; residualValueCs?: number; depreciationPct?: number; fuelPriceCs?: number; tankCapacityL?: number }) {
    this.assertFunctionType(input.type, input.vehicleFunction)
    const duplicate = this.db.prepare('SELECT 1 AS present FROM vehicles WHERE plate = ?').get(input.plate)
    if (duplicate) throw new BadRequestException('Ya existe un vehículo con esa placa')
    const id = `vh-${String(Date.now()).slice(-6)}`
    const now = new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
    this.db.prepare('INSERT INTO vehicles (id, plate, model, type, capacity_kg, year, status, driver, last_maintenance, next_maintenance, total_trips, fuel_type, consumption_l_per_km, price_cs, odometer_km, image_url, external, vehicle_function, logistics, min_trips_month, financed, down_payment_cs, lease_start, lease_term_months, lease_monthly_payment_cs, residual_value_cs, depreciation_pct, fuel_price_cs, tank_capacity_l) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.plate, input.model, input.type, input.capacityKg, input.year, 'Disponible', 'Sin asignar', now, now, 0, input.fuelType ?? 'Gasolina', input.consumptionLPerKm ?? 0.1, input.priceCs ?? 0, input.odometerKm ?? 0, '', input.external ? 1 : 0, input.vehicleFunction ?? '', input.logistics ?? '', input.minTripsMonth ?? 0, input.financed ? 1 : 0, input.downPaymentCs ?? 0, input.leaseStart ?? '', input.leaseTermMonths ?? 0, input.leaseMonthlyPaymentCs ?? 0, input.residualValueCs ?? 0, input.depreciationPct ?? 20, input.fuelPriceCs ?? 0, input.tankCapacityL ?? 0)
    return this.get(id)
  }

  private assertFunctionType(type: string, vehicleFunction?: VehicleFunction) {
    if (vehicleFunction === 'delivery' && !/moto/i.test(String(type ?? ''))) {
      throw new BadRequestException('La función Delivery es solo para motocicletas; el tipo debe ser Moto')
    }
  }

  update(id: string, input: { type?: string; fuelType?: FuelType; consumptionLPerKm?: number; priceCs?: number; odometerKm?: number; external?: boolean; vehicleFunction?: VehicleFunction; logistics?: string; minTripsMonth?: number; financed?: boolean; downPaymentCs?: number; leaseStart?: string; leaseTermMonths?: number; leaseMonthlyPaymentCs?: number; residualValueCs?: number; depreciationPct?: number; fuelPriceCs?: number; tankCapacityL?: number }) {
    const current = this.get(id)
    if (input.vehicleFunction !== undefined || input.type !== undefined) {
      this.assertFunctionType(input.type ?? current.type, input.vehicleFunction ?? current.vehicleFunction)
    }
    if (input.type !== undefined) this.db.prepare('UPDATE vehicles SET type = ? WHERE id = ?').run(input.type, id)
    if (input.fuelType !== undefined) this.db.prepare('UPDATE vehicles SET fuel_type = ? WHERE id = ?').run(input.fuelType, id)
    if (input.consumptionLPerKm !== undefined) this.db.prepare('UPDATE vehicles SET consumption_l_per_km = ? WHERE id = ?').run(input.consumptionLPerKm, id)
    if (input.priceCs !== undefined) this.db.prepare('UPDATE vehicles SET price_cs = ? WHERE id = ?').run(input.priceCs, id)
    if (input.odometerKm !== undefined) this.db.prepare('UPDATE vehicles SET odometer_km = ? WHERE id = ?').run(input.odometerKm, id)
    if (input.external !== undefined) this.db.prepare('UPDATE vehicles SET external = ? WHERE id = ?').run(input.external ? 1 : 0, id)
    if (input.vehicleFunction !== undefined) this.db.prepare('UPDATE vehicles SET vehicle_function = ? WHERE id = ?').run(input.vehicleFunction, id)
    if (input.logistics !== undefined) this.db.prepare('UPDATE vehicles SET logistics = ? WHERE id = ?').run(input.logistics, id)
    if (input.minTripsMonth !== undefined) this.db.prepare('UPDATE vehicles SET min_trips_month = ? WHERE id = ?').run(Math.max(0, Math.round(input.minTripsMonth)), id)
    if (input.financed !== undefined) this.db.prepare('UPDATE vehicles SET financed = ? WHERE id = ?').run(input.financed ? 1 : 0, id)
    if (input.downPaymentCs !== undefined) this.db.prepare('UPDATE vehicles SET down_payment_cs = ? WHERE id = ?').run(input.downPaymentCs, id)
    if (input.leaseStart !== undefined) this.db.prepare('UPDATE vehicles SET lease_start = ? WHERE id = ?').run(input.leaseStart, id)
    if (input.leaseTermMonths !== undefined) this.db.prepare('UPDATE vehicles SET lease_term_months = ? WHERE id = ?').run(Math.max(0, Math.round(input.leaseTermMonths)), id)
    if (input.leaseMonthlyPaymentCs !== undefined) this.db.prepare('UPDATE vehicles SET lease_monthly_payment_cs = ? WHERE id = ?').run(input.leaseMonthlyPaymentCs, id)
    if (input.residualValueCs !== undefined) this.db.prepare('UPDATE vehicles SET residual_value_cs = ? WHERE id = ?').run(input.residualValueCs, id)
    if (input.depreciationPct !== undefined) this.db.prepare('UPDATE vehicles SET depreciation_pct = ? WHERE id = ?').run(Math.max(0, Math.min(90, input.depreciationPct)), id)
    if (input.fuelPriceCs !== undefined) this.db.prepare('UPDATE vehicles SET fuel_price_cs = ? WHERE id = ?').run(Math.max(0, input.fuelPriceCs), id)
    if (input.tankCapacityL !== undefined) this.db.prepare('UPDATE vehicles SET tank_capacity_l = ? WHERE id = ?').run(Math.max(0, input.tankCapacityL), id)
    return this.get(id)
  }

  setImageUrl(id: string, imageUrl: string) {
    this.get(id)
    this.db.prepare('UPDATE vehicles SET image_url = ? WHERE id = ?').run(imageUrl, id)
    return this.get(id)
  }

  delete(id: string) {
    const vehicle = this.get(id)
    if (vehicle.driver !== 'Sin asignar') {
      throw new BadRequestException(`Libera al conductor ${vehicle.driver} antes de eliminar el vehículo`)
    }
    this.db.prepare('DELETE FROM maintenance_records WHERE vehicle_id = ?').run(id)
    this.db.prepare('DELETE FROM vehicles WHERE id = ?').run(id)
    return { deleted: id }
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
    if (driver && driver !== 'Sin asignar') {
      const owner = (this.list() as any[]).find((other) => other.id !== id && other.driver === driver)
      if (owner) {
        throw new BadRequestException(`El conductor ${driver} ya está asignado al vehículo ${owner.plate}`)
      }
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
    const insertVehicle = this.db.prepare('INSERT INTO vehicles (id, plate, model, type, capacity_kg, year, status, driver, last_maintenance, next_maintenance, total_trips, fuel_type, consumption_l_per_km, price_cs, odometer_km, image_url, external, vehicle_function, logistics, min_trips_month, financed, down_payment_cs, lease_start, lease_term_months, lease_monthly_payment_cs, residual_value_cs, depreciation_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const vehicle of VEHICLE_SEED) {
      const finance = VEHICLE_FINANCE_SEED[vehicle.plate] ?? { financed: false, depreciationPct: 20, vehicleFunction: '', logistics: '', minTripsMonth: 0 }
      const leaseStart = finance.leaseStartMonthsAgo === undefined ? '' : isoDateMonthsAgo(finance.leaseStartMonthsAgo)
      insertVehicle.run(vehicle.id, vehicle.plate, vehicle.model, vehicle.type, vehicle.capacityKg, vehicle.year, vehicle.status, vehicle.driver, vehicle.lastMaintenance, vehicle.nextMaintenance, vehicle.totalTrips, vehicle.fuelType, vehicle.consumptionLPerKm, vehicle.priceCs, vehicle.odometerKm, vehicle.imageUrl, vehicle.external ? 1 : 0, finance.vehicleFunction, finance.logistics, finance.minTripsMonth, finance.financed ? 1 : 0, finance.downPaymentCs ?? 0, leaseStart, finance.leaseTermMonths ?? 0, finance.leaseMonthlyPaymentCs ?? 0, finance.residualValueCs ?? 0, finance.depreciationPct ?? 20)
    }
    const insertMaintenance = this.db.prepare('INSERT INTO maintenance_records (id, vehicle_id, plate, maintenance_date, description, cost) VALUES (?, ?, ?, ?, ?, ?)')
    for (const record of MAINTENANCE_SEED) insertMaintenance.run(record.id, record.vehicleId, this.get(record.vehicleId).plate, record.date, record.description, record.cost)
    this.seedCatalog()
  }

  private seedCatalog() {
    const catalog = this.db.prepare('UPDATE vehicles SET tank_capacity_l = ?, fuel_price_cs = ? WHERE plate = ?')
    catalog.run(22, 54, 'M 123-456')
    catalog.run(14, 62.5, 'M 234-567')
    catalog.run(30, 62.5, 'M 345-678')
    catalog.run(34, 54, 'M 456-789')
    catalog.run(17, 62.5, 'M 567-890')
    catalog.run(15, 62.5, 'M 678-901')
    catalog.run(75, 54, 'M 789-012')
    catalog.run(83, 54, 'M 890-123')
  }
}

function toVehicle(row: VehicleRow): Vehicle {
  const financed = Boolean(row.financed ?? 0)
  const monthsElapsed = financed && row.lease_start ? wholeMonthsBetween(row.lease_start, new Date()) : 0
  const monthsRemaining = financed ? Math.max(0, (row.lease_term_months ?? 0) - monthsElapsed) : 0
  const paidMonths = Math.min(monthsElapsed, row.lease_term_months ?? 0)
  const totalPaidCs = Number((row.down_payment_cs ?? 0) + (row.lease_monthly_payment_cs ?? 0) * paidMonths)
  const remainingDebtCs = financed ? Number(Math.max(0, (row.price_cs ?? 0) - totalPaidCs + (row.residual_value_cs ?? 0)).toFixed(2)) : 0
  const annualDepreciationCs = Number((((row.price_cs ?? 0) * (row.depreciation_pct ?? 20)) / 100).toFixed(2))
  const monthlyDepreciationCs = Number((annualDepreciationCs / 12).toFixed(2))
  const monthlyCostCs = Number(((financed ? row.lease_monthly_payment_cs ?? 0 : 0) + monthlyDepreciationCs).toFixed(2))
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
    fuelType: row.fuel_type as FuelType,
    consumptionLPerKm: row.consumption_l_per_km,
    priceCs: row.price_cs,
    odometerKm: row.odometer_km,
    imageUrl: row.image_url,
    external: Boolean(row.external ?? 0),
    vehicleFunction: (row.vehicle_function ?? '') as VehicleFunction,
    logistics: row.logistics ?? '',
    minTripsMonth: row.min_trips_month ?? 0,
    fuelPriceCs: Number(row.fuel_price_cs ?? 0),
    tankCapacityL: Number(row.tank_capacity_l ?? 0),
    financing: {
      financed,
      downPaymentCs: row.down_payment_cs ?? 0,
      leaseStart: row.lease_start ?? '',
      leaseTermMonths: row.lease_term_months ?? 0,
      leaseMonthlyPaymentCs: row.lease_monthly_payment_cs ?? 0,
      residualValueCs: row.residual_value_cs ?? 0,
      depreciationPct: row.depreciation_pct ?? 20,
      monthsElapsed,
      monthsRemaining,
      totalPaidCs,
      remainingDebtCs,
      monthlyDepreciationCs,
      annualDepreciationCs,
      monthlyCostCs,
      financingLabel: financed ? `Leasing · cuota mensual C$ ${(row.lease_monthly_payment_cs ?? 0).toLocaleString('es-NI', { maximumFractionDigits: 0 })} · ${monthsRemaining} meses restantes` : 'Pagado al contado',
    },
  }
}

function isoDateMonthsAgo(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return date.toISOString().slice(0, 10)
}

function wholeMonthsBetween(isoStart: string, now: Date): number {
  const start = new Date(isoStart)
  if (Number.isNaN(start.getTime())) return 0
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
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