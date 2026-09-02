import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'
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

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cliente' })
  delete(@Param('id') id: string) {
    return this.store.deleteClient(id)
  }
}