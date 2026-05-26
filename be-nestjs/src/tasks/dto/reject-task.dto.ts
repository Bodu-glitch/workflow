import { IsString, IsNotEmpty } from 'class-validator';

export class RejectTaskDto {
  @IsNotEmpty({ message: 'Reject reason is required' })
  @IsString()
  reason!: string;
}