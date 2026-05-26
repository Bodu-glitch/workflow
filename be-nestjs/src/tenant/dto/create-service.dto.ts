import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}