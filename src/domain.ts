export type TripStatus = 'Pendiente' | 'Asignado' | 'En camino' | 'En entrega' | 'Completado' | 'Cancelado' | 'Anulado'
export type DriverStatus = 'Disponible' | 'En viaje' | 'En entrega' | 'Fuera de servicio'
export type IncidentPriority = 'Baja' | 'Media' | 'Alta' | 'Crítica'
export type IncidentStatus = 'Abierta' | 'En proceso' | 'Resuelta'

export interface Trip {
  id: string
  client: string
  driver: string
  origin: string
  destination: string
  date: string
  packages: number
  status: TripStatus
  latitude?: number
  longitude?: number
  description?: string
  recipientName?: string
  recipientPhone?: string
  fragile?: boolean
  originLat?: number
  originLng?: number
  destinationLat?: number
  destinationLng?: number
  distanceKm?: number
  estimatedCostCs?: number
  serviceType?: 'Urbano' | 'Express' | 'Programado'
  contactName?: string
  contactPhone?: string
  pickupTime?: string
  originRefs?: string
  destinationRefs?: string
  paymentMethod?: 'Efectivo' | 'Transferencia' | 'Financiamiento' | 'Contra entrega' | ''
  paymentRef?: string
  paymentAmount?: number
  paymentDate?: string
  paymentStatus?: 'Sin pagar' | 'Parcial' | 'Pagado'
  dueDate?: string
}

export interface AppNotification {
  id: string
  driverId: string
  title: string
  body: string
  tripId: string
  time: string
  read: boolean
}

export interface Driver {
  id: string
  name: string
  phone: string
  email?: string
  vehicle: string
  plate: string
  status: DriverStatus
  route: string
  latitude: number
  longitude: number
  external?: boolean
}

export interface Client {
  id: string
  name: string
  type: string
  phone: string
  email: string
  address?: string
  contact?: string
  taxId?: string
  notes?: string
  existed?: boolean
  trips: number
  activeRequests: number
  status: 'Activo' | 'Suspendido'
  creditDays?: number
  dueDay?: number
}

export interface Incident {
  id: string
  trip: string
  driver: string
  client: string
  type: string
  priority: IncidentPriority
  status: IncidentStatus
  description?: string
  latitude?: number
  longitude?: number
  evidence?: string
}

export interface HistoryEvent {
  id: string
  time: string
  date: string
  type: 'Entrega' | 'Asignación' | 'Solicitud' | 'Incidencia' | 'Recogida' | 'Conexión'
  title: string
  detail: string
  color: 'blue' | 'mint' | 'gold' | 'red' | 'slate'
}

export interface ReportSummary {
  totalTrips: number
  completedTrips: number
  cancelledTrips: number
  averageDistanceKm: number
  totalDistanceKm: number
  totalRevenueCs: number
  weeklyTrips: number[]
  weeklyLabels: string[]
  dailyDeliveries: number[]
  dailyLabels: string[]
  topDrivers: Array<{ name: string; trips: number }>
  topClients: Array<{ name: string; trips: number }>
  topVehicles?: Array<{ plate: string; model: string; trips: number; km: number; incomeCs: number }>
  driverVehicle?: Array<{ name: string; vehicle: string; trips: number; incomeCs: number }>
}
