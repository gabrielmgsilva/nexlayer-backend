import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialCategory } from '@prisma/client';
import {
  IsString, IsNumber, IsOptional, IsUUID, Min, Max, IsEnum,
} from 'class-validator';

export class CreateMaterialDto {
  @ApiProperty({ enum: MaterialCategory, default: MaterialCategory.FILAMENT })
  @IsEnum(MaterialCategory)
  materialType: MaterialCategory;

  @ApiPropertyOptional({ description: 'ID do tipo (filament_types)' })
  @IsOptional()
  @IsUUID()
  filamentTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: 1.75, description: 'Apenas para filamentos (mm)' })
  @IsOptional()
  @IsNumber()
  diameterMm?: number;

  @ApiPropertyOptional({ example: 1100, description: 'Densidade em kg/m³ (para resinas)' })
  @IsOptional()
  @IsNumber()
  densityKgM3?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Peso do carretel em gramas (apenas filamentos)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  spoolWeightG?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: 190 })
  @IsOptional()
  @IsNumber()
  recommendedTempNozzleMin?: number;

  @ApiPropertyOptional({ example: 220 })
  @IsOptional()
  @IsNumber()
  recommendedTempNozzleMax?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  recommendedTempBedMin?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  recommendedTempBedMax?: number;

  @ApiPropertyOptional({ example: 5.0, description: 'Taxa de falha estimada para este material (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  failureRatePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
