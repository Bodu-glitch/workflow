import { IsIn } from 'class-validator';

// BO chỉ được đổi sang 3 trạng thái này.
// 'suspended' là admin-only — không được phép qua route này.
export class UpdateStatusDto {
  @IsIn(['active', 'inactive', 'pending'])
  status: 'active' | 'inactive' | 'pending';
}
