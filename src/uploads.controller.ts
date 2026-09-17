import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { ApiConsumes, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const EVIDENCE_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  '.pdf',
  '.xls',
  '.xlsx',
]

const EVIDENCE_DIR = resolve(process.env.INCOEX_EVIDENCE_PATH ?? 'data/uploads/evidence')

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

  @Post('evidence')
  @ApiOperation({ summary: 'Subir evidencia (foto o documento) asociada a una incidencia o entrega' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Archivo de evidencia JPG, PNG, PDF o Excel', schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEvidence(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ninguna imagen')
    const extension = extname(file.originalname).toLowerCase()
    if (!EVIDENCE_EXTENSIONS.includes(extension)) {
      throw new BadRequestException('Formato no permitido. Usa JPG, PNG, PDF, XLS o XLSX')
    }
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    const name = `ev-${Date.now()}${extension}`
    writeFileSync(resolve(EVIDENCE_DIR, name), file.buffer)
    return { evidence: name, url: `/api/uploads/evidence/${name}` }
  }

  @Get('evidence/:file')
  @ApiOperation({ summary: 'Servir una evidencia subida' })
  serveEvidence(@Param('file') file: string, @Res() res: Response) {
    const safeName = basename(file)
    if (!EVIDENCE_EXTENSIONS.some((extension) => safeName.toLowerCase().endsWith(extension))) {
      throw new NotFoundException('Evidencia no encontrada')
    }
    const filePath = resolve(EVIDENCE_DIR, safeName)
    if (!existsSync(filePath)) throw new NotFoundException('Evidencia no encontrada')
    res.sendFile(filePath)
  }
}
