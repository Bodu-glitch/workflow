import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRatingDto {
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsString()
  report_reason?: string;
}
