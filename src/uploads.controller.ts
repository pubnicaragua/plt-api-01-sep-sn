import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  @Get('vehicles/:file')
  @ApiOperation({ summary: 'Servir imágenes de la flota almacenadas localmente' })
  serveVehicleImage(@Param('file') file: string, @Res() res: Response) {
    const safeName = basename(file)
    if (!IMAGE_EXTENSIONS.some((extension) => safeName.toLowerCase().endsWith(extension))) {
      throw new NotFoundException('Imagen no encontrada')
    }
    const filePath = resolve(process.env.INCOEX_UPLOADS_PATH ?? 'data/uploads/vehicles', safeName)
    if (!existsSync(filePath)) throw new NotFoundException('Imagen no encontrada')
    res.sendFile(filePath)
  }
}