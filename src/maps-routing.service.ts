import { Injectable } from '@nestjs/common'

export interface DrivingRoutePoint {
  latitude: number
  longitude: number
}

export interface DrivingRoute {
  points: DrivingRoutePoint[]
  distanceKm: number
  durationSeconds: number
  provider: 'google'
}

type CachedRoute = { expiresAt: number; value: DrivingRoute | null }

@Injectable()
export class MapsRoutingService {
  private readonly cache = new Map<string, CachedRoute>()
  private readonly cacheTtlMs = 5 * 60 * 1000

  async getDrivingRoute(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
  ): Promise<DrivingRoute | null> {
    const key = [originLat, originLng, destinationLat, destinationLng]
      .map((value) => value.toFixed(5))
      .join(',')
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    const apiKey = String(process.env.GOOGLE_MAPS_API_KEY ?? '').trim()
    if (!apiKey) return null

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
    url.search = new URLSearchParams({
      origin: `${originLat},${originLng}`,
      destination: `${destinationLat},${destinationLng}`,
      mode: 'driving',
      alternatives: 'false',
      departure_time: 'now',
      traffic_model: 'best_guess',
      key: apiKey,
    }).toString()

    let value: DrivingRoute | null = null
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(9000) })
      if (response.ok) {
        const payload = await response.json() as Record<string, unknown>
        if (payload.status === 'OK' && Array.isArray(payload.routes) && payload.routes.length > 0) {
          const route = payload.routes[0] as Record<string, unknown>
          const points = decodePolyline(
            String(((route.overview_polyline as Record<string, unknown> | undefined)?.points) ?? ''),
          )
          const legs = Array.isArray(route.legs) ? route.legs as Array<Record<string, unknown>> : []
          const distanceMeters = legs.reduce((sum, leg) => sum + numberValue((leg.distance as Record<string, unknown> | undefined)?.value), 0)
          const durationSeconds = legs.reduce((sum, leg) => {
            const traffic = (leg.duration_in_traffic as Record<string, unknown> | undefined)?.value
            const normal = (leg.duration as Record<string, unknown> | undefined)?.value
            return sum + numberValue(traffic ?? normal)
          }, 0)
          if (points.length >= 2) {
            value = {
              points,
              distanceKm: Number((distanceMeters / 1000).toFixed(2)),
              durationSeconds: Math.max(0, Math.round(durationSeconds)),
              provider: 'google',
            }
          }
        }
      }
    } catch {
      value = null
    }

    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs })
    return value
  }
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function decodePolyline(encoded: string): DrivingRoutePoint[] {
  const points: DrivingRoutePoint[] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    const nextLatitude = decodeValue(encoded, index)
    if (!nextLatitude) break
    index = nextLatitude.index
    latitude += nextLatitude.value
    const nextLongitude = decodeValue(encoded, index)
    if (!nextLongitude) break
    index = nextLongitude.index
    longitude += nextLongitude.value
    points.push({ latitude: latitude / 100000, longitude: longitude / 100000 })
  }
  return points
}

function decodeValue(encoded: string, start: number): { index: number; value: number } | null {
  let result = 0
  let shift = 0
  let index = start
  while (index < encoded.length) {
    const byte = encoded.charCodeAt(index++) - 63
    result |= (byte & 0x1f) << shift
    shift += 5
    if (byte < 0x20) {
      return { index, value: (result & 1) ? ~(result >> 1) : result >> 1 }
    }
  }
  return null
}
