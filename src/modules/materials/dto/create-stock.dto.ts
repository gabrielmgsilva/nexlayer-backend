import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialStockStatus } from '@prisma/client';
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';

export class CreateMaterialStockDto {
  @ApiProperty({ example: 1000, description: 'Quantidade inicial em gramas (já convertida pelo frontend)' })
  @IsNumber()
  @Min(1)
  initialWeightG: number;

  @ApiPropertyOptional({ example: 95.0, description: 'Custo por kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerKg?: number;

  @ApiPropertyOptional({ example: 'LOT-2024-03' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ example: '2024-03-01' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: '2024-03-10' })
  @IsOptional()
  @IsDateString()
  openedDate?: string;

  @ApiPropertyOptional({ enum: MaterialStockStatus, default: MaterialStockStatus.SEALED })
  @IsOptional()
  @IsEnum(MaterialStockStatus)
  status?: MaterialStockStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color1Id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color2Id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color3Id?: string;
}
