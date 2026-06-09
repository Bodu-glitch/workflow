import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, Min } from 'class-validator';

export class CreateVoucherDto {
  @IsString()
  code: string;

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed';

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_order_value?: number;

  @IsOptional()
  @IsString()
  service_category_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;
}
