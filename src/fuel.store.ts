import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { OperationsStore } from './operations.store'
import { VehiclesStore } from './vehicles.store'

export interface FuelRecord {
  id: string
  plate: string
  liters: number
  pricePerLiterCs: number
  totalCs: number
  odometerKm: number
  date: string
  note: string
  createdAt: number
}

export interface FuelStats {
  plate: string
  literPriceCs: number
  costPerKmCs: number
  realConsumptionLPer100Km: number
  autonomyKm: number
  autonomyDays: number
  refuels: number
  totalLiters: number
  totalCs: number
}

interface FuelRow {
  id: string
  plate: string
  liters: number
  price_per_liter_cs: number
  total_cs: number
  odometer_km: number
  fuel_date: string
  note: string
  created_at: number
}

@Injectable()
export class FuelStore implements OnModuleDestroy {
  private readonly db: DatabaseSync

  constructor(
    private readonly operations: OperationsStore,
    private readonly vehicles: VehiclesStore,
  ) {
    this.db = new DatabaseSync(resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite'), { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fuel_records (
        id TEXT PRIMARY KEY,
        plate TEXT NOT NULL,
        liters REAL NOT NULL DEFAULT 0,
        price_per_liter_cs REAL NOT NULL DEFAULT 0,
        total_cs REAL NOT NULL DEFAULT 0,
        odometer_km INTEGER NOT NULL DEFAULT 0,
        fuel_date TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS incoex_meta (key TEXT PRIMARY KEY, value TEXT);
    `)
  }

  onModuleDestroy() { this.db.close() }

  list(plate?: string): FuelRecord[] {
    const rows = plate
      ? this.db.prepare('SELECT * FROM fuel_records WHERE plate = ? ORDER BY fuel_date DESC, created_at DESC').all(plate)
      : this.db.prepare('SELECT * FROM fuel_records ORDER BY fuel_date DESC, created_at DESC LIMIT 500').all()
    return (rows as unknown as FuelRow[]).map((row) => this.map(row))
  }

  add(input: { plate: string; liters: number; pricePerLiterCs?: number; odometerKm?: number; date?: string; note?: string }) {
    const plate = (input.plate ?? '').trim()
    const vehicle = this.vehicles.list().find((candidate) => candidate.plate.toLowerCase() === plate.toLowerCase())
    if (!vehicle) throw new BadRequestException(`No existe el vehículo con placa ${plate}`)
    if (input.liters <= 0) throw new BadRequestException('Los litros deben ser mayores a cero')
    const liters = input.liters
    const price = input.pricePerLiterCs ?? vehicle.fuelPriceCs ?? 0
    const total = Number((liters * price).toFixed(2))
    const odometer = Math.max(0, Math.round(input.odometerKm ?? vehicle.odometerKm ?? 0))
    const date = input.date ?? new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
    const id = `fuel-${String(Date.now()).slice(-8)}`
    this.db.prepare('INSERT INTO fuel_records (id, plate, liters, price_per_liter_cs, total_cs, odometer_km, fuel_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, vehicle.plate, liters, price, total, odometer, date, input.note ?? '', Date.now())
    if (odometer > vehicle.odometerKm) this.db.prepare('UPDATE vehicles SET odometer_km = ? WHERE id = ?').run(odometer, vehicle.id)
    return this.get(id)
  }

  get(id: string): FuelRecord {
    const row = this.db.prepare('SELECT * FROM fuel_records WHERE id = ?').get(id) as unknown as FuelRow | undefined
    if (!row) throw new NotFoundException('Recarga no encontrada')
    return this.map(row)
  }

  remove(id: string) {
    this.get(id)
    this.db.prepare('DELETE FROM fuel_records WHERE id = ?').run(id)
    return { deleted: id }
  }

  statsFor(plate?: string): FuelStats[] {
    const vehicles = this.vehicles.list()
    const rows = this.list(plate)
    const result: FuelStats[] = []
    for (const vehicle of vehicles) {
      if (plate && vehicle.plate.toLowerCase() !== plate.toLowerCase()) continue
      const records = rows.filter((row) => row.plate.toLowerCase() === vehicle.plate.toLowerCase())
      const totalLiters = records.reduce((sum, row) => sum + row.liters, 0)
      const totalCs = records.reduce((sum, row) => sum + row.totalCs, 0)
      const refuels = records.length
      let realConsumption = 0
      if (records.length >= 2) {
        const first = records[records.length - 1]
        const last = records[0]
        const kmDelta = Math.max(0, last.odometerKm - first.odometerKm)
        if (kmDelta > 30 && totalLiters > 0) {
          realConsumption = Number(((totalLiters / kmDelta) * 100).toFixed(2))
        }
      }
      const price = vehicle.fuelPriceCs || (records.length ? Number((totalCs / Math.max(totalLiters, 1)).toFixed(2)) : 0)
      const consumptionPerKm = vehicle.consumptionLPerKm || (realConsumption > 0 ? realConsumption / 100 : 0)
      let autonomyKm = 0
      let autonomyDays = 0
      if (vehicle.tankCapacityL > 0 && consumptionPerKm > 0) {
        autonomyKm = Number((vehicle.tankCapacityL / consumptionPerKm).toFixed(0))
        if (records.length >= 2) {
          const first = records[records.length - 1]
          const last = records[0]
          const kmDelta = last.odometerKm - first.odometerKm
          let days = 0
          const matched = /(\d{1,2})[/ .-]+([a-zA-Z]+)/.exec(first.date)
          const matchedEnd = /(\d{1,2})[/ .-]+([a-zA-Z]+)/.exec(last.date)
          if (matched && matchedEnd) {
            const months: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 }
            const a = Date.UTC(2026, (months[matched[2].toLowerCase()] ?? 1) - 1, Number(matched[1]))
            const b = Date.UTC(2026, (months[matchedEnd[2].toLowerCase()] ?? 1) - 1, Number(matchedEnd[1]))
            days = Math.max(1, Math.round((b - a) / 86400000) || 1)
          }
          if (kmDelta > 50 && days > 0) autonomyDays = Number((kmDelta / days).toFixed(1))
        }
      }
      let costPerKm = 0
      if (consumptionPerKm > 0 && price > 0) costPerKm = Number((consumptionPerKm * price).toFixed(2))
      result.push({
        plate: vehicle.plate,
        literPriceCs: price,
        costPerKmCs: costPerKm,
        realConsumptionLPer100Km: realConsumption,
        autonomyKm,
        autonomyDays: autonomyKm > 0 ? 1 : 0,
        refuels,
        totalLiters: Number(totalLiters.toFixed(1)),
        totalCs: Number(totalCs.toFixed(2)),
      })
    }
    return result
  }

  private map(row: FuelRow): FuelRecord {
    return {
      id: String(row.id),
      plate: String(row.plate),
      liters: Number(row.liters),
      pricePerLiterCs: Number(row.price_per_liter_cs),
      totalCs: Number(row.total_cs),
      odometerKm: Number(row.odometer_km),
      date: String(row.fuel_date),
      note: String(row.note ?? ''),
      createdAt: Number(row.created_at),
    }
  }
}
