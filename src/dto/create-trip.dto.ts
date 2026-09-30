import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

export class TripStopDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  @IsNotEmpty()
  label!: string

  @IsString()
  @IsNotEmpty()
  address!: string

  @IsOptional()
  @IsNumber()
  latitude?: number

  @IsOptional()
  @IsNumber()
  longitude?: number

  @IsOptional()
  @IsString()
  refs?: string

  @IsOptional()
  @IsString()
  recipientName?: string

  @IsOptional()
  @IsString()
  recipientPhone?: string

  @IsInt()
  @Min(1)
  order!: number
}

export class TripOptionSelectionDto {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsNotEmpty()
  title!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNumber()
  @Min(0)
  priceCs!: number

  @IsOptional()
  @IsIn(['NIO', 'USD'])
  currency?: 'NIO' | 'USD'

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number
}

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
  @IsIn(['Envíos', 'Taxi Privado'])
  serviceMode?: 'Envíos' | 'Taxi Privado'

  @IsOptional()
  @IsIn(['Moto', 'Vehículo', 'Camión'])
  transport?: 'Moto' | 'Vehículo' | 'Camión'

  @IsOptional()
  @IsString()
  vehicleVariant?: string

  @IsOptional()
  @IsString()
  truckType?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  passengerCount?: number

  @IsOptional()
  @IsBoolean()
  returnTrip?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripStopDto)
  stops?: TripStopDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripOptionSelectionDto)
  options?: TripOptionSelectionDto[]

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

  @IsOptional()
  @IsString()
  scheduledDate?: string

  @IsOptional()
  @IsString()
  scheduledTime?: string

  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number

  @IsOptional()
  @IsIn(['kg', 'lb'])
  weightUnit?: 'kg' | 'lb'
}
