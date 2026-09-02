import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly store: OperationsStore) {}

  @Get('overview')
  overview() {
    return this.store.getTrackingOverview()
  }

  @Get(':id')
  live(@Param('id') id: string) {
    return this.store.getTracking(id)
  }
}

