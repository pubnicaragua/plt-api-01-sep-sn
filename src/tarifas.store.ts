import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface TariffSettings {
  baseFareCs: number
  includedKm: number
  surchargePerKmCs: number
  roadFactor: number
  roundingCs: number
  catalogUpdatedAt: string
  districtsCount: number
  requireCoords: boolean
  includeStrategicPoints: boolean
  duplicateDistanceM: number
  minRecommendedStatus: string
  cartographicSource: string
  updatedAt: string
}

export interface TariffDistrict {
  id: string
  name: string
  inCoverage: boolean
  status: string
}

export interface TariffDestination {
  id: string
  name: string
  district: string
  category: string
  latitude: number
  longitude: number
  inCoverage: boolean
  status: string
}

export interface FareResult {
  straightKm: number
  roadKm: number
  fareCs: number
  status: string
  method: string
  coverage: { origin: boolean; destination: boolean }
  params: { baseFareCs: number; includedKm: number; surchargePerKmCs: number; roadFactor: number; roundingCs: number }
}

export const DISTRICT_STATUSES = [
  'Verificado OSM 2026',
  'Nuevo – verificado OSM 2026',
  'Referencia 2016 – revisar',
  'Fuente oficial – coordenadas pendientes',
  'Verificado manualmente',
  'Descartado',
  'Por verificar',
]

export const DESTINATION_CATEGORIES = [
  'Centro comercial',
  'Barrio / sector',
  'Mercado',
  'Aeropuerto',
  'Hospital',
  'Universidad',
  'Terminal',
  'Punto estratégico',
  'Otro',
]

interface SettingsRow {
  base_fare_cs: number
  included_km: number
  surcharge_per_km_cs: number
  road_factor: number
  rounding_cs: number
  catalog_updated_at: string
  districts_count: number
  require_coords: number
  include_strategic: number
  duplicate_distance_m: number
  min_status: string
  cartographic_source: string
  updated_at: string
}

interface DistrictRow {
  id: string
  name: string
  in_coverage: number
  status: string
}

interface DestinationRow {
  id: string
  name: string
  district: string
  category: string
  latitude: number
  longitude: number
  in_coverage: number
  status: string
}

function toBool(value: number): boolean {
  return value === 1
}

