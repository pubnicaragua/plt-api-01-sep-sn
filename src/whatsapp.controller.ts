import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

class SendWhatsAppDto {
  @IsString()
  @IsNotEmpty()
  phone!: string

  @IsString()
  @IsNotEmpty()
  message!: string

  @IsOptional()
  @IsString()
  via?: string
}

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  @Get('status')
  @ApiOperation({ summary: 'Estado de la integración de WhatsApp (link wa.me o webhook configurado)' })
  status() {
    return {
      available: true,
      mode: process.env.WHATSAPP_WEBHOOK_URL ? 'webhook' : 'wa.me',
      webhookConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_URL),
    }
  }

  @Post('send')
  @ApiOperation({ summary: 'Preparar/enviar mensaje de WhatsApp. Sin webhook genera el link wa.me; con webhook hace el POST real.' })
  async send(@Body() body: SendWhatsAppDto) {
    const digits = body.phone.replace(/[^\d]/g, '')
    const phone = digits.startsWith('505') ? digits : digits.startsWith('0') ? `505${digits.slice(1)}` : `505${digits}`
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(body.message)}`
    const webhook = process.env.WHATSAPP_WEBHOOK_URL
    if (webhook) {
      try {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, message: body.message, via: body.via ?? 'incoex' }),
        })
        return {
          delivered: response.ok,
          mode: 'webhook',
          link,
          status: response.status,
        }
      } catch {
        return { delivered: false, mode: 'webhook', link, error: 'webhook unreachable' }
      }
    }
    return { delivered: false, mode: 'wa.me', link }
  }
}