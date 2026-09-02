import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { MANAGUA_PLACES } from './managua.places'

@ApiTags('places')
@Controller('places')
export class PlacesController {
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete de lugares de Managua: catálogo local + Google Places (si hay key)' })
  async autocomplete(@Query('q') query: string) {
    if (!query || query.trim().length < 2) return []

    const term = query.trim().toLowerCase()
    const local = MANAGUA_PLACES.filter((place) =>
      `${place.name} ${place.zone}`.toLowerCase().includes(term),
    )
      .slice(0, 8)
      .map((place) => ({
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