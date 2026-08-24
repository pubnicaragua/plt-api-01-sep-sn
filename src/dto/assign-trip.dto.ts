import { IsNotEmpty, IsString } from 'class-validator'

export class AssignTripDto {
  @IsString()
  @IsNotEmpty()
  driverId!: string
}

