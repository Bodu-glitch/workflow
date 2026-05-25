import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time phải có dạng HH:MM' })
  start_time: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'end_time phải có dạng HH:MM' })
  end_time: string;

  @IsOptional()
  @IsString()
  color?: string;
}
