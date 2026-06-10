import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePricingDto {
  @IsOptional()
  @IsString()
  service_name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price_min?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price_max?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price_fixed?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  estimated_duration_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  travel_fee?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  surcharge_percent?: number;

  @IsOptional()
  @IsArray()
  peak_hours_config?: Array<{ start_time: string; end_time: string; multiplier: number }>;
}
