import { IsString } from 'class-validator';

export class SendSupportMessageDto {
  @IsString()
  content: string;
}
