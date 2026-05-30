import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, Min, Max } from 'class-validator';

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

  @ApiProperty({ example: 0.8, description: 'R$/kWh' })
  @IsNumber()
  @Min(0)
  electricityCostPerKwh: number;

  @ApiPropertyOptional({ example: 25.0, description: 'R$/hora do operador' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCostPerHour?: number;

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

  @ApiPropertyOptional({ enum: ['MANUAL', 'AUTO', 'HYBRID'], default: 'HYBRID' })
  @IsOptional()
  @IsIn(['MANUAL', 'AUTO', 'HYBRID'])
  failureRateMode?: 'MANUAL' | 'AUTO' | 'HYBRID';

  @ApiPropertyOptional({ example: 5, description: 'Taxa de falha manual (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  failureRatePercent?: number;

  @ApiPropertyOptional({ example: 30, description: 'Janela de dias para cálculo AUTO' })
  @IsOptional()
  @IsNumber()
  @Min(7)
  failureAutoWindowDays?: number;

  @ApiPropertyOptional({ example: 10, description: 'Amostras mínimas para cálculo AUTO' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  failureAutoMinSamples?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
