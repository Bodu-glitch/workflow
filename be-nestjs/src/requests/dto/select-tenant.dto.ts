import { IsUUID, IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SelectTenantDto {
  @IsUUID()
  tenant_id: string;

  @IsOptional()
  @IsUUID()
  pricing_id?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  agreed_price?: number;

  @IsOptional()
  @IsString()
  voucher_code?: string;
}
