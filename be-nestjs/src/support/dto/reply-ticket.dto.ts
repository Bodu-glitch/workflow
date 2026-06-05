import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
