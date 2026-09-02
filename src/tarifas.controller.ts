import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { DESTINATION_CATEGORIES, DISTRICT_STATUSES, TarifasStore } from './tarifas.store'

class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFareCs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  includedKm?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  surchargePerKmCs?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  roadFactor?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  roundingCs?: number

  @IsOptional()
  @IsString()
  catalogUpdatedAt?: string

  @IsOptional()
  @IsNumber()
  districtsCount?: number

  @IsOptional()
  @IsBoolean()
  requireCoords?: boolean

  @IsOptional()
  @IsBoolean()
  includeStrategicPoints?: boolean

  @IsOptional()
  @IsNumber()
  duplicateDistanceM?: number

  @IsOptional()
  @IsString()
  minRecommendedStatus?: string

  @IsOptional()
  @IsString()
  cartographicSource?: string
}

class UpdateDistrictDto {
  @IsOptional()
  @IsBoolean()
  inCoverage?: boolean

  @IsOptional()
  @IsIn(DISTRICT_STATUSES)
  status?: string
}

class CreateDestinationDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  district!: string

  @IsOptional()
  @IsIn(DESTINATION_CATEGORIES)
  category?: string

  @IsNumber()
  latitude!: number

  @IsNumber()
  longitude!: number

  @IsOptional()
  @IsBoolean()
  inCoverage?: boolean

  @IsOptional()
  @IsIn(DISTRICT_STATUSES)
  status?: string
}

class UpdateDestinationDto extends CreateDestinationDto {}

class CalculateFareDto {
  @IsNumber()
  originLat!: number

  @IsNumber()
  originLng!: number

  @IsNumber()
  destLat!: number

  @IsNumber()
  destLng!: number

  @IsOptional()
  @IsBoolean()
  originCoverage?: boolean

  @IsOptional()
  @IsBoolean()
  destCoverage?: boolean
}

@ApiTags('tarifas')
@Controller('tarifas')
export class TarifasController {
  constructor(private readonly store: TarifasStore) {}

  @Get()
  @ApiOperation({ summary: 'Estado completo del módulo de tarifas: parámetros, distritos y catálogo' })
  overview() {
    return {
      settings: this.store.getSettings(),
      districts: this.store.listDistricts(),
      destinations: this.store.listDestinations(),
    }
  }

  @Get('settings')
  @ApiOperation({ summary: 'Parámetros editables del catálogo y tarifarios' })
  settings() {
    return this.store.getSettings()
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar parámetros editables (celdas amarillas del catálogo)' })
  updateSettings(@Body() body: UpdateSettingsDto) {
    return this.store.updateSettings(body)
  }

  @Get('districts')
  @ApiOperation({ summary: 'Distritos con cobertura y estado de verificación' })
  districts() {
    return this.store.listDistricts()
  }

  @Patch('districts/:id')
  @ApiOperation({ summary: 'Cobertura Sí/No y estado permitido de un distrito' })
  updateDistrict(@Param('id') id: string, @Body() body: UpdateDistrictDto) {
    return this.store.updateDistrict(id, body)
  }

  @Get('destinations')
  @ApiOperation({ summary: 'Catálogo de destinos (alimenta las validaciones de la calculadora)' })
  destinations() {
    return this.store.listDestinations()
  }

  @Post('destinations')
  @ApiOperation({ summary: 'Agregar un destino al catálogo' })
  createDestination(@Body() body: CreateDestinationDto) {
    return this.store.createDestination({ name: body.name, district: body.district, category: body.category ?? 'Barrio / sector', latitude: body.latitude, longitude: body.longitude, inCoverage: body.inCoverage ?? true, status: body.status ?? 'Por verificar' })
  }

  @Patch('destinations/:id')
  @ApiOperation({ summary: 'Editar un destino del catálogo' })
  updateDestination(@Param('id') id: string, @Body() body: UpdateDestinationDto) {
    return this.store.updateDestination(id, { name: body.name, district: body.district, category: body.category, latitude: body.latitude, longitude: body.longitude, inCoverage: body.inCoverage, status: body.status })
  }

  @Delete('destinations/:id')
  @ApiOperation({ summary: 'Eliminar un destino del catálogo' })
  deleteDestination(@Param('id') id: string) {
    return this.store.deleteDestination(id)
  }

  @Post('calculator')
  @ApiOperation({ summary: 'Calcular tarifa comercial: km en línea recta, km viales y redondeo' })
  calculate(@Body() body: CalculateFareDto) {
    return this.store.calculate(body)
  }
}