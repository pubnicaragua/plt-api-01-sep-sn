import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { MANAGUA_PLACES } from './managua.places'

interface PlaceOut {
  placeId: string
  description: string
  main: string
  secondary: string
  latitude?: number
  longitude?: number
}

const NICA_CITIES = [
  { name: 'Managua', zone: 'Departamento de Managua', latitude: 12.1149, longitude: -86.2362 },
  { name: 'León', zone: 'Departamento de León', latitude: 12.4359, longitude: -86.8794 },
  { name: 'Granada', zone: 'Departamento de Granada', latitude: 11.9299, longitude: -85.9562 },
  { name: 'Masaya', zone: 'Departamento de Masaya', latitude: 11.9745, longitude: -86.0946 },
  { name: 'Estelí', zone: 'Departamento de Estelí', latitude: 13.092, longitude: -86.3552 },
  { name: 'Matagalpa', zone: 'Departamento de Matagalpa', latitude: 12.9286, longitude: -85.9189 },
  { name: 'Chinandega', zone: 'Departamento de Chinandega', latitude: 12.6293, longitude: -87.1275 },
  { name: 'Jinotega', zone: 'Departamento de Jinotega', latitude: 13.0912, longitude: -86.0017 },
  { name: 'Rivas', zone: 'Departamento de Rivas', latitude: 11.437, longitude: -85.8265 },
  { name: 'Bluefields', zone: 'RAAS', latitude: 12.0137, longitude: -83.7633 },
  { name: 'Puerto Cabezas', zone: 'RACCN', latitude: 14.0317, longitude: -83.3822 },
  { name: 'Somoto', zone: 'Departamento de Madriz', latitude: 13.4815, longitude: -86.5815 },
  { name: 'Ocotal', zone: 'Departamento de Nueva Segovia', latitude: 13.6347, longitude: -86.4753 },
  { name: 'Boaco', zone: 'Departamento de Boaco', latitude: 12.4719, longitude: -85.6615 },
  { name: 'Juigalpa', zone: 'Departamento de Chontales', latitude: 12.106, longitude: -85.365 },
  { name: 'Nueva Guinea', zone: 'RAAS', latitude: 11.6884, longitude: -84.4562 },
  { name: 'San Juan del Sur', zone: 'Departamento de Rivas', latitude: 11.2516, longitude: -85.8729 },
  { name: 'Tipitapa', zone: 'Departamento de Managua', latitude: 12.1983, longitude: -86.098 },
  { name: 'Ciudad Sandino', zone: 'Departamento de Managua', latitude: 12.1598, longitude: -86.3625 },
  { name: 'Diriamba', zone: 'Departamento de Carazo', latitude: 11.8574, longitude: -86.2406 },
  { name: 'Jinotepe', zone: 'Departamento de Carazo', latitude: 11.8467, longitude: -86.2003 },
  { name: 'Nagarote', zone: 'Departamento de León', latitude: 12.2671, longitude: -86.5706 },
  { name: 'La Paz Centro', zone: 'Departamento de León', latitude: 12.343, longitude: -86.6706 },
  { name: 'Masatepe', zone: 'Departamento de Masaya', latitude: 11.9156, longitude: -86.1453 },
  { name: 'Condega', zone: 'Departamento de Estelí', latitude: 13.3663, longitude: -86.3958 },
  { name: 'El Crucero', zone: 'Departamento de Managua', latitude: 11.9869, longitude: -86.3087 },
  { name: 'Sébaco', zone: 'Departamento de Matagalpa', latitude: 12.854, longitude: -86.102 },
  { name: 'Ticuantepe', zone: 'Departamento de Managua', latitude: 12.0242, longitude: -86.202 },
  { name: 'Nindirí', zone: 'Departamento de Masaya', latitude: 11.9866, longitude: -86.1195 },
  { name: 'Villa El Carmen', zone: 'Departamento de Managua', latitude: 11.981, longitude: -86.512 },
]

const ALL_PLACES = [...MANAGUA_PLACES, ...NICA_CITIES.map((city) => ({
  name: city.name,
  zone: city.zone,
  latitude: city.latitude,
  longitude: city.longitude,
}))]

