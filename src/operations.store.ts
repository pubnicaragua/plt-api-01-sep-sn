import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Client, Driver, HistoryEvent, Incident, ReportSummary, Trip, TripStatus } from './domain'

@Injectable()
export class OperationsStore {
  private readonly trips: Trip[] = [
    { id: '#4791', client: 'Logística MX', driver: 'Sin asignar', origin: 'Polanco', destination: 'Santa Fe', date: '27 Ago', packages: 5, status: 'Pendiente' },
    { id: '#4790', client: 'Farmacia Express', driver: 'Juan Pérez', origin: 'Condesa', destination: 'Coyoacán', date: '27 Ago', packages: 2, status: 'Asignado' },
    { id: '#4789', client: 'TechParts SA', driver: 'Roberto Sánchez', origin: 'Reforma', destination: 'Nápoles', date: '27 Ago', packages: 1, status: 'En camino' },
    { id: '#4788', client: 'Distribuidora Norte', driver: 'Ana López', origin: 'Anzures', destination: 'Del Valle', date: '27 Ago', packages: 8, status: 'En entrega' },
    { id: '#4787', client: 'María García', driver: 'Pedro Ruiz', origin: 'Roma Norte', destination: 'Xochimilco', date: '27 Ago', packages: 3, status: 'Completado' },
    { id: '#4786', client: 'Alimentos Fresh', driver: 'Sin asignar', origin: 'Tepito', destination: 'Iztapalapa', date: '27 Ago', packages: 12, status: 'Pendiente' },
    { id: '#4785', client: 'Industrias Vega', driver: 'Miguel Torres', origin: 'Centro', destination: 'Azcapotzalco', date: '27 Ago', packages: 4, status: 'Completado' },
    { id: '#4784', client: 'Electronica Plus', driver: 'Carlos Díaz', origin: 'Tlalpan', destination: 'Pedregal', date: '26 Ago', packages: 2, status: 'Completado' },
  ]

  private readonly drivers: Driver[] = [
    { id: 'drv-001', name: 'Juan Pérez', phone: '55-1234-5678', vehicle: 'Ford Transit 2023', plate: 'ABC-1234', status: 'En viaje', route: 'Polanco → Coyoacán', latitude: 12.126, longitude: -86.261 },
    { id: 'drv-002', name: 'Roberto Sánchez', phone: '55-2345-6789', vehicle: 'Nissan NV200', plate: 'DEF-5678', status: 'En viaje', route: 'Reforma → Nápoles', latitude: 12.112, longitude: -86.246 },
    { id: 'drv-003', name: 'Ana López', phone: '55-3456-7890', vehicle: 'Chevrolet Express', plate: 'GHI-9012', status: 'En entrega', route: 'Anzures → Del Valle', latitude: 12.135, longitude: -86.279 },
    { id: 'drv-004', name: 'Pedro Ruiz', phone: '55-4567-8901', vehicle: 'Mercedes Sprinter', plate: 'JKL-3456', status: 'Disponible', route: 'Sin viaje activo', latitude: 12.121, longitude: -86.244 },
    { id: 'drv-005', name: 'Miguel Torres', phone: '55-5678-9012', vehicle: 'Renault Kangoo', plate: 'MNO-7890', status: 'Disponible', route: 'Sin viaje activo', latitude: 12.102, longitude: -86.268 },
    { id: 'drv-006', name: 'Carlos Díaz', phone: '55-6789-0123', vehicle: 'VW Caddy', plate: 'PQR-2345', status: 'Fuera de servicio', route: 'Mantenimiento programado', latitude: 12.139, longitude: -86.231 },
  ]

  private readonly clients: Client[] = [
    { id: 'cli-001', name: 'Logística MX', type: 'Logística MX SA de CV', phone: '55-1111-2222', email: 'contacto@logisticamx.com', trips: 45, activeRequests: 2, status: 'Activo' },
    { id: 'cli-002', name: 'Farmacia Express', type: 'Farmacia Express SA', phone: '55-3333-4444', email: 'ops@farmaciaexpress.com', trips: 38, activeRequests: 1, status: 'Activo' },
    { id: 'cli-003', name: 'TechParts SA', type: 'TechParts SA de CV', phone: '55-5555-6666', email: 'envios@techparts.mx', trips: 22, activeRequests: 1, status: 'Activo' },
    { id: 'cli-004', name: 'Distribuidora Norte', type: 'Dist. Norte SA', phone: '55-7777-8888', email: 'logistica@distnorte.mx', trips: 67, activeRequests: 1, status: 'Activo' },
    { id: 'cli-005', name: 'Alimentos Fresh', type: 'Alimentos Fresh', phone: '55-9999-0000', email: 'pedidos@alimentosfresh.com', trips: 28, activeRequests: 1, status: 'Activo' },
  ]

  private readonly incidents: Incident[] = [
    { id: 'INC-0034', trip: '#4778', driver: 'Juan Pérez', client: 'Logística MX', type: 'Retraso', priority: 'Alta', status: 'Abierta' },
    { id: 'INC-0033', trip: '#4783', driver: '—', client: 'Papelería Central', type: 'Cliente ausente', priority: 'Media', status: 'Abierta' },
    { id: 'INC-0032', trip: '#4776', driver: 'Carlos Díaz', client: 'Electronica Plus', type: 'Problema con paquete', priority: 'Alta', status: 'En proceso' },
    { id: 'INC-0031', trip: '#4770', driver: 'Ana López', client: 'Alimentos Fresh', type: 'Problema con dirección', priority: 'Media', status: 'En proceso' },
    { id: 'INC-0030', trip: '#4765', driver: 'Roberto Sánchez', client: 'TechParts SA', type: 'Retraso', priority: 'Baja', status: 'Resuelta' },
  ]

