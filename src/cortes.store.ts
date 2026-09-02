import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { BillingPeriod, Client, Corte, CorteItem } from './domain'
import { OperationsStore } from './operations.store'

/** Desplazamiento de zona horaria de referencia (America/Managua, sin horario de verano). */
const TZ_OFFSET_MS = -6 * 3600 * 1000

const DAY_MS = 24 * 3600 * 1000

const ES_MONTHS: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', sept: '09', oct: '10', nov: '11', dic: '12',
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
}

function slugOf(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase()
}

/** Fecha local (UTC-6) en partes UTC para aritmética estable. */
function localOf(date: Date) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    wd: shifted.getUTCDay(),
    hh: shifted.getUTCHours(),
    mm: shifted.getUTCMinutes(),
    ms: shifted.getTime(),
  }
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

interface WindowConfig {
  period: BillingPeriod | 'auto'
  days: number
  cutDay: number
  cutTime: string
  mensual: boolean
  dayOfMonth: number
}

function configOf(client: Client): WindowConfig {
  const period = client.billingPeriod ?? 'semanal'
  const days = period === 'quincenal' ? 14 : period === 'personalizado' ? Math.max(1, client.billingCustomDays ?? 7) : 7
  return {
    period,
    days,
    cutDay: Math.max(0, Math.min(6, client.billingCutDay ?? 0)),
    cutTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(client.billingCutTime ?? '') ? (client.billingCutTime as string) : '22:00',
    mensual: period === 'mensual',
    dayOfMonth: period === 'mensual' ? Math.max(1, client.billingCutDay ?? 1) : 1,
  }
}

/** Calcula la última frontera de corte <= ahora y la ventana anterior. */
export function windowFor(client: Client, now = new Date()): { start: Date; end: Date } {
  const cfg = configOf(client)
  const local = localOf(now)
  const [hh, mm] = cfg.cutTime.split(':').map(Number)
  const cutInDay = (hh * 3600 + mm * 60) * 1000

  if (cfg.mensual) {
    const day = Math.min(cfg.dayOfMonth, daysInMonth(local.y, local.m))
    let end = Date.UTC(local.y, local.m, day, hh, mm)
    if (end > local.ms) {
      const prevMonth = local.m === 0 ? 11 : local.m - 1
      const prevYear = local.m === 0 ? local.y - 1 : local.y
      end = Date.UTC(prevYear, prevMonth, Math.min(cfg.dayOfMonth, daysInMonth(prevYear, prevMonth)), hh, mm)
    }
    const endDate = new Date(end)
    const endLocal = localOf(endDate)
    const startMonth = endLocal.m - 1 < 0 ? 11 : endLocal.m - 1
    const startYear = endLocal.m - 1 < 0 ? endLocal.y - 1 : endLocal.y
    const start = Date.UTC(startYear, startMonth, Math.min(cfg.dayOfMonth, daysInMonth(startYear, startMonth)), hh, mm)
    return { start: new Date(start), end: new Date(end) }
  }

  // Boundary semanal: fechas con weekday == cutDay, cada `days` días, ancladas al 2024-01-07.
  const anchorBase = Date.UTC(2024, 0, 7)
  const anchorDate = new Date(anchorBase)
  const anchorWeekday = anchorDate.getUTCDay()
  let anchorMs = anchorBase
  if (anchorWeekday !== cfg.cutDay) {
    let delta = (cfg.cutDay - anchorWeekday + 7) % 7
    if (delta < 0) delta = 0
    anchorMs = anchorBase + delta * DAY_MS
  }
  const spacing = cfg.days * DAY_MS
  const n = Math.floor((local.ms - anchorMs) / spacing)
  let boundary = anchorMs + n * spacing + cutInDay
  if (boundary > local.ms) boundary -= spacing
  const end = new Date(boundary)
  const start = new Date(boundary - spacing)
  return { start, end }
}

export function labelOf(period: BillingPeriod | 'auto', customDays?: number) {
  if (period === 'semanal') return 'Semanal'
  if (period === 'quincenal') return 'Quincenal'
  if (period === 'mensual') return 'Mensual'
  if (period === 'personalizado') return `Cada ${customDays ?? 7} días`
  return 'Periódico'
}

