import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly store: OperationsStore) {}

  @Get()
  list() {
    return this.store.listDrivers()
  }
}