@ApiTags('places')
@Controller('places')
export class PlacesController {
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete de lugares de todo Nicaragua (Google Places; catálogo local como respaldo)' })
  async autocomplete(@Query('q') query: string) {
    if (!query || query.trim().length < 2) return []

    const term = query.trim()

    // 1) Google Places primero: cualquier lugar de Nicaragua
    const google = await this.googleSuggestions(term)
    if (google.length > 0) return google

    // 2) Respaldo local (sin key de Google o sin respuesta): catálogo + búsqueda difusa
    return this.localSuggestions(term)
  }

  private localSuggestions(term: string) {
    const lower = term.toLowerCase().trim()
    const tokens = lower.split(/\s+/).filter((token) => token.length >= 2)
    const scored = ALL_PLACES.map((place) => {
      const nameLower = place.name.toLowerCase()
      const zoneLower = place.zone.toLowerCase()
      const haystack = `${nameLower} ${zoneLower}`
      let score = -1
      if (nameLower === lower) score = 100
      else if (nameLower.startsWith(lower)) score = 90
      else if (tokens.length > 0 && tokens.every((token) => nameLower.includes(token)))
        score = 70 + tokens.length
      else if (tokens.length > 0 && tokens.every((token) => haystack.includes(token)))
        score = 45
      else if (tokens.length === 1 && nameLower.includes(tokens[0]))
        score = 30
      else if (tokens.length === 1 && zoneLower.includes(tokens[0]))
        score = 12
      return { place, score }
    })
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ place }) => ({
        placeId: `mg-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description: `${place.name}, ${place.zone} · Nicaragua`,
        main: place.name,
        secondary: `${place.zone} · Nicaragua`,
        latitude: place.latitude,
        longitude: place.longitude,
      }))
    return scored
  }

  private async googleSuggestions(term: string): Promise<PlaceOut[]> {
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key || key.trim().length < 20) return []

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
      url.searchParams.set('input', term)
      url.searchParams.set('components', 'country:ni')
      url.searchParams.set('language', 'es')
      url.searchParams.set('key', key)

      const response = await fetch(url)
      if (!response.ok) return []

      const data = (await response.json()) as {
        status?: string
        predictions?: Array<{
          description: string
          place_id: string
          structured_formatting?: { main_text: string; secondary_text?: string }
        }>
      }

      if (data.status !== 'OK' || !data.predictions) return []

      return data.predictions.slice(0, 8).map((prediction) => ({
        placeId: prediction.place_id,
        description: prediction.description,
        main: prediction.structured_formatting?.main_text ?? prediction.description,
        secondary: prediction.structured_formatting?.secondary_text ?? '',
      }))
    } catch {
      return []
    }
  }

  private async googlePlaceDetail(placeId: string) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key || key.trim().length < 20) return undefined
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
      url.searchParams.set('place_id', placeId)
      url.searchParams.set('fields', 'geometry/location')
      url.searchParams.set('key', key)
      const response = await fetch(url)
      if (!response.ok) return undefined
      const data = (await response.json()) as {
        status?: string
        result?: { geometry?: { location?: { lat: number; lng: number } } }
      }
      if (data.status !== 'OK' || !data.result?.geometry?.location) return undefined
      return {
        latitude: data.result.geometry.location.lat,
        longitude: data.result.geometry.location.lng,
      }
    } catch {
      return undefined
    }
  }

  @Get('detail')
  @ApiOperation({ summary: 'Detalle de un lugar por placeId (Google Places o catálogo local)' })
  async detail(@Query('place_id') placeId: string) {
    if (!placeId) return {}
    if (placeId.startsWith('mg-')) {
      const name = placeId.slice(3).replaceAll('-', ' ')
      const match = ALL_PLACES.find((place) => place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === placeId.slice(3))
      if (match) return { latitude: match.latitude, longitude: match.longitude, name }
    }
    const detail = await this.googlePlaceDetail(placeId)
    return detail ?? {}
  }
}
