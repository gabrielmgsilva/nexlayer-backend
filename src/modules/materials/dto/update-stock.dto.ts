import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialStockStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export class UpdateMaterialStockDto {
  @ApiPropertyOptional({ enum: MaterialStockStatus })
  @IsOptional()
  @IsEnum(MaterialStockStatus)
  status?: MaterialStockStatus;

  @ApiPropertyOptional({ example: 750, description: 'Correção manual do peso atual em gramas' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentWeightG?: number;

  @ApiPropertyOptional({ example: '2024-04-01' })
  @IsOptional()
  @IsDateString()
  openedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ example: 95.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerKg?: number;

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
