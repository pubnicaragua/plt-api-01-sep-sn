import { Controller, Get, Headers } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  list(@Headers('authorization') authorization?: string) {
    return this.store.listHistory(authorization)
  }
}

