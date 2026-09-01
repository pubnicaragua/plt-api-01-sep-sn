import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { VehiclesStore, type VehicleStatus } from './vehicles.store'

class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  plate!: string

  @IsString()
  @IsNotEmpty()
  model!: string

  @IsString()
  @IsNotEmpty()
  type!: string

  @IsInt()
  @Min(100)
  @Max(20000)
  capacityKg!: number

  @IsInt()
  @Min(2000)
  @Max(2030)
  year!: number
}

class VehicleStatusDto {
  @IsIn(['Disponible', 'En servicio', 'Mantenimiento', 'Fuera de servicio'])
  status!: VehicleStatus
}

class AssignVehicleDto {
  @IsString()
  driver!: string
}

class MaintenanceDto {
  @IsString()
  @IsNotEmpty()
  description!: string

  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number
}

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly store: VehiclesStore) {}

  @Get()
  @ApiOperation({ summary: 'Flota completa de vehículos' })
  list() {
    return this.store.list()
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un vehículo nuevo' })
  create(@Body() body: CreateVehicleDto) {
    return this.store.create(body)
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Historial de mantenimiento de la flota' })
  maintenance(@Query('vehicleId') vehicleId?: string) {
    return this.store.maintenanceHistory(vehicleId)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.store.get(id)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado del vehículo (disponible, servicio, mantenimiento, fuera de servicio)' })
  updateStatus(@Param('id') id: string, @Body() body: VehicleStatusDto) {
    return this.store.updateStatus(id, body.status)
  }

  @Patch(':id/driver')
  @ApiOperation({ summary: 'Asignar o liberar el conductor del vehículo' })
  assignDriver(@Param('id') id: string, @Body() body: AssignVehicleDto) {
    return this.store.assignDriver(id, body.driver)
  }

  @Post(':id/maintenance')
  @ApiOperation({ summary: 'Registrar mantenimiento y pasar el vehículo a mantenimiento' })
  registerMaintenance(@Param('id') id: string, @Body() body: MaintenanceDto) {
    return this.store.registerMaintenance(id, body.description, body.cost ?? 0)
  }
}