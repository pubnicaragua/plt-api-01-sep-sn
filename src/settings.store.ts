import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface VehicleRate {
  baseFeeCs: number
  farePerKmCs: number
}

export interface AppSettings {
  dollarRate: number
  fuelPriceGasolineCs: number
  fuelPriceDieselCs: number
  baseFeeCs: number
  farePerKmCs: number
  vehicleRates: {
    Moto: VehicleRate
    Vehículo: VehicleRate
    Camión: VehicleRate
  }
  companyName: string
  companyPhone: string
  companyEmail: string
  companyAddress: string
  updatedAt: string
}

export type SettingsPatch = Partial<Omit<AppSettings, 'updatedAt'>>

interface SettingsRow {
  key: string
  value: string
  updated_at: string
}

const DEFAULTS: Omit<AppSettings, 'updatedAt'> = {
  dollarRate: 36.5,
  fuelPriceGasolineCs: 61.5,
  fuelPriceDieselCs: 54,
  baseFeeCs: 80,
  farePerKmCs: 8.5,
  vehicleRates: {
    Moto: { baseFeeCs: 60, farePerKmCs: 6.5 },
    Vehículo: { baseFeeCs: 80, farePerKmCs: 8.5 },
    Camión: { baseFeeCs: 130, farePerKmCs: 13.5 },
  },
  companyName: 'INCOEX Logistics',
  companyPhone: '+505 8888-0000',
  companyEmail: 'contacto@incoexlogistics.com',
  companyAddress: 'Managua, Nicaragua',
}

const DEFAULT_VEHICLE_RATES = JSON.stringify(DEFAULTS.vehicleRates)

@Injectable()
export class SettingsStore implements OnModuleDestroy {
  private readonly db: DatabaseSync

  constructor() {
    const databasePath = resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite')
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath, { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    const now = new Date().toISOString()
    for (const [key, value] of Object.entries(DEFAULTS)) {
      this.db.prepare('INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, String(value), now)
    }
    const seedVehicleRates = this.db.prepare('SELECT 1 AS present FROM app_settings WHERE key = ?').get('vehicleRates')
    if (!seedVehicleRates) {
      this.db.prepare('INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run('vehicleRates', DEFAULT_VEHICLE_RATES, now)
    }
  }

  get(): AppSettings {
    const rows = this.db.prepare('SELECT key, value, updated_at FROM app_settings').all() as unknown as SettingsRow[]
    const numericKeys = ['dollarRate', 'fuelPriceGasolineCs', 'fuelPriceDieselCs', 'baseFeeCs', 'farePerKmCs']
    const values: Record<string, string | number> = {}
    for (const row of rows) values[row.key] = numericKeys.includes(row.key) ? Number(row.value) : row.value
    const updatedAt = rows[0]?.updated_at ?? new Date().toISOString()
    const merged = { ...DEFAULTS, ...values, updatedAt } as unknown as AppSettings
    if (typeof merged.vehicleRates === 'string') {
      try {
        merged.vehicleRates = JSON.parse(merged.vehicleRates)
      } catch {
        merged.vehicleRates = DEFAULTS.vehicleRates
      }
    }
    return merged
  }

  getVehicleRate(vehicle: 'Moto' | 'Vehículo' | 'Camión'): VehicleRate {
    const rates = this.get().vehicleRates
    return rates[vehicle] ?? DEFAULTS.vehicleRates.Vehículo
  }

  update(patch: SettingsPatch): AppSettings {
    const now = new Date().toISOString()
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      const stored = typeof value === 'object' ? JSON.stringify(value) : String(value)
      this.db.prepare('UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?').run(stored, now, key)
    }
    return this.get()
  }

  onModuleDestroy() { this.db.close() }
}