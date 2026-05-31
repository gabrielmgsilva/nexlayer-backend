import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialStockStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsDateString, IsBoolean, IsUUID, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  colorIsRainbow?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  colorIsIncolor?: boolean;

  @ApiPropertyOptional({ description: 'ID da cor principal (null para remover)' })
  @IsOptional()
  @IsUUID()
  color1Id?: string | null;

  @ApiPropertyOptional({ description: 'ID da cor secundária (null para remover)' })
  @IsOptional()
  @IsUUID()
  color2Id?: string | null;

  @ApiPropertyOptional({ description: 'ID da cor terciária (null para remover)' })
  @IsOptional()
  @IsUUID()
  color3Id?: string | null;
}
