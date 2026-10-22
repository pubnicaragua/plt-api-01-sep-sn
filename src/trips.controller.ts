import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import type { Trip, TripStatus } from './domain'
import { AssignTripDto } from './dto/assign-trip.dto'
import { CreateTripDto } from './dto/create-trip.dto'
import { OperationsStore } from './operations.store'

class UpdateTripStatusDto {
  @IsIn(['Pendiente', 'Asignado', 'En camino', 'En entrega', 'Completado', 'Cancelado', 'Anulado'])
  status!: TripStatus

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string
}

class UpdateTripPaymentDto {
  @IsOptional()
  @IsIn(['Efectivo', 'Transferencia', 'Tarjeta', 'Financiamiento', 'Contra entrega', ''])
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

class UpdateTripScheduleDto {
  @IsString()
  @IsNotEmpty()
  scheduledDate!: string

  @IsString()
  @IsNotEmpty()
  scheduledTime!: string
}

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  @ApiOperation({ summary: 'Listado de viajes y solicitudes' })
  list(@Query('status') status?: TripStatus, @Query('driver') driver?: string, @Query('client') client?: string, @Headers('authorization') authorization?: string) { return this.store.listTrips(status, driver, client, authorization) }

  @Post()
  @ApiOperation({ summary: 'Crear una solicitud de viaje' })
  create(@Body() body: CreateTripDto, @Headers('authorization') authorization?: string) {
    const active = authorization ? this.store.getProfileScope(authorization) : undefined
    if (!active) throw new UnauthorizedException('Inicia sesión para crear un viaje o envío')
    return this.store.createTrip({ ...body, profileId: active?.profileId })
  }

  @Get(':id')
  get(@Param('id') id: string, @Headers('authorization') authorization?: string) { return this.store.getTrip(id, authorization) }

  @Get(':id/tracking')
  tracking(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.getTracking(id)
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Asignar un conductor disponible a un viaje' })
  assign(@Param('id') id: string, @Body() body: AssignTripDto, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.assignTrip(id, body.driverId)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transición de estado del viaje (en camino, en entrega, completado, anulado…)' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateTripStatusDto, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.updateTripStatus(id, body.status, body.reason)
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Modificar la fecha y hora de un viaje programado' })
  updateSchedule(@Param('id') id: string, @Body() body: UpdateTripScheduleDto, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.updateTripSchedule(id, body.scheduledDate, body.scheduledTime)
  }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Registrar el pago del viaje: efectivo, transferencia, tarjeta, financiamiento o contra entrega; la fecha de cobro se calcula desde el crédito del cliente.' })
  updatePayment(@Param('id') id: string, @Body() body: UpdateTripPaymentDto, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.updateTripPayment(id, { method: body.method as Trip['paymentMethod'], ref: body.ref, amount: body.amount, date: body.date, dueDate: body.dueDate })
  }

  @Patch(':id/fare')
  @ApiOperation({ summary: 'Ajustar la tarifa del viaje en el momento de la facturación' })
  updateFare(@Param('id') id: string, @Body() body: UpdateTripFareDto, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.updateTripFare(id, body.estimatedCostCs)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un viaje (libera al conductor si estaba asignado)' })
  delete(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    this.store.getTrip(id, authorization)
    return this.store.deleteTrip(id)
  }
}
