import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['percent', 'fixed', 'percentage'])
  type?: 'percent' | 'fixed' | 'percentage';

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
  min_order_amount?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  usage_limit?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
