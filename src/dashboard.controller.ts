import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly store: OperationsStore) {}

  @Get('summary')
  getSummary() { return this.store.getSummary() }
}
