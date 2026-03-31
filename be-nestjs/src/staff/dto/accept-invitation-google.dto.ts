import { IsString, IsNotEmpty } from 'class-validator';

export class AcceptInvitationGoogleDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsString()
  @IsNotEmpty()
  invitation_token: string;
}
