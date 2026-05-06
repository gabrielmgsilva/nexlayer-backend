import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FailureRateMode } from '@prisma/client';
import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsUUID, Min, Max } from 'class-validator';

export class CreateCostConfigDto {
  @ApiProperty({ example: 'Padrão (São Paulo)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'ID da impressora associada a este perfil de custo' })
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiProperty({ example: 0.8, description: 'R$/kWh' })
  @IsNumber()
  @Min(0)
  electricityCostPerKwh: number;

  @ApiPropertyOptional({ example: 25.0, description: 'R$/hora do operador' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCostPerHour?: number;

  @ApiPropertyOptional({ example: 30, description: 'Minutos de MO por job (setup + remoção)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborMinutesPerJob?: number;

  @ApiPropertyOptional({ example: 1500, description: 'Overhead mensal (R$/mês)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyOverhead?: number;

  @ApiPropertyOptional({ example: 240, description: 'Horas produtivas/mês para ratear overhead' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  monthlyProductionHours?: number;

  @ApiPropertyOptional({ enum: FailureRateMode, default: FailureRateMode.HYBRID })
  @IsOptional()
  @IsEnum(FailureRateMode)
  failureRateMode?: FailureRateMode;

  @ApiPropertyOptional({ example: 5.0, description: 'Taxa de falha manual (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  failureRatePercent?: number;

  @ApiPropertyOptional({ example: 90, description: 'Janela em dias para cálculo AUTO' })
  @IsOptional()
  @IsNumber()
  @Min(7)
  failureAutoWindowDays?: number;

  @ApiPropertyOptional({ example: 20, description: 'Mínimo de amostras para confiar no AUTO' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  failureAutoMinSamples?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
