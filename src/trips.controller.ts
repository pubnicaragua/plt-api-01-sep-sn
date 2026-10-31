import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import type { Trip, TripStatus } from './domain'
import { AssignTripDto } from './dto/assign-trip.dto'
import { CreateTripDto } from './dto/create-trip.dto'
import { OperationsStore } from './operations.store'
import { FileInterceptor } from '@nestjs/platform-express'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const PICKUP_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const PICKUP_EVIDENCE_DIR = resolve(process.env.INCOEX_EVIDENCE_PATH ?? 'data/uploads/evidence')

class UpdateTripStatusDto {
  @IsIn(['Pendiente', 'Asignado', 'En camino', 'En entrega', 'Completado', 'Cancelado', 'Anulado'])
  status!: TripStatus

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  deliveryCode?: string
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
    return this.store.updateTripStatus(id, body.status, body.reason, body.deliveryCode)
  }

  @Post(':id/pickup-confirmation')
  @ApiOperation({ summary: 'Validar código y foto de la recogida del conductor' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  pickupConfirmation(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body('deliveryCode') deliveryCode: string, @Headers('authorization') authorization?: string) {
    if (!file) throw new BadRequestException('Debes tomar una foto del paquete recogido')
    const extension = extname(file.originalname).toLowerCase()
    if (!PICKUP_IMAGE_EXTENSIONS.includes(extension)) throw new BadRequestException('La evidencia de recogida debe ser una foto JPG, PNG o WEBP')
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '') || 'trip'
    mkdirSync(PICKUP_EVIDENCE_DIR, { recursive: true })
    const filename = `pickup-${safeId}-${Date.now()}${extension}`
    writeFileSync(resolve(PICKUP_EVIDENCE_DIR, filename), file.buffer)
    return this.store.confirmPickupWithEvidence(authorization, id, deliveryCode, { filename, url: `/api/uploads/evidence/${filename}` })
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
    const trip = this.store.getTrip(id, authorization)
    if (['Completado', 'Finalizado', 'Entregado', 'Entregada'].includes(trip.status)) {
      this.store.assertCanPayInvoices(authorization)
    }
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
