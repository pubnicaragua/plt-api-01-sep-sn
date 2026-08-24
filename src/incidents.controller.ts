import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  list() {
    return this.store.listIncidents()
  }
}
