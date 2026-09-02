import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { FuelStore } from './fuel.store'

class AddFuelDto {
  @IsString()
  plate!: string

  @IsNumber()
  @Min(0.1)
  liters!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerLiterCs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  odometerKm?: number

  @IsOptional()
  @IsString()
  date?: string

  @IsOptional()
  @IsString()
  note?: string
}

@ApiTags('Combustible')
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuel: FuelStore) {}

  @Get()
  @ApiOperation({ summary: 'Recargas de combustible registradas' })
  list(@Query('plate') plate?: string) {
    return this.fuel.list(plate)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas por vehículo: consumo real, costo por km, autonomía' })
  stats(@Query('plate') plate?: string) {
    return this.fuel.statsFor(plate)
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una recarga de combustible de un vehículo' })
  add(@Body() dto: AddFuelDto) {
    return this.fuel.add(dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una recarga' })
  remove(@Param('id') id: string) {
    return this.fuel.remove(id)
  }
}