function fmtShort(date: Date) {
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(date)
}

/** Convierte fecha de viaje 'DD-mmm' a Date en la zona local, usando el año de la ventana. */
function parseTripDate(text: string, end: Date): Date | null {
  const match = /(\d{1,2})[/ .-]+([a-zA-Z\u00c0-\u024f]+)/.exec(text.trim())
  if (!match) return null
  const day = Number(match[1])
  const month = ES_MONTHS[match[2].toLowerCase()]
  if (!month || day < 1) return null
  const endLocal = localOf(end)
  let year = endLocal.y
  if (Number(month) - endLocal.m > 6) year -= 1
  else if (endLocal.m - Number(month) > 6) year += 1
  return new Date(Date.UTC(year, Number(month) - 1, day, 12, 0))
}

@Injectable()
export class CortesStore implements OnModuleDestroy {
  private readonly db: DatabaseSync
  private readonly log = (...args: unknown[]) => console.log('[cortes]', ...args)

  constructor(private readonly operations: OperationsStore) {
    this.db = new DatabaseSync(resolve(process.env.INCOEX_DB_PATH ?? 'data/incoex-local.sqlite'), { timeout: 5000 })
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cortes (
        id TEXT PRIMARY KEY,
        client TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'semanal',
        custom_days INTEGER NOT NULL DEFAULT 0,
        period_label TEXT NOT NULL DEFAULT '',
        items_json TEXT NOT NULL DEFAULT '[]',
        total_cs INTEGER NOT NULL DEFAULT 0,
        previous_debt_cs INTEGER NOT NULL DEFAULT 0,
        grand_total_cs INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pendiente',
        created_at INTEGER NOT NULL,
        paid_at INTEGER,
        paid_amount_cs INTEGER,
        method TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        sent_whatsapp INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS incoex_meta (key TEXT PRIMARY KEY, value TEXT);
    `)
    if (!String((this.db.prepare('SELECT value FROM incoex_meta WHERE key = ?').get('cortes_v1') as { value?: string } | undefined)?.value)) {
      this.db.prepare("INSERT INTO incoex_meta (key, value) VALUES ('cortes_v1', '1')").run()
    }
    this.tick()
    this.timer = setInterval(() => this.tick(), 60_000)
  }

  private timer?: NodeJS.Timeout

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    this.db.close()
  }

  private tick() {
    try {
      this.generateDue()
    } catch (error) {
      this.log('error de programa:', (error as Error).message)
    }
  }

  /** Genera el corte pendiente de todos los clientes activos que ya vencieron (domingo 22:00 etc.). */
  generateDue(): string[] {
    const due = this.operations.listClients().filter((client) => client.billingActive && client.status === 'Activo')
    const created: string[] = []
    for (const client of due) {
      const corte = this.generateForClient(client, new Date(), true)
      if (corte) created.push(corte.id)
    }
    if (created.length > 0) this.log('cortes generados:', created.length)
    return created
  }

  /** Genera (o reutiliza) el corte del periodo vencido del cliente. */
  generateForClient(client: Client, now: Date, onlyDue: boolean): Corte | null {
    const window = windowFor(client, now)
    if (onlyDue && window.end.getTime() > now.getTime() + 60_000) return null
    const id = `corte-${slugOf(client.name)}-${window.end.toISOString().slice(0, 10)}`
    const existing = this.db.prepare('SELECT id FROM cortes WHERE id = ?').get(id) as { id: string } | undefined
    if (existing) return this.getCorte(id)
    const items = this.itemsOf(client.name, window)
    const previousDebt = Number((this.db.prepare("SELECT COALESCE(SUM(total_cs), 0) AS debt FROM cortes WHERE lower(client) = lower(?) AND status = 'pendiente' AND period_end <= ?").get(client.name, window.start.toISOString()) as { debt: number }).debt)
    if (items.length === 0 && previousDebt === 0) return null
    const total = items.reduce((sum, item) => sum + item.priceCs, 0)
    const cfg = configOf(client)
    this.db.prepare('INSERT INTO cortes (id, client, period_start, period_end, period, custom_days, period_label, items_json, total_cs, previous_debt_cs, grand_total_cs, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, client.name, window.start.toISOString(), window.end.toISOString(), cfg.period, cfg.days, labelOf(cfg.period, client.billingCustomDays), JSON.stringify(items), total, previousDebt, total + previousDebt, 'pendiente', Date.now())
    return this.getCorte(id)
  }

  private itemsOf(clientName: string, window: { start: Date; end: Date }): CorteItem[] {
    const list: CorteItem[] = []
    for (const trip of this.operations.listTrips()) {
      if (trip.client.trim().toLowerCase() !== clientName.trim().toLowerCase()) continue
      if (['Anulado', 'Cancelado'].includes(trip.status)) continue
      const at = parseTripDate(trip.date, window.end)
      if (!at || at.getTime() < window.start.getTime() || at.getTime() > window.end.getTime()) continue
      list.push({
        id: trip.id,
        date: fmtShort(at),
        origin: trip.origin,
        destination: trip.destination,
        description: trip.description,
        packages: trip.packages,
        status: trip.status,
        priceCs: Math.round(trip.estimatedCostCs ?? 0),
      })
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }

  listCortes(options: { client?: string; status?: string; limit?: number } = {}): Corte[] {
    const where: string[] = []
    const params: unknown[] = []
    if (options.client && options.client.trim()) {
      where.push('lower(client) = lower(?)')
      params.push(options.client.trim())
    }
    if (options.status && options.status.trim()) {
      where.push('status = ?')
      params.push(options.status.trim())
    }
    const sql = `SELECT * FROM cortes ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY period_end DESC LIMIT ${Math.min(500, Math.max(1, options.limit ?? 200))}`
    const rows = this.db.prepare(sql).all(...(params as Array<string | number | bigint | null | Uint8Array>)) as unknown as Array<Record<string, unknown>>
    return rows.map((row) => this.mapRow(row))
  }

  getCorte(id: string): Corte {
    const row = this.db.prepare('SELECT * FROM cortes WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw new NotFoundException('Corte no encontrado')
    return this.mapRow(row)
  }

  private mapRow(row: Record<string, unknown>): Corte {
    let items: CorteItem[] = []
    try {
      items = JSON.parse(String(row.items_json)) as CorteItem[]
    } catch {
      items = []
    }
    return {
      id: String(row.id),
      client: String(row.client),
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
      period: (row.period ?? 'semanal') as BillingPeriod,
      customDays: Number(row.custom_days ?? 0),
      periodLabel: String(row.period_label ?? ''),
      items,
      totalCs: Number(row.total_cs ?? 0),
      previousDebtCs: Number(row.previous_debt_cs ?? 0),
      grandTotalCs: Number(row.grand_total_cs ?? Number(row.total_cs ?? 0)),
      status: (row.status ?? 'pendiente') as Corte['status'],
      createdAt: new Date(Number(row.created_at ?? 0)).toISOString(),
      paidAt: row.paid_at ? new Date(Number(row.paid_at)).toISOString() : undefined,
      paidAmountCs: row.paid_amount_cs === undefined || row.paid_amount_cs === null ? undefined : Number(row.paid_amount_cs),
      method: String(row.method ?? ''),
      notes: String(row.notes ?? ''),
      sentWhatsapp: Number(row.sent_whatsapp ?? 0) === 1,
    }
  }

  markPaid(id: string, input: { method?: string; notes?: string; amountCs?: number }) {
    const corte = this.getCorte(id)
    if (corte.status === 'anulado') throw new NotFoundException('El corte está anulado')
    const amount = Math.max(0, Math.min(Math.round(input.amountCs ?? corte.grandTotalCs), corte.grandTotalCs))
    this.db.prepare("UPDATE cortes SET status = 'pagado', paid_at = ?, paid_amount_cs = ?, method = ?, notes = ? WHERE id = ?")
      .run(Date.now(), amount, input.method ?? '', input.notes ?? '', id)
    return this.getCorte(id)
  }

  annul(id: string) {
    this.db.prepare("UPDATE cortes SET status = 'anulado' WHERE id = ? AND status != 'pagado'").run(id)
    return this.getCorte(id)
  }

  markSent(id: string) {
    this.db.prepare('UPDATE cortes SET sent_whatsapp = 1 WHERE id = ?').run(id)
    return this.getCorte(id)
  }
}
