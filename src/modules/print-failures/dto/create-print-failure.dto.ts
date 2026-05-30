import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsBoolean,
  IsDateString, IsIn, Min, Max,
} from 'class-validator';

const FAILURE_CATEGORIES = [
  'ADHESION', 'CLOG', 'LAYER_SHIFT', 'STRINGING', 'WARPING',
  'SPAGHETTI', 'UNDER_EXTRUSION', 'OVER_EXTRUSION', 'FILAMENT_BREAK',
  'FILAMENT_TANGLE', 'POWER_LOSS', 'MECHANICAL', 'THERMAL',
  'SUPPORT_FAIL', 'DIMENSIONAL', 'COSMETIC', 'OPERATOR_ERROR',
  'SOFTWARE', 'OTHER',
];

const FAILURE_SEVERITIES = ['TOTAL', 'PARTIAL', 'COSMETIC'];

export class CreatePrintFailureDto {
  @ApiProperty({ description: 'Equipamento onde ocorreu a falha' })
  @IsString()
  equipmentId: string;

  @ApiPropertyOptional({ description: 'Job de produção relacionado' })
  @IsOptional()
  @IsString()
  productionJobId?: string;

  @ApiPropertyOptional({ description: 'Produto que estava sendo impresso' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Material usado na impressão' })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiProperty({ enum: FAILURE_CATEGORIES })
  @IsIn(FAILURE_CATEGORIES)
  failureCategory: string;

  @ApiProperty({ enum: FAILURE_SEVERITIES })
  @IsIn(FAILURE_SEVERITIES)
  failureSeverity: string;

  @ApiProperty({ example: 85.5, description: 'Material desperdiçado em gramas' })
  @IsNumber()
  @Min(0)
  materialWastedG: number;

  @ApiProperty({ example: 45, description: 'Tempo desperdiçado em minutos' })
  @IsNumber()
  @Min(0)
  timeWastedMinutes: number;

  @ApiProperty({ description: 'Reimpressão necessária?' })
  @IsBoolean()
  reprintRequired: boolean;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  detectedAtLayer?: number;

  @ApiPropertyOptional({ example: 35, description: 'Percentual da impressão ao detectar a falha' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  detectedAtPercent?: number;

  @ApiPropertyOptional({ example: 28.5 })
  @IsOptional()
  @IsNumber()
  ambientTempC?: number;

  @ApiPropertyOptional({ example: 62 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  humidityPercent?: number;

  @ApiPropertyOptional({ example: 120.5, description: 'Horas de uso do bico no momento da falha' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  nozzleHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '2026-05-30T14:30:00Z' })
  @IsDateString()
  occurredAt: string;
}
