import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
