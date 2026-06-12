import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(5)
  subject: string;

  @IsOptional()
  @IsUUID()
  request_id?: string;
}
