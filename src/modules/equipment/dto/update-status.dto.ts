import { ApiProperty } from '@nestjs/swagger';
import { EquipmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEquipmentStatusDto {
  @ApiProperty({ enum: EquipmentStatus })
  @IsEnum(EquipmentStatus)
  status: EquipmentStatus;
}
