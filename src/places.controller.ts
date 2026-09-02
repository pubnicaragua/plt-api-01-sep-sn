import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { MANAGUA_PLACES } from './managua.places'

@ApiTags('places')
@Controller('places')
export class PlacesController {
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete de lugares de Managua: catálogo local + Google Places (si hay key)' })
  async autocomplete(@Query('q') query: string) {
    if (!query || query.trim().length < 1) return []

    const term = query.trim().toLowerCase()

    const startsOrContains = (text: string) => {
      const lower = text.toLowerCase()
      return lower.startsWith(term) || lower.includes(term)
    }

    const scored = MANAGUA_PLACES.map((place) => {
      const haystack = `${place.name} ${place.zone}`
      const nameLower = place.name.toLowerCase()
      let score = 0
      if (nameLower.startsWith(term)) score = 3
      else if (nameLower === term) score = 4
      else if (`${place.name} ${place.zone}`.toLowerCase().startsWith(term)) score = 2
      else if (nameLower.includes(term)) score = 1
      else if (place.zone.toLowerCase().includes(term)) score = 0
      else score = -1
      return { place, score }
    })
      .filter((entry) => startsOrContains(`${entry.place.name} ${entry.place.zone}`))
      .sort((a, b) => b.score - a.score)

    const local = scored
      .slice(0, 10)
      .map(({ place }) => ({
        placeId: `mg-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description: `${place.name}, ${place.zone} · Managua`,
        main: place.name,
        secondary: `${place.zone} · Managua`,
        latitude: place.latitude,
        longitude: place.longitude,
      }))

    const google = await this.googleSuggestions(term)

    const seen = new Set(local.map((item) => item.main.toLowerCase()))
    const merged: Array<{ placeId: string; description: string; main: string; secondary: string; latitude?: number; longitude?: number }> = [...local]
    for (const prediction of google) {
      const key = prediction.main.toLowerCase()
      if (!seen.has(key)) {
        merged.push(prediction)
        seen.add(key)
      }
    }
    return merged.slice(0, 10)
  }

  @Get('detail')
  @ApiOperation({ summary: 'Coordenadas de un lugar sugerido (catálogo local o Google Places)' })
  async detail(@Query('place_id') placeId: string) {
    if (!placeId) return null
    if (placeId.startsWith('mg-')) {
      const local = MANAGUA_PLACES.find((place) => `mg-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` === placeId)
      if (local) return { placeId, latitude: local.latitude, longitude: local.longitude }
    }
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (key && key.trim().length >= 20) {
      try {
        const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
        url.searchParams.set('place_id', placeId)
        url.searchParams.set('fields', 'geometry')
        url.searchParams.set('language', 'es')
        url.searchParams.set('key', key)
        const response = await fetch(url)
        const data = (await response.json()) as {
          status?: string
          result?: { geometry?: { location?: { lat: number; lng: number } } }
        }
        if (data.status === 'OK' && data.result?.geometry?.location) {
          return { placeId, latitude: data.result.geometry.location.lat, longitude: data.result.geometry.location.lng }
        }
      } catch {
        // sin coordenadas; el cliente queda con el lugar seleccionado sin punto
      }
    }
    return null
  }

  private async googleSuggestions(term: string) {
    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key || key.trim().length < 20) return []

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
      url.searchParams.set('input', term)
      url.searchParams.set('components', 'country:ni')
      url.searchParams.set('location', '12.114993,-86.236174')
      url.searchParams.set('radius', '30000')
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

      return data.predictions
        .slice(0, 6)
        .map((prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          main: prediction.structured_formatting?.main_text ?? prediction.description,
          secondary: prediction.structured_formatting?.secondary_text ?? '',
        }))
    } catch {
      return []
    }
  }
}