import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  list() {
    return this.store.listHistory()
  }
}

