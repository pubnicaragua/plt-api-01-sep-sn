import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'
import { OperationsStore } from './operations.store'

class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  username!: string

  @IsString()
  @IsNotEmpty()
  displayName!: string

  @IsString()
  @MinLength(8)
  password!: string
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string

  @IsOptional()
  @IsIn(['Activo', 'Inactivo'])
  status?: 'Activo' | 'Inactivo'
}

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  @ApiOperation({ summary: 'Perfiles de la cuenta empresarial autenticada' })
  list(@Headers('authorization') authorization?: string) {
    return this.store.listCompanyProfiles(authorization)
  }

  @Post()
  @ApiOperation({ summary: 'Crear un perfil operativo' })
  create(@Headers('authorization') authorization: string | undefined, @Body() body: CreateProfileDto) {
    return this.store.createCompanyProfile(authorization, body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar, activar o desactivar un perfil operativo' })
  update(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() body: UpdateProfileDto) {
    return this.store.updateCompanyProfile(authorization, id, body)
  }
}
