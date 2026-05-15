import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ApplyToWorkspaceDto {
  @IsString()
  tenant_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
