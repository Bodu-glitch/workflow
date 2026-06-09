import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class ValidateVoucherDto {
  @IsString()
  code: string;

  @IsString()
  tenant_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order_amount?: number;

  @IsOptional()
  @IsString()
  category_id?: string;
}
