import { Body, Controller, Get, Param, Patch } from '@nestjs/common'
import { IsIn, IsString } from 'class-validator'
import { DeliverableStatus, DeliverablesStore } from './deliverables.store'

class UpdateDeliverableStatusDto {
  @IsString()
  @IsIn(['backlog', 'in_progress', 'review', 'done'])
  status!: DeliverableStatus
}

@Controller('deliverables')
export class DeliverablesController {
  constructor(private readonly store: DeliverablesStore) {}

  @Get()
  list() { return this.store.list() }

  @Get('summary')
  summary() { return this.store.summary() }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateDeliverableStatusDto) { return this.store.updateStatus(id, body.status) }
}
