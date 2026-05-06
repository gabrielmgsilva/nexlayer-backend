import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID, IsInt, IsNumber, IsOptional, IsArray,
  ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class EstimateAccessoryDto {
  @ApiProperty()
  @IsUUID()
  accessoryId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.001)
  qtyPerUnit: number;
}

class EstimateMaterialDto {
  @ApiProperty({ description: 'ID do carretel de material' })
  @IsUUID()
  materialStockId: string;

  @ApiProperty({ example: 297.6, description: 'Material por impressão em gramas' })
  @IsNumber()
  @Min(0.1)
  materialGrams: number;
}

export class EstimateDto {
  @ApiProperty({ description: 'ID do equipamento (impressora)' })
  @IsUUID()
  equipmentId: string;

  @ApiPropertyOptional({ description: 'ID do carretel (legacy, usar materials[])' })
  @IsOptional()
  @IsUUID()
  materialStockId?: string;

  @ApiProperty({ example: 871, description: 'Tempo de impressão em minutos' })
  @IsInt()
  @Min(1)
  printTimeMinutes: number;

  @ApiPropertyOptional({ example: 297.6, description: 'Material por impressão (legacy, usar materials[])' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  materialGrams?: number;

  @ApiPropertyOptional({ type: [EstimateMaterialDto], description: 'Materiais usados na impressão' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateMaterialDto)
  materials?: EstimateMaterialDto[];

  @ApiProperty({ example: 25, description: 'Peças por impressão' })
  @IsInt()
  @Min(1)
  piecesPerPrint: number;

  @ApiProperty({ example: 4, description: 'Número de impressões' })
  @IsInt()
  @Min(1)
  printsNeeded: number;

  @ApiProperty({ example: 90, description: 'Quantidade pedida pelo cliente' })
  @IsInt()
  @Min(1)
  quantityOrdered: number;

  @ApiProperty({ example: 100, description: 'Quantidade total de peças produzidas (pode ser > quantityOrdered em FULL_PRINTS)' })
  @IsInt()
  @Min(1)
  totalQuantity: number;

  @ApiPropertyOptional({ type: [EstimateAccessoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateAccessoryDto)
  accessories?: EstimateAccessoryDto[];

  @ApiProperty({ description: 'ID do perfil de custo' })
  @IsUUID()
  costConfigId: string;

  @ApiProperty({ example: 0.15 })
  @IsNumber()
  @Min(0)
  @Max(10)
  profitMargin: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}
