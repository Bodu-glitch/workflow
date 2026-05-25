import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewLeaveRequestDto {
  @IsIn(['approved', 'rejected'])
  action: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  reject_reason?: string;
}
