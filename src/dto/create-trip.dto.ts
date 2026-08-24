import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

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
}
