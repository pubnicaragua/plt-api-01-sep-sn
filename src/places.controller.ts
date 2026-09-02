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
    const scored = MANAGUA_PLACES.map((place) => {
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
        description: `${place.name}, ${place.zone} · Managua`,
        main: place.name,
        secondary: `${place.zone} · Managua`,
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
      const match = MANAGUA_PLACES.find((place) => place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === placeId.slice(3))
      if (match) return { latitude: match.latitude, longitude: match.longitude, name }
    }
    const detail = await this.googlePlaceDetail(placeId)
    return detail ?? {}
  }
}
