import { Injectable } from '@nestjs/common'
import type { Trip } from './domain'
import { OperationsStore } from './operations.store'
import { SettingsStore } from './settings.store'
import { VehiclesStore } from './vehicles.store'

function dateKey(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() - offsetDays)
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(date)
}

function dateKeyFull(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() - offsetDays)
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const round2 = (value: number) => Number(value.toFixed(2))
const round1 = (value: number) => Number(value.toFixed(1))

@Injectable()
export class FinanceStore {
  private readonly fleetConsumptionKm: number

  constructor(
    private readonly operations: OperationsStore,
    private readonly vehicles: VehiclesStore,
    private readonly settings: SettingsStore,
  ) {
    const consumptions = this.vehicles.list().map((vehicle) => vehicle.consumptionLPerKm).filter((value) => value > 0)
    this.fleetConsumptionKm = consumptions.length ? consumptions.reduce((sum, value) => sum + value, 0) / consumptions.length : 0.1
  }

  private fuelCsPerTrip(trip: Trip) {
    const distanceKm = trip.distanceKm ?? 0
    if (distanceKm <= 0) return 0
    const driver = this.operations.listDrivers().find((candidate) => candidate.name === trip.driver)
    const vehicle = driver?.plate ? this.vehicles.list().find((candidate) => candidate.plate === driver.plate) : undefined
    const consumption = vehicle && vehicle.consumptionLPerKm > 0 ? vehicle.consumptionLPerKm : this.fleetConsumptionKm
    const rate = this.settings.get()
    let fuelPrice = vehicle?.fuelType === 'Diésel' ? rate.fuelPriceDieselCs : rate.fuelPriceGasolineCs
    if (vehicle?.fuelType === 'Eléctrico') fuelPrice = 0
    if (vehicle?.fuelType === 'Híbrido') fuelPrice = fuelPrice * 0.5
    return distanceKm * consumption * fuelPrice
  }

  private maintenanceCsSince(days: number | null) {
    const keys = days === null
      ? null
      : new Set(Array.from({ length: days + 1 }, (_, offset) => dateKeyFull(offset).toLowerCase()))
    return this.vehicles.maintenanceHistory()
      .filter((record) => !keys || keys.has(record.date.toLowerCase()))
      .reduce((sum, record) => sum + record.cost, 0)
  }

  private tripsOfPeriod(days: number | null) {
    const keys = days === null
      ? null
      : new Set(Array.from({ length: days + 1 }, (_, offset) => dateKey(offset)))
    return this.operations.listTrips().filter((trip) => !keys || keys.has(trip.date))
  }

  private summarize(trips: Trip[], days: number | null) {
    const completed = trips.filter((trip) => trip.status === 'Completado')
    const executable = trips.filter((trip) => trip.status !== 'Pendiente' && trip.status !== 'Cancelado' && trip.status !== 'Anulado')
    const incomeCs = completed.reduce((sum, trip) => sum + (trip.estimatedCostCs ?? 0), 0)
    const fuelCs = executable.reduce((sum, trip) => sum + this.fuelCsPerTrip(trip), 0)
    const maintenanceCs = this.maintenanceCsSince(days)
    const distanceKm = executable.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0)
    const marginCs = incomeCs - fuelCs - maintenanceCs
    return {
      label: days === null ? 'Histórico' : days === 0 ? 'Hoy' : days <= 6 ? '7 días' : '30 días',
      trips: completed.length,
      km: round1(distanceKm),
      incomeCs: round2(incomeCs),
      fuelCs: round2(fuelCs),
      maintenanceCs: round2(maintenanceCs),
      marginCs: round2(marginCs),
      avgTripCs: completed.length ? round2(incomeCs / completed.length) : 0,
      avgPerKmCs: distanceKm > 0 ? round2(incomeCs / distanceKm) : 0,
    }
  }

  getSummary() {
    const all = this.operations.listTrips()
    const completed = all.filter((trip) => trip.status === 'Completado')
    const invoicing = all.filter((trip) => ['Asignado', 'En camino', 'En entrega'].includes(trip.status))
    const daily = []
    for (let offset = 13; offset >= 0; offset -= 1) {
      const dayKey = dateKey(offset)
      const dayTrips = all.filter((trip) => trip.date === dayKey)
      const dayCompleted = dayTrips.filter((trip) => trip.status === 'Completado')
      const incomeCs = dayCompleted.reduce((sum, trip) => sum + (trip.estimatedCostCs ?? 0), 0)
      const fuelCs = dayTrips.reduce((sum, trip) => sum + this.fuelCsPerTrip(trip), 0)
      daily.push({ label: dayKey, incomeCs: round2(incomeCs), fuelCs: round2(fuelCs) })
    }
    const clientTotals = new Map<string, { trips: number; incomeCs: number; fuelCs: number }>()
    for (const trip of completed) {
      const current = clientTotals.get(trip.client) ?? { trips: 0, incomeCs: 0, fuelCs: 0 }
      current.trips += 1
      current.incomeCs += trip.estimatedCostCs ?? 0
      current.fuelCs += this.fuelCsPerTrip(trip)
      clientTotals.set(trip.client, current)
    }
    const topClients = Array.from(clientTotals.entries())
      .sort((a, b) => b[1].incomeCs - a[1].incomeCs)
      .slice(0, 5)
      .map(([name, total]) => ({
        name,
        trips: total.trips,
        incomeCs: round2(total.incomeCs),
        fuelCs: round2(total.fuelCs),
        marginCs: round2(total.incomeCs - total.fuelCs),
      }))
    const distanceKm = all.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0)
    return {
      generatedAt: new Date().toISOString(),
      currency: 'C$',
      periods: {
        today: this.summarize(this.tripsOfPeriod(0), 0),
        week: this.summarize(this.tripsOfPeriod(6), 6),
        month: this.summarize(this.tripsOfPeriod(29), 29),
        all: this.summarize(all, null),
      },
      invoicingCs: round2(invoicing.reduce((sum, trip) => sum + (trip.estimatedCostCs ?? 0), 0)),
      invoicingTrips: invoicing.length,
      daily,
      topClients,
      fleet: {
        vehicles: this.vehicles.list().length,
        drivers: this.operations.listDrivers().length,
        activeTrips: invoicing.length,
        completedTrips: completed.length,
        totalDistanceKm: round1(distanceKm),
        avgIncomePerKmCs: distanceKm > 0 ? round2(completed.reduce((sum, trip) => sum + (trip.estimatedCostCs ?? 0), 0) / distanceKm) : 0,
        avgFuelPerKmCs: round2(distanceKm > 0 ? all.reduce((sum, trip) => sum + this.fuelCsPerTrip(trip), 0) / distanceKm : 0),
        avgTripCs: completed.length ? round2(completed.reduce((sum, trip) => sum + (trip.estimatedCostCs ?? 0), 0) / completed.length) : 0,
      },
    }
  }
}
