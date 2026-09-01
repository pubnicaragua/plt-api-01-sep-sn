import { Controller, Get, Header, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { OperationsStore } from './operations.store'

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly store: OperationsStore) {}

  @Get('summary')
  summary() {
    return this.store.getReports()
  }

  @Get('export/:collection')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="incoex-report.csv"')
  @ApiOperation({ summary: 'Exportar CSV de viajes, conductores, clientes o incidencias' })
  export(@Param('collection') collection: 'trips' | 'drivers' | 'clients' | 'incidents') {
    return this.store.exportCsv(collection)
  }
}

