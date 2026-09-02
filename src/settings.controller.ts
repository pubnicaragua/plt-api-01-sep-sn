import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator'
import { SettingsStore, type SettingsPatch, type VehicleRate } from './settings.store'

class VehicleRateDto implements VehicleRate {
  @IsNumber()
  @Min(0)
  baseFeeCs!: number

  @IsNumber()
  @Min(0)
  farePerKmCs!: number
}

class UpdateSettingsDto implements SettingsPatch {
  @IsOptional()
  @IsNumber()
  @Min(1)
  dollarRate?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelPriceGasolineCs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelPriceDieselCs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFeeCs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  farePerKmCs?: number

  @IsOptional()
  @IsObject()
  vehicleRates?: Record<'Moto' | 'Vehículo' | 'Camión', VehicleRateDto>

  @IsOptional()
  @IsNumber()
  @Min(0)
  prioritySurchargePct?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  scheduledSurchargePct?: number

  @IsOptional()
  @IsString()
  companyName?: string

  @IsOptional()
  @IsString()
  companyPhone?: string

  @IsOptional()
  @IsString()
  companyEmail?: string

  @IsOptional()
  @IsString()
  companyAddress?: string
}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly store: SettingsStore) {}

  @Get()
  @ApiOperation({ summary: 'Configuración operativa: tasa de cambio del dólar y tarifas en córdobas (C$)' })
  get() {
    return this.store.get()
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar tasa de cambio, precios de combustible, tarifas por vehículo o datos de la empresa' })
  update(@Body() body: UpdateSettingsDto) {
    return this.store.update(body)
  }
}