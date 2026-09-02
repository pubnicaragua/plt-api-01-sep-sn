import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('places')
@Controller('places')
export class PlacesController {
  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete de direcciones con Google Places' })
  async autocomplete(@Query('q') query: string) {
    if (!query || query.trim().length < 3) return []

    const key = process.env.GOOGLE_MAPS_API_KEY
    if (!key || key.trim().length < 20) {
      return []
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input', query.trim())
    url.searchParams.set('components', 'country:ni')
    url.searchParams.set('language', 'es')
    url.searchParams.set('key', key)

    const response = await fetch(url)
    if (!response.ok) return []

    const data = (await response.json()) as {
      status?: string
      error_message?: string
      predictions?: Array<{
        description: string
        place_id: string
        structured_formatting?: { main_text: string; secondary_text?: string }
      }>
    }

    if (data.status !== 'OK' || !data.predictions) return []

    return data.predictions.map((prediction) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      main: prediction.structured_formatting?.main_text ?? prediction.description,
      secondary: prediction.structured_formatting?.secondary_text ?? '',
    }))
  }
}
