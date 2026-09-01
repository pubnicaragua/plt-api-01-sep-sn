import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { UsersStore, type UserRole } from './users.store'

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsEmail()
  email!: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsIn(['admin', 'management', 'operations', 'finance', 'support', 'driver', 'corporate', 'store'])
  role!: UserRole
}

class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'management', 'operations', 'finance', 'support', 'driver', 'corporate', 'store'])
  role?: UserRole

  @IsOptional()
  @IsIn(['Activo', 'Inactivo'])
  status?: 'Activo' | 'Inactivo'
}

@ApiTags('admin')
@Controller('admin')
export class UsersController {
  constructor(private readonly store: UsersStore) {}

  @Get('users')
  @ApiOperation({ summary: 'Usuarios de la plataforma con su rol' })
  listUsers() {
    return this.store.listUsers()
  }

  @Get('roles')
  @ApiOperation({ summary: 'Matriz de los ocho roles contractuales con permisos' })
  listRoles() {
    return this.store.listRoles()
  }

  @Post('users')
  @ApiOperation({ summary: 'Crear un usuario con un rol' })
  createUser(@Body() body: CreateUserDto) {
    return this.store.createUser(body)
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Cambiar rol o estado de un usuario' })
  updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.store.updateUser(id, body)
  }
}