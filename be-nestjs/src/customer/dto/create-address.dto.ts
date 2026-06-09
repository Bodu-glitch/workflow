import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  label: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
