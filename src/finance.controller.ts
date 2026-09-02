import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { FinanceStore } from './finance.store'

@ApiTags('Finanzas')
@Controller('finance')
export class FinanceController {
  constructor(private readonly store: FinanceStore) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de rentabilidad: ingresos, combustible, mantenimiento y margen por período.' })
  getSummary() {
    return this.store.getSummary()
  }
}
