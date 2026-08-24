import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { OperationsStore } from './operations.store'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly store: OperationsStore) {}

  @Post('login')
  @ApiOperation({ summary: 'Login de prototipo por rol' })
  login(@Body() body: LoginDto) {
    return this.store.login(body)
  }

  @Post('register')
  @ApiOperation({ summary: 'Registro de prototipo para empresa o conductor' })
  register(@Body() body: RegisterDto) {
    return this.store.register(body)
  }
}
