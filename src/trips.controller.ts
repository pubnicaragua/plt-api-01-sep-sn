import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn } from 'class-validator'
import type { TripStatus } from './domain'
import { AssignTripDto } from './dto/assign-trip.dto'
import { CreateTripDto } from './dto/create-trip.dto'
import { OperationsStore } from './operations.store'

class UpdateTripStatusDto {
  @IsIn(['Pendiente', 'Asignado', 'En camino', 'En entrega', 'Completado', 'Cancelado'])
  status!: TripStatus
}

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  @ApiOperation({ summary: 'Listado de viajes y solicitudes' })
  list(@Query('status') status?: TripStatus) { return this.store.listTrips(status) }

  @Post()
  @ApiOperation({ summary: 'Crear una solicitud de viaje' })
  create(@Body() body: CreateTripDto) { return this.store.createTrip(body) }

  @Get(':id')
  get(@Param('id') id: string) { return this.store.getTrip(id) }

  @Get(':id/tracking')
  tracking(@Param('id') id: string) { return this.store.getTracking(id) }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Asignar un conductor disponible a un viaje' })
  assign(@Param('id') id: string, @Body() body: AssignTripDto) { return this.store.assignTrip(id, body.driverId) }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transición de estado del viaje (en camino, en entrega, completado, cancelado…)' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateTripStatusDto) { return this.store.updateTripStatus(id, body.status) }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un viaje (libera al conductor si estaba asignado)' })
  delete(@Param('id') id: string) { return this.store.deleteTrip(id) }
}
