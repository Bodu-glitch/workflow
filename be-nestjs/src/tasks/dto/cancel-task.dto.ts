import { IsString, IsNotEmpty } from 'class-validator';

export class CancelTaskDto {
  @IsNotEmpty({ message: 'Cancel reason is required' })
  @IsString()
  cancel_reason!: string;
}
