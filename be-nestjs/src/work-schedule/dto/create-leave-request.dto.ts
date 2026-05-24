import { IsIn, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsIn(['annual', 'sick', 'personal', 'other'])
  type: 'annual' | 'sick' | 'personal' | 'other';

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
