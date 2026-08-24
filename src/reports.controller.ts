import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly store: OperationsStore) {}

  @Get('summary')
  summary() {
    return this.store.getReports()
  }
}

