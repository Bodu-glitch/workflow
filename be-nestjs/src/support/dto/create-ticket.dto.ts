import { IsUUID, IsNotEmpty, IsString } from 'class-validator';

export class CreateTicketDto {
  @IsUUID()
  @IsNotEmpty()
  task_id: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}
