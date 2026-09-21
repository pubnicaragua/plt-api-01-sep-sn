import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'
import type { IncidentPriority, IncidentStatus } from './domain'
import { OperationsStore } from './operations.store'

class UpdateIncidentStatusDto {
  @IsIn(['Abierta', 'En proceso', 'Resuelta'])
  status!: IncidentStatus
}

class UpdateIncidentEvidenceDto {
  @IsString()
  evidence!: string
}

class CreateIncidentDto {
  @IsOptional()
  @IsIn(['general', 'trip'])
  scope?: 'general' | 'trip'

  @IsString()
  @IsNotEmpty()
  type!: string

  @IsString()
  @IsNotEmpty()
  client!: string

  @IsOptional()
  @IsString()
  trip?: string

  @IsOptional()
  @IsString()
  driver?: string

  @IsOptional()
  @IsIn(['Baja', 'Media', 'Alta', 'Crítica'])
  priority?: IncidentPriority

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsNumber()
  latitude?: number

  @IsOptional()
  @IsNumber()
  longitude?: number

  @IsOptional()
  @IsString()
  evidence?: string
}

@ApiTags('incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly store: OperationsStore) {}

  @Get('notifications')
  @ApiOperation({ summary: 'Incidencias recientes destinadas a la sesión móvil actual' })
  notifications(@Headers('authorization') authorization?: string) {
    return this.store.listMobileIncidentNotifications(authorization)
  }

  @Get()
  @ApiOperation({ summary: 'Incidencias de la operación' })
  list() {
    return this.store.listIncidents()
  }

  @Post()
  @ApiOperation({ summary: 'Reportar una incidencia nueva con descripción, GPS y evidencia (abierta por defecto)' })
  create(@Body() body: CreateIncidentDto) {
    const tripValue = body.trip?.trim() ?? ''
    const driverValue = body.driver?.trim() ?? ''
    const legacyGeneral = ['', '—', '-', 'General'].includes(tripValue)
      && ['', '—', '-', 'Todos los conductores'].includes(driverValue)
    const inferredScope = body.scope ?? (legacyGeneral ? 'general' : 'trip')
    return this.store.createIncident({
      scope: inferredScope,
      trip: body.trip?.trim() || (inferredScope === 'general' ? 'General' : '—'),
      driver: body.driver?.trim() || (inferredScope === 'general' ? 'Todos los conductores' : '—'),
      client: body.client,
      type: body.type,
      priority: body.priority ?? 'Media',
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      evidence: body.evidence,
    })
  }

@Patch(':id/status')
  @ApiOperation({ summary: 'Transici��n de la incidencia: abierta, en proceso o resuelta' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateIncidentStatusDto) {
    return this.store.updateIncidentStatus(id, body.status)
  }

  @Patch(':id/evidence')
  @ApiOperation({ summary: 'Adjuntar o reemplazar la evidencia fotogr��fica de una incidencia' })
  updateEvidence(@Param('id') id: string, @Body() body: UpdateIncidentEvidenceDto) {
    return this.store.updateIncidentEvidence(id, body.evidence)
  }
}
