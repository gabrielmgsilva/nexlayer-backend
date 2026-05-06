import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateMaintenanceLogDto {
  @ApiProperty({ example: 'Troca de bico + limpeza do extrusor' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 85.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiProperty({ example: '2024-06-01' })
  @IsDateString()
  performedAt: string;

  @ApiPropertyOptional({ example: '2024-09-01' })
  @IsOptional()
  @IsDateString()
  nextDueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
