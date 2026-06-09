import { IsString, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  request_id?: string;
}
