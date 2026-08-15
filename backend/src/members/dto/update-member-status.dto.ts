import { IsBoolean } from 'class-validator';

export class UpdateMemberStatusDto {
  @IsBoolean()
  isActive: boolean;
}
