import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { OperationsStore } from './operations.store'

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

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un conductor (bloqueado si tiene viajes activos)' })
  delete(@Param('id') id: string) {
    return this.store.deleteDriver(id)
  }
}