import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BatchStrategy, ProductionMode } from '@prisma/client';
import {
  IsUUID, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  IsArray, ValidateNested, Min, Max, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JobAccessoryItemDto {
  @ApiProperty()
  @IsUUID()
  accessoryId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.001)
  qtyPerUnit: number;
}

export class JobMaterialItemDto {
  @ApiProperty()
  @IsUUID()
  materialStockId: string;

  @ApiProperty({ example: 297.6, description: 'Material por impressão em gramas' })
  @IsNumber()
  @Min(0.1)
  materialPerPrintG: number;
}

export class CreateJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiProperty({ enum: ProductionMode })
  @IsEnum(ProductionMode)
  productionMode: ProductionMode;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  quantityOrdered: number;

  @ApiProperty({ example: 25, description: 'Peças por impressão (1 para SINGLE_PIECE)' })
  @IsInt()
  @Min(1)
  piecesPerPrint: number;

  @ApiProperty({ example: 871, description: 'Tempo por impressão em minutos (do slicer)' })
  @IsInt()
  @Min(1)
  printTimeMinutes: number;

  @ApiProperty({ example: 297.6, description: 'Material por impressão em gramas (legacy, usar jobMaterials[])' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  materialPerPrintG?: number;

  @ApiProperty({ description: 'ID do carretel de material a usar (legacy, usar jobMaterials[])' })
  @IsOptional()
  @IsUUID()
  materialStockId?: string;

  @ApiPropertyOptional({ type: [JobMaterialItemDto], description: 'Materiais usados na impressão' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobMaterialItemDto)
  jobMaterials?: JobMaterialItemDto[];

  @ApiPropertyOptional({ type: [JobAccessoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobAccessoryItemDto)
  jobAccessories?: JobAccessoryItemDto[];

  @ApiProperty()
  @IsUUID()
  costConfigId: string;

  @ApiProperty({ example: 0.15, description: 'Margem de lucro (0.15 = 15%)' })
  @IsNumber()
  @Min(0)
  @Max(10)
  profitMargin: number;

  @ApiPropertyOptional({ example: 9.8, description: 'Preço customizado (ignora cálculo)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customUnitPrice?: number;

  @ApiPropertyOptional({ example: 5, description: 'Desconto percentual' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ enum: BatchStrategy, default: BatchStrategy.FULL_PRINTS })
  @IsOptional()
  @IsEnum(BatchStrategy)
  batchStrategy?: BatchStrategy;

  @ApiPropertyOptional({ example: 3, description: 'Prioridade 1 (urgente) a 5 (baixa)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @ApiPropertyOptional({ example: '2026-04-10T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'ID da venda (para vincular job à venda)' })
  @IsOptional()
  @IsUUID()
  saleOrderId?: string;

  @ApiPropertyOptional({ description: 'ID do item da venda (para vincular job ao item)' })
  @IsOptional()
  @IsUUID()
  saleItemId?: string;
}
