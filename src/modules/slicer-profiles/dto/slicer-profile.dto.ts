import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateSlicerProfileDto {
  @ApiProperty({ example: 'PLA Bambu 0.4mm Standard' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional({ example: 220 })
  @IsOptional()
  @IsInt()
  nozzleTempC?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  bedTempC?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsInt()
  speedMmS?: number;

  @ApiPropertyOptional({ example: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  layerHeightMm?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  infillPercent?: number;

  @ApiPropertyOptional({ example: 'Linear', description: 'Tipo de suporte' })
  @IsOptional()
  @IsString()
  supportType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSlicerProfileDto extends PartialType(CreateSlicerProfileDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
