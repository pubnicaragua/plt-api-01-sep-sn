import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import type { TripStatus } from './domain'
import { AssignTripDto } from './dto/assign-trip.dto'
import { CreateTripDto } from './dto/create-trip.dto'
import { OperationsStore } from './operations.store'

class UpdateTripStatusDto {
  @IsIn(['Pendiente', 'Asignado', 'En camino', 'En entrega', 'Completado', 'Cancelado', 'Anulado'])
  status!: TripStatus
}

class UpdateTripPaymentDto {
  @IsOptional()
  @IsIn(['Efectivo', 'Transferencia', 'Financiamiento', 'Contra entrega', ''])
  method?: string

  @IsOptional()
  @IsString()
  ref?: string

  @IsOptional()
  @IsNumber()
  amount?: number

  @IsOptional()
  @IsString()
  date?: string

  @IsOptional()
  @IsString()
  dueDate?: string
}

class UpdateTripFareDto {
  @IsNumber()
  @Min(0)
  estimatedCostCs!: number
}

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  @ApiOperation({ summary: 'Listado de viajes y solicitudes' })
  list(@Query('status') status?: TripStatus, @Query('driver') driver?: string) { return this.store.listTrips(status, driver) }

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
  @ApiOperation({ summary: 'Transición de estado del viaje (en camino, en entrega, completado, anulado…)' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateTripStatusDto) { return this.store.updateTripStatus(id, body.status) }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Registrar el pago del viaje: efectivo, transferencia (cuenta/referencia), financiamiento o contra entrega; la fecha de cobro se calcula desde el crédito del cliente.' })
  updatePayment(@Param('id') id: string, @Body() body: UpdateTripPaymentDto) {
    return this.store.updateTripPayment(id, { method: body.method as 'Efectivo', ref: body.ref, amount: body.amount, date: body.date, dueDate: body.dueDate })
  }

  @Patch(':id/fare')
  @ApiOperation({ summary: 'Ajustar la tarifa del viaje en el momento de la facturación' })
  updateFare(@Param('id') id: string, @Body() body: UpdateTripFareDto) {
    return this.store.updateTripFare(id, body.estimatedCostCs)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un viaje (libera al conductor si estaba asignado)' })
  delete(@Param('id') id: string) { return this.store.deleteTrip(id) }
}
