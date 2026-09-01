import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'
import { diskStorage } from 'multer'
import { mkdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { SettingsStore } from './settings.store'
import { VehiclesStore, type FuelType, type Vehicle, type VehicleStatus } from './vehicles.store'

class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  plate!: string

  @IsString()
  @IsNotEmpty()
  model!: string

  @IsString()
  @IsNotEmpty()
  type!: string

  @IsInt()
  @Min(100)
  @Max(20000)
  capacityKg!: number

  @IsInt()
  @Min(2000)
  @Max(2030)
  year!: number

  @IsOptional()
  @IsIn(['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'])
  fuelType?: FuelType

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumptionLPerKm?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceCs?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number
}

class UpdateVehicleDto {
  @IsOptional()
  @IsIn(['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'])
  fuelType?: FuelType

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumptionLPerKm?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceCs?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number
}

class VehicleStatusDto {
  @IsIn(['Disponible', 'En servicio', 'Mantenimiento', 'Fuera de servicio'])
  status!: VehicleStatus
}

class AssignVehicleDto {
  @IsString()
  driver!: string
}

class MaintenanceDto {
  @IsString()
  @IsNotEmpty()
  description!: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly store: VehiclesStore,
    private readonly settings: SettingsStore,
  ) {}

  private decorate(vehicle: Vehicle): Vehicle & { fuelCostPerKmC$: number; priceUsd: number } {
    const { fuelPriceGasolineCs, fuelPriceDieselCs, dollarRate } = this.settings.get()
    const fuelPrice = vehicle.fuelType === 'Diésel' ? fuelPriceDieselCs : fuelPriceGasolineCs
    return {
      ...vehicle,
      fuelCostPerKmC$: Number((vehicle.consumptionLPerKm * fuelPrice).toFixed(2)),
      priceUsd: dollarRate > 0 ? Number((vehicle.priceCs / dollarRate).toFixed(2)) : 0,
    }
  }

  @Get()
  @ApiOperation({ summary: 'Flota completa de vehículos con consumo de combustible y precios en C$' })
  list() {
    return this.store.list().map((vehicle) => this.decorate(vehicle))
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un vehículo nuevo (consumo L/km, precio en C$, odómetro)' })
  create(@Body() body: CreateVehicleDto) {
    return this.decorate(this.store.create(body))
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Historial de mantenimiento de la flota' })
  maintenance(@Query('vehicleId') vehicleId?: string) {
    return this.store.maintenanceHistory(vehicleId)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.decorate(this.store.get(id))
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar consumo, tipo de combustible, precio (C$) u odómetro' })
  update(@Param('id') id: string, @Body() body: UpdateVehicleDto) {
    return this.decorate(this.store.update(id, body))
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado del vehículo (disponible, servicio, mantenimiento, fuera de servicio)' })
  updateStatus(@Param('id') id: string, @Body() body: VehicleStatusDto) {
    return this.decorate(this.store.updateStatus(id, body.status))
  }

  @Patch(':id/driver')
  @ApiOperation({ summary: 'Asignar o liberar el conductor del vehículo' })
  assignDriver(@Param('id') id: string, @Body() body: AssignVehicleDto) {
    return this.decorate(this.store.assignDriver(id, body.driver))
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un vehículo (requiere conductor liberado)' })
  delete(@Param('id') id: string) {
    return this.store.delete(id)
  }

  @Post(':id/maintenance')
  @ApiOperation({ summary: 'Registrar mantenimiento (costo en C$) y pasar el vehículo a mantenimiento' })
  registerMaintenance(@Param('id') id: string, @Body() body: MaintenanceDto) {
    return this.store.registerMaintenance(id, body.description, body.cost ?? 0)
  }

  @Post(':id/image')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir foto del vehículo (jpg, png, webp o gif, máx 5 MB)' })
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: (_request, _file, callback) => {
        const dir = resolve(process.env.INCOEX_UPLOADS_PATH ?? 'data/uploads/vehicles')
        mkdirSync(dir, { recursive: true })
        callback(null, dir)
      },
      filename: (request, file, callback) => {
        const extension = extname(file.originalname).toLowerCase()
        if (!IMAGE_EXTENSIONS.includes(extension)) {
          callback(new BadRequestException('Formato de imagen no permitido: usa jpg, png, webp o gif'), '')
          return
        }
        callback(null, `${String((request.params as { id: string }).id)}-${Date.now()}${extension}`)
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadImage(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Adjunta un archivo de imagen (campo "image")')
    return this.decorate(this.store.setImageUrl(id, `/api/uploads/vehicles/${file.filename}`))
  }
}