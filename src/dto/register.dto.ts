import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  companyName!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsIn(['company', 'driver'])
  role!: 'company' | 'driver'

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  identification?: string

  @IsOptional()
  @IsString()
  taxId?: string

  @IsOptional()
  @IsString()
  documentName?: string
}
