import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsInt, IsDateString, MinLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed';

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  value: number;

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
  @IsDateString()
  starts_at?: string;

  @IsOptional()
  @IsDateString()
  ends_at?: string;
}
