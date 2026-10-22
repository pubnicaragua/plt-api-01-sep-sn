import { IsIn, IsNotEmpty, IsString } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string

  @IsString()
  @IsNotEmpty()
  password!: string

  @IsIn(['company', 'driver', 'admin'])
  role!: 'company' | 'driver' | 'admin'
}

