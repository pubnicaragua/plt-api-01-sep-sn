import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  client!: string

  @IsString()
  @IsNotEmpty()
  origin!: string

  @IsString()
  @IsNotEmpty()
  destination!: string

  @IsInt()
  @Min(1)
  packages!: number

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  recipientName?: string

  @IsOptional()
  @IsString()
  recipientPhone?: string

  @IsOptional()
  @IsBoolean()
  fragile?: boolean

  @IsOptional()
  @IsNumber()
  originLat?: number

  @IsOptional()
  @IsNumber()
  originLng?: number

  @IsOptional()
  @IsNumber()
  destinationLat?: number

  @IsOptional()
  @IsNumber()
  destinationLng?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number

  @IsOptional()
  @IsIn(['Urbano', 'Express', 'Programado'])
  serviceType?: 'Urbano' | 'Express' | 'Programado'

  @IsOptional()
  @IsIn(['Moto', 'Vehículo', 'Camión'])
  transport?: 'Moto' | 'Vehículo' | 'Camión'

  @IsOptional()
  @IsBoolean()
  autoAssign?: boolean

  @IsOptional()
  @IsString()
  contactName?: string

  @IsOptional()
  @IsString()
  contactPhone?: string

  @IsOptional()
  @IsString()
  originRefs?: string

  @IsOptional()
  @IsString()
  destinationRefs?: string
}