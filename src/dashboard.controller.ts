import { Controller, Get, Headers } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly store: OperationsStore) {}

  @Get('summary')
  getSummary(@Headers('authorization') authorization?: string) { return this.store.getSummary(authorization) }
}
