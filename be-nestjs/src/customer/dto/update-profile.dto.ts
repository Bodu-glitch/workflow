import { IsString, IsOptional } from 'class-validator';

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