  private readonly history: HistoryEvent[] = [
    { id: 'EVT-001', time: '09:42', date: '27 Ago', type: 'Entrega', title: 'Entrega completada', detail: 'Viaje #4782 · María García · Pedro Ruiz', color: 'mint' },
    { id: 'EVT-002', time: '09:38', date: '27 Ago', type: 'Asignación', title: 'Conductor asignado', detail: 'Viaje #4790 · Farmacia Express · Juan Pérez', color: 'blue' },
    { id: 'EVT-003', time: '09:35', date: '27 Ago', type: 'Solicitud', title: 'Nueva solicitud recibida', detail: 'Solicitud #SR-0125 · Logística MX', color: 'blue' },
    { id: 'EVT-004', time: '09:30', date: '27 Ago', type: 'Incidencia', title: 'Incidencia reportada', detail: 'Viaje #4778 · Retraso por tráfico intenso', color: 'gold' },
    { id: 'EVT-005', time: '09:25', date: '27 Ago', type: 'Recogida', title: 'Recogida confirmada', detail: 'Viaje #4785 · 4 paquetes en Centro Histórico', color: 'mint' },
    { id: 'EVT-006', time: '09:20', date: '27 Ago', type: 'Conexión', title: 'Conductor conectado', detail: 'Roberto Sánchez · Nissan NV200', color: 'slate' },
  ]

  getSummary() {
    return {
      tripsToday: 47,
      activeTrips: this.trips.filter((trip) => ['Asignado', 'En camino', 'En entrega'].includes(trip.status)).length + 4,
      pendingTrips: this.trips.filter((trip) => trip.status === 'Pendiente').length + 3,
      completedTrips: 32,
      activeDrivers: this.drivers.filter((driver) => driver.status !== 'Fuera de servicio').length + 14,
      registeredClients: 156,
      packagesInTransit: 28,
      openIncidents: this.incidents.filter((incident) => incident.status !== 'Resuelta').length,
    }
  }

  listTrips(status?: TripStatus) { return status ? this.trips.filter((trip) => trip.status === status) : this.trips }
  listDrivers() { return this.drivers }
  listClients() { return this.clients }
  listIncidents() { return this.incidents }
  listHistory() { return this.history }

  getTrackingOverview() {
    return {
      activeOperations: this.getSummary().activeTrips,
      drivers: this.drivers,
      trips: this.trips.filter((trip) => trip.status !== 'Completado' && trip.status !== 'Cancelado'),
      incidents: this.incidents.filter((incident) => incident.status !== 'Resuelta'),
    }
  }

  getReports(): ReportSummary {
    return {
      totalTrips: 347,
      completedTrips: 312,
      cancelledTrips: 8,
      averageDeliveryMinutes: 102,
      weeklyTrips: [78, 85, 92, 92],
      weeklyLabels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
      dailyDeliveries: [42, 38, 45, 50, 55, 35, 22],
      dailyLabels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      topDrivers: [
        { name: 'Juan Pérez', trips: 52 },
        { name: 'Roberto Sánchez', trips: 48 },
        { name: 'Ana López', trips: 45 },
        { name: 'Pedro Ruiz', trips: 41 },
        { name: 'Miguel Torres', trips: 38 },
      ],
      topClients: [
        { name: 'Distribuidora Norte', trips: 67 },
        { name: 'Logística MX', trips: 45 },
        { name: 'Farmacia Express', trips: 38 },
        { name: 'Alimentos Fresh', trips: 28 },
        { name: 'TechParts SA', trips: 22 },
      ],
    }
  }

  createTrip(input: { client: string; origin: string; destination: string; packages: number; description?: string; recipientName?: string; recipientPhone?: string; fragile?: boolean }) {
    const nextNumber = 4792 + this.trips.length
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
    }
    this.trips.unshift(trip)
    return trip
  }

  login(input: { email: string; role: 'company' | 'driver' | 'admin' }) {
    const driver = input.role === 'driver' ? this.drivers.find((candidate) => candidate.id === 'drv-006') : undefined
    return {
      accessToken: 'prototype-token-replace-before-production',
      user: {
        id: input.role === 'driver' ? 'drv-006' : input.role === 'company' ? 'cli-001' : 'admin-001',
        email: input.email,
        role: input.role,
        displayName: input.role === 'driver' ? 'Carlos Díaz' : input.role === 'company' ? 'Mario Belfort' : 'Carlos Mendoza',
        vehicle: driver?.vehicle,
        plate: driver?.plate,
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
    return trip
  }

  getTracking(id: string) {
    const trip = this.getTrip(id)
    return {
      tripId: trip.id,
      status: trip.status,
      driver: trip.driver,
      lastUpdate: new Date().toISOString(),
      route: [
        { latitude: 12.128, longitude: -86.264, label: 'Centro de distribución' },
        { latitude: 12.121, longitude: -86.253, label: 'En tránsito' },
        { latitude: 12.114, longitude: -86.244, label: 'Destino' },
      ],
    }
  }
}
