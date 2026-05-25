import { IsIn } from 'class-validator';

export class UpdateOnlineStatusDto {
  @IsIn(['online', 'offline', 'working'])
  status: 'online' | 'offline' | 'working';
}
