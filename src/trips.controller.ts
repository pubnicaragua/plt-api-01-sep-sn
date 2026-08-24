import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { TripStatus } from './domain'
import { AssignTripDto } from './dto/assign-trip.dto'
import { CreateTripDto } from './dto/create-trip.dto'
import { OperationsStore } from './operations.store'

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
}
