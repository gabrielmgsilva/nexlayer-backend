import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QcOutcome } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateQcInspectionDto {
  @ApiProperty({ example: 8, description: 'Peças aprovadas na inspeção' })
  @IsInt()
  @Min(0)
  qtyApproved: number;

  @ApiProperty({ example: 2, description: 'Peças rejeitadas na inspeção' })
  @IsInt()
  @Min(0)
  qtyRejected: number;

  @ApiProperty({ enum: QcOutcome, description: 'Resultado da inspeção' })
  @IsEnum(QcOutcome)
  outcome: QcOutcome;

  @ApiPropertyOptional({ example: 'Deformação na base da peça' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
