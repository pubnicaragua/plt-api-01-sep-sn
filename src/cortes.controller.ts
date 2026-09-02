import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { CortesStore } from './cortes.store'
import { OperationsStore } from './operations.store'

class PayCorteDto {
  @IsOptional()
  @IsString()
  method?: string

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountCs?: number
}

@ApiTags('Cortes')
@Controller('cortes')
export class CortesController {
  constructor(
    private readonly cortes: CortesStore,
    private readonly operations: OperationsStore,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Cortes de pago (recibos de deuda acumulada)' })
  list(@Query('client') client?: string, @Query('status') status?: string, @Query('limit') limit?: string) {
    return this.cortes.listCortes({ client, status, limit: limit ? Number(limit) : undefined })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un corte' })
  detail(@Param('id') id: string) {
    return this.cortes.getCorte(id)
  }

  @Post('generate')
  @ApiOperation({ summary: 'Genera el corte del periodo vencido (todos los clientes activos o uno)' })
  generate(@Body('client') clientName?: string) {
    const created: string[] = []
    const clients = clientName
      ? this.operations.listClients().filter((c) => c.name.trim().toLowerCase() === String(clientName).trim().toLowerCase())
      : this.operations.listClients().filter((c) => c.billingActive)
    for (const client of clients) {
      const corte = this.cortes.generateForClient(client, new Date(), false)
      if (corte) created.push(corte.id)
    }
    return { created, count: created.length }
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Registrar pago del corte' })
  pay(@Param('id') id: string, @Body() dto: PayCorteDto) {
    return this.cortes.markPaid(id, dto)
  }

  @Post(':id/annul')
  @ApiOperation({ summary: 'Anular corte' })
  annul(@Param('id') id: string) {
    return this.cortes.annul(id)
  }

  @Post(':id/sent-whatsapp')
  @ApiOperation({ summary: 'Marcar corte como enviado por WhatsApp' })
  sent(@Param('id') id: string) {
    return this.cortes.markSent(id)
  }
}
