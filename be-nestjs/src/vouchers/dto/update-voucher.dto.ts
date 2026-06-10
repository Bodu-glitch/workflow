import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['percent', 'fixed'])
  type?: 'percent' | 'fixed';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  value?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  max_discount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  min_order_value?: number;

  @IsOptional()
  @IsString()
  service_category_id?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  usage_limit?: number;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;
}
