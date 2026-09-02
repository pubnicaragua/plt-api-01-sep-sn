import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { OperationsStore } from './operations.store'

class DriverLocationDto {
  @IsString()
  @IsNotEmpty()
  driver!: string

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  speedKmh?: number

  @IsOptional()
  @IsString()
  source?: string
}

class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  vehicle?: string

  @IsOptional()
  @IsString()
  plate?: string

  @IsOptional()
  @IsBoolean()
  external?: boolean

  @IsOptional()
  @IsString()
  licenseNo?: string

  @IsOptional()
  @IsString()
  licenseExp?: string

  @IsOptional()
  @IsString()
  docNo?: string

  @IsOptional()
  @IsString()
  notes?: string
}

class UpdateDriverDto {
  @IsOptional()
  @IsString()
  vehicle?: string

  @IsOptional()
  @IsString()
  plate?: string

  @IsOptional()
  @IsBoolean()
  external?: boolean

  @IsOptional()
  @IsString()
  licenseNo?: string

  @IsOptional()
  @IsString()
  licenseExp?: string

  @IsOptional()
  @IsString()
  docNo?: string

  @IsOptional()
  @IsString()
  notes?: string
}

@ApiTags('drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  @ApiOperation({ summary: 'Conductores con disponibilidad, vehículo y posición' })
  list() {
    return this.store.listDrivers()
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un conductor nuevo (disponible por defecto)' })
  create(@Body() body: CreateDriverDto) {
    return this.store.createDriver(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar vehículo y marca de proveedor tercerizado de un conductor' })
  update(@Param('id') id: string, @Body() body: UpdateDriverDto) {
    return this.store.updateDriver(id, body)
  }

  @Post('location')
  @ApiOperation({ summary: 'Enviar la posición en tiempo real del conductor (la app móvil la reporta cada ~20 s)' })
  location(@Body() body: DriverLocationDto) {
    this.store.updateDriverLocation(body.driver, body.latitude, body.longitude, body.accuracy ?? 0, body.speedKmh ?? 0, body.source ?? 'app')
    return { ok: true, driver: body.driver, updatedAt: new Date().toISOString() }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un conductor (bloqueado si tiene viajes activos)' })
  delete(@Param('id') id: string) {
    return this.store.deleteDriver(id)
  }
}