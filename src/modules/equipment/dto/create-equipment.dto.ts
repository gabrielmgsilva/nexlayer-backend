import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus } from '@prisma/client';
import {
  IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsUUID, Min,
} from 'class-validator';

export class CreateEquipmentDto {
  @ApiProperty({ example: 'Creality Hi Combo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'ID da marca (tabela brands)' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty({ example: 'Hi' })
  @IsString()
  model: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiProperty({ example: 4700.0 })
  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  purchaseDate: string;

  @ApiProperty({ example: 6000 })
  @IsNumber()
  @Min(1)
  estimatedLifespanHours: number;

  @ApiProperty({ example: 1150 })
  @IsNumber()
  @Min(1)
  ratedPowerWatts: number;

  @ApiProperty({ example: 400 })
  @IsNumber()
  @Min(1)
  avgPowerWatts: number;

  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsNumber()
  buildVolumeX?: number;

  @ApiPropertyOptional({ example: 400 })
  @IsOptional()
  @IsNumber()
  buildVolumeY?: number;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsNumber()
  buildVolumeZ?: number;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @IsNumber()
  maxSpeedMmS?: number;

  @ApiPropertyOptional({ enum: EquipmentStatus, default: EquipmentStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiProperty({ example: 600, description: 'Custo total anual de manutenção (R$)' })
  @IsNumber()
  @Min(0)
  annualMaintenanceCost: number;

  @ApiProperty({ example: 1500, description: 'Horas de uso estimadas por ano' })
  @IsNumber()
  @Min(1)
  annualUsageHours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
