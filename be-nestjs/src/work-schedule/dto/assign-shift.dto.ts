import { IsDateString, IsArray, IsOptional, IsString, Matches, ArrayNotEmpty } from 'class-validator';

const UUID_LOOSE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AssignShiftDto {
  @Matches(UUID_LOOSE)
  shift_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(UUID_LOOSE, { each: true })
  user_ids: string[];

  @IsDateString()
  work_date: string;

  @IsOptional()
  @IsString()
  note?: string;
}