function fromBool(value: boolean): number {
  return value ? 1 : 0
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

@Injectable()
export class TarifasStore implements OnModuleDestroy {
  private readonly db: DatabaseSync

  constructor() {
    this.db = new DatabaseSync(resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite'), { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tariff_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        base_fare_cs REAL NOT NULL DEFAULT 100,
        included_km REAL NOT NULL DEFAULT 4,
        surcharge_per_km_cs REAL NOT NULL DEFAULT 10,
        road_factor REAL NOT NULL DEFAULT 1.25,
        rounding_cs REAL NOT NULL DEFAULT 5,
        catalog_updated_at TEXT NOT NULL DEFAULT '',
        districts_count INTEGER NOT NULL DEFAULT 7,
        require_coords INTEGER NOT NULL DEFAULT 1,
        include_strategic INTEGER NOT NULL DEFAULT 1,
        duplicate_distance_m INTEGER NOT NULL DEFAULT 150,
        min_status TEXT NOT NULL DEFAULT 'Verificado OSM 2026',
        cartographic_source TEXT NOT NULL DEFAULT 'OpenStreetMap',
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS tariff_districts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        in_coverage INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Verificado OSM 2026'
      );
      CREATE TABLE IF NOT EXISTS tariff_destinations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        district TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Barrio / sector',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        in_coverage INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Verificado OSM 2026'
      );
    `)
    this.seedDistricts()
    this.seedSettings()
    this.seedDestinations()
  }

  onModuleDestroy() {
    this.db.close()
  }

  private seedDistricts() {
    const count = (this.db.prepare('SELECT COUNT(*) AS c FROM tariff_districts').get() as { c: number }).c
    if (count > 0) return
    const insert = this.db.prepare('INSERT INTO tariff_districts (id, name, in_coverage, status) VALUES (?, ?, ?, ?)')
    const names = ['Distrito I', 'Distrito II', 'Distrito III', 'Distrito IV', 'Distrito V', 'Distrito VI', 'Distrito VII']
    names.forEach((name, index) => {
      const id = String(index + 1)
      insert.run(id, name, 1, 'Verificado OSM 2026')
    })
  }

  private seedSettings() {
    const row = this.db.prepare('SELECT id FROM tariff_settings WHERE id = 1').get()
    if (row) return
    const today = new Date().toISOString().slice(0, 10)
    this.db.prepare('INSERT INTO tariff_settings (id, catalog_updated_at, updated_at) VALUES (1, ?, ?)').run(today, today)
  }

  private seedDestinations() {
    const count = (this.db.prepare('SELECT COUNT(*) AS c FROM tariff_destinations').get() as { c: number }).c
    if (count > 0) return
    const places: Array<[string, string, number, number]> = [
      ['Mercado Oriental', 'Distrito III', 12.1298, -86.2074],
      ['Mercado Roberto Huembes', 'Distrito VI', 12.1189, -86.2512],
      ['Mercado Iván Montenegro', 'Distrito V', 12.1132, -86.2814],
      ['Mercado Israel Lewites', 'Distrito III', 12.1254, -86.2819],
      ['Plaza Inter', 'Distrito II', 12.1052, -86.2704],
      ['Plaza España', 'Distrito II', 12.1412, -86.2663],
      ['Metrocentro', 'Distrito II', 12.1335, -86.2531],
      ['Galerías Santo Domingo', 'Distrito IV', 12.1096, -86.2441],
      ['Multiplaza', 'Distrito IV', 12.0992, -86.2376],
      ['Campus UNAN-Managua', 'Distrito III', 12.1098, -86.2701],
      ['UCA', 'Distrito II', 12.1398, -86.2584],
      ['UAM', 'Distrito I', 12.1014, -86.2831],
      ['Aeropuerto Augusto C. Sandino', 'Distrito V', 12.1407, -86.1791],
      ['Terminal Mayoreo', 'Distrito III', 12.1397, -86.2129],
      ['Parque Central', 'Distrito I', 12.1466, -86.2644],
      ['Hospital Lenin Fonseca', 'Distrito III', 12.1261, -86.2244],
      ['Hospital Roberto Calderón', 'Distrito II', 12.1361, -86.2441],
      ['Hospital Militar', 'Distrito III', 12.1221, -86.2791],
      ['Los Robles', 'Distrito II', 12.1262, -86.2741],
      ['Altamira', 'Distrito II', 12.1321, -86.2612],
      ['Bolonia', 'Distrito II', 12.1242, -86.2531],
      ['Las Colinas', 'Distrito I', 12.1294, -86.2623],
      ['Villa Fontana', 'Distrito II', 12.1182, -86.2454],
      ['Bello Horizonte', 'Distrito III', 12.1364, -86.2793],
      ['Las Mercedes', 'Distrito V', 12.1387, -86.2308],
      ['Ciudad Jardín', 'Distrito II', 12.1451, -86.2384],
      ['La Sabana', 'Distrito IV', 12.1301, -86.2189],
      ['Linda Vista', 'Distrito IV', 12.1275, -86.2881],
      ['Camino de Oriente', 'Distrito VI', 12.1012, -86.2181],
      ['Rubenia', 'Distrito VI', 12.1124, -86.2136],
      ['San Judas', 'Distrito III', 12.1082, -86.2324],
      ['Barrio Cuba', 'Distrito III', 12.1482, -86.2521],
      ['Sabana Grande', 'Distrito VII', 12.0871, -86.2504],
      ['Carretera Sur', 'Distrito VII', 12.0412, -86.2623],
      ['Montoya', 'Distrito VI', 12.0712, -86.2701],
      ['Villa Libertad', 'Distrito VI', 12.0812, -86.2221],
    ]
    const insert = this.db.prepare(
      'INSERT INTO tariff_destinations (id, name, district, category, latitude, longitude, in_coverage, status) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    )
    const guessCategory = (name: string): string => {
      const lower = name.toLowerCase()
      if (lower.includes('mercado')) return 'Mercado'
      if (lower.includes('aeropuerto')) return 'Aeropuerto'
      if (lower.includes('terminal')) return 'Terminal'
      if (lower.includes('hospital')) return 'Hospital'
      if (lower.includes('unan') || lower.includes('uca') || lower.includes('uam')) return 'Universidad'
      if (lower.includes('metrocentro') || lower.includes('plaza') || lower.includes('galerías') || lower.includes('multiplaza')) return 'Centro comercial'
      if (lower.includes('parque') || lower.includes('rotonda') || lower.includes('malecón') || lower.includes('catedral') || lower.includes('estadio')) return 'Punto estratégico'
      return 'Barrio / sector'
    }
    places.forEach(([name, district, latitude, longitude], index) => {
      insert.run(`dst-${String(index + 1).padStart(3, '0')}`, name, district, guessCategory(name), latitude, longitude, 'Verificado OSM 2026')
    })
  }

  private settingsFromRow(row: SettingsRow): TariffSettings {
    return {
      baseFareCs: row.base_fare_cs,
      includedKm: row.included_km,
      surchargePerKmCs: row.surcharge_per_km_cs,
      roadFactor: row.road_factor,
      roundingCs: row.rounding_cs,
      catalogUpdatedAt: row.catalog_updated_at,
      districtsCount: row.districts_count,
      requireCoords: toBool(row.require_coords),
      includeStrategicPoints: toBool(row.include_strategic),
      duplicateDistanceM: row.duplicate_distance_m,
      minRecommendedStatus: row.min_status,
      cartographicSource: row.cartographic_source,
      updatedAt: row.updated_at,
    }
  }

  getSettings(): TariffSettings {
    const row = this.db.prepare('SELECT * FROM tariff_settings WHERE id = 1').get() as unknown as SettingsRow
    return this.settingsFromRow(row)
  }

  updateSettings(partial: Partial<TariffSettings>): TariffSettings {
    const current = this.getSettings()
    const next: TariffSettings = {
      baseFareCs: partial.baseFareCs ?? current.baseFareCs,
      includedKm: partial.includedKm ?? current.includedKm,
      surchargePerKmCs: partial.surchargePerKmCs ?? current.surchargePerKmCs,
      roadFactor: partial.roadFactor ?? current.roadFactor,
      roundingCs: partial.roundingCs ?? current.roundingCs,
      catalogUpdatedAt: partial.catalogUpdatedAt ?? current.catalogUpdatedAt,
      districtsCount: partial.districtsCount ?? current.districtsCount,
      requireCoords: partial.requireCoords ?? current.requireCoords,
      includeStrategicPoints: partial.includeStrategicPoints ?? current.includeStrategicPoints,
      duplicateDistanceM: partial.duplicateDistanceM ?? current.duplicateDistanceM,
      minRecommendedStatus: partial.minRecommendedStatus ?? current.minRecommendedStatus,
      cartographicSource: partial.cartographicSource ?? current.cartographicSource,
      updatedAt: new Date().toISOString(),
    }
    this.db
      .prepare(
        'UPDATE tariff_settings SET base_fare_cs = ?, included_km = ?, surcharge_per_km_cs = ?, road_factor = ?, rounding_cs = ?, catalog_updated_at = ?, districts_count = ?, require_coords = ?, include_strategic = ?, duplicate_distance_m = ?, min_status = ?, cartographic_source = ?, updated_at = ? WHERE id = 1',
      )
      .run(
        next.baseFareCs,
        next.includedKm,
        next.surchargePerKmCs,
        next.roadFactor,
        next.roundingCs,
        next.catalogUpdatedAt,
        next.districtsCount,
        fromBool(next.requireCoords),
        fromBool(next.includeStrategicPoints),
        next.duplicateDistanceM,
        next.minRecommendedStatus,
        next.cartographicSource,
        next.updatedAt,
      )
    return next
  }

  listDistricts(): TariffDistrict[] {
    const rows = this.db.prepare('SELECT * FROM tariff_districts ORDER BY id').all() as unknown as DistrictRow[]
    return rows.map((row) => ({ id: row.id, name: row.name, inCoverage: toBool(row.in_coverage), status: row.status }))
  }

  updateDistrict(id: string, partial: { inCoverage?: boolean; status?: string }): TariffDistrict {
    const row = this.db.prepare('SELECT * FROM tariff_districts WHERE id = ?').get(id) as unknown as DistrictRow | undefined
    if (!row) throw new NotFoundException(`Distrito ${id} no encontrado`)
    if (partial.status !== undefined && !DISTRICT_STATUSES.includes(partial.status)) {
      throw new BadRequestException(`Estado no permitido: ${partial.status}`)
    }
    const next = {
      id: row.id,
      name: row.name,
      inCoverage: partial.inCoverage ?? toBool(row.in_coverage),
      status: partial.status ?? row.status,
    }
    this.db.prepare('UPDATE tariff_districts SET in_coverage = ?, status = ? WHERE id = ?').run(fromBool(next.inCoverage), next.status, id)
    return next
  }

  listDestinations(): TariffDestination[] {
    const rows = this.db.prepare('SELECT * FROM tariff_destinations ORDER BY name').all() as unknown as DestinationRow[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      district: row.district,
      category: row.category,
      latitude: row.latitude,
      longitude: row.longitude,
      inCoverage: toBool(row.in_coverage),
      status: row.status,
    }))
  }

  createDestination(input: Omit<TariffDestination, 'id'>): TariffDestination {
    if (!input.name?.trim()) throw new BadRequestException('El nombre del destino es obligatorio')
    if (!input.district?.trim()) throw new BadRequestException('El distrito es obligatorio')
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
      throw new BadRequestException('Latitud y longitud válidas son obligatorias')
    }
    if (input.status !== undefined && !DISTRICT_STATUSES.includes(input.status)) {
      throw new BadRequestException(`Estado no permitido: ${input.status}`)
    }
    const destination: TariffDestination = {
      id: `dst-${Date.now().toString(36)}`,
      name: input.name.trim(),
      district: input.district,
      category: input.category || 'Barrio / sector',
      latitude: input.latitude,
      longitude: input.longitude,
      inCoverage: input.inCoverage ?? true,
      status: input.status || 'Por verificar',
    }
    this.db
      .prepare('INSERT INTO tariff_destinations (id, name, district, category, latitude, longitude, in_coverage, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(destination.id, destination.name, destination.district, destination.category, destination.latitude, destination.longitude, fromBool(destination.inCoverage), destination.status)
    return destination
  }

  updateDestination(id: string, partial: Partial<Omit<TariffDestination, 'id'>>): TariffDestination {
    const row = this.db.prepare('SELECT * FROM tariff_destinations WHERE id = ?').get(id) as unknown as DestinationRow | undefined
    if (!row) throw new NotFoundException('Destino no encontrado')
    if (partial.status !== undefined && !DISTRICT_STATUSES.includes(partial.status)) {
      throw new BadRequestException(`Estado no permitido: ${partial.status}`)
    }
    const next: TariffDestination = {
      id: row.id,
      name: partial.name ?? row.name,
      district: partial.district ?? row.district,
      category: partial.category ?? row.category,
      latitude: partial.latitude ?? row.latitude,
      longitude: partial.longitude ?? row.longitude,
      inCoverage: partial.inCoverage ?? toBool(row.in_coverage),
      status: partial.status ?? row.status,
    }
    this.db
      .prepare('UPDATE tariff_destinations SET name = ?, district = ?, category = ?, latitude = ?, longitude = ?, in_coverage = ?, status = ? WHERE id = ?')
      .run(next.name, next.district, next.category, next.latitude, next.longitude, fromBool(next.inCoverage), next.status, id)
    return next
  }

  deleteDestination(id: string): { deleted: boolean } {
    const result = this.db.prepare('DELETE FROM tariff_destinations WHERE id = ?').run(id)
    if (result.changes === 0) throw new NotFoundException('Destino no encontrado')
    return { deleted: true }
  }

  calculate(params: { originLat: number; originLng: number; destLat: number; destLng: number; originCoverage?: boolean; destCoverage?: boolean }): FareResult {
    const settings = this.getSettings()
    const straightKm = Math.round(haversineKm(params.originLat, params.originLng, params.destLat, params.destLng) * 100) / 100
    const roadKm = Math.round(straightKm * settings.roadFactor * 100) / 100
    const raw = settings.baseFareCs + Math.max(0, roadKm - settings.includedKm) * settings.surchargePerKmCs
    const fareCs = Math.ceil(raw / settings.roundingCs) * settings.roundingCs
    const originCoverage = params.originCoverage ?? true
    const destCoverage = params.destCoverage ?? true
    const status = originCoverage && destCoverage ? 'TARIFA REFERENCIAL' : 'FUERA DE COBERTURA'
    return {
      straightKm,
      roadKm,
      fareCs,
      status,
      method: 'Centroide del catálogo + factor vial',
      coverage: { origin: originCoverage, destination: destCoverage },
      params: {
        baseFareCs: settings.baseFareCs,
        includedKm: settings.includedKm,
        surchargePerKmCs: settings.surchargePerKmCs,
        roadFactor: settings.roadFactor,
        roundingCs: settings.roundingCs,
      },
    }
  }
}