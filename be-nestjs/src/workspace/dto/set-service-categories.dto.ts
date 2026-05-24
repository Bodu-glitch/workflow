import { IsArray, IsUUID } from 'class-validator';

export class SetServiceCategoriesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  category_ids: string[];
}
