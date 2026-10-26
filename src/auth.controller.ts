import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MinLength } from 'class-validator'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { OperationsStore } from './operations.store'

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string

  @IsString()
  @MinLength(8)
  newPassword!: string
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly store: OperationsStore) {}

  @Post('login')
  @ApiOperation({ summary: 'Login de prototipo por rol' })
  login(@Body() body: LoginDto) {
    return this.store.login(body)
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Cambiar la contraseña del perfil activo' })
  changePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ChangePasswordDto,
  ) {
    return this.store.changeOwnPassword(authorization, body)
  }

  @Get('session/:token')
  @ApiOperation({ summary: 'Valida si una sesión sigue activa (cerrada remotamente si fue revocada)' })
  checkSession(@Param('token') token: string) {
    return this.store.checkSession(token)
  }

  @Post('register')
  @ApiOperation({ summary: 'Registro de prototipo para empresa o conductor' })
  register(@Body() body: RegisterDto) {
    return this.store.register(body)
  }
}
