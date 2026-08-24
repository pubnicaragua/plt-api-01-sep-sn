import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  list() {
    return this.store.listClients()
  }
}

