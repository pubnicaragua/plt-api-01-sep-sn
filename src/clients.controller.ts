import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'
import { OperationsStore } from './operations.store'

class CreateClientDto {
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
  type?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  contact?: string

  @IsOptional()
  @IsString()
  taxId?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  dueDay?: number
}

class UpdateClientDto {
  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  contact?: string

  @IsOptional()
  @IsString()
  taxId?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  dueDay?: number
}

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  @ApiOperation({ summary: 'Clientes corporativos y particulares' })
  list() {
    return this.store.listClients()
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un cliente nuevo (activo por defecto)' })
  create(@Body() body: CreateClientDto) {
    return this.store.createClient(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos del cliente, incluidos días de crédito y día de cobro' })
  update(@Param('id') id: string, @Body() body: UpdateClientDto) {
    return this.store.updateClient(id, body)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cliente' })
  delete(@Param('id') id: string) {
    return this.store.deleteClient(id)
  }
}