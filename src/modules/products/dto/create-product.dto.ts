import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsOptional, IsUUID, IsBoolean,
  IsArray, ValidateNested, Min, IsInt, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DefaultAccessoryItemDto {
  @ApiProperty()
  @IsUUID()
  accessoryId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.001)
  qtyPerUnit: number;
}

export class KitItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProductChannelPriceDto {
  @ApiProperty()
  @IsUUID()
  channelId: string;

  @ApiProperty({ example: 39.9 })
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Chaveiro Pokémon Pikachu' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'CHAV-PIKA-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isKit?: boolean;

  @ApiProperty({ example: 871, description: 'Tempo estimado em minutos (ignorado para kits)' })
  @ValidateIf((o) => !o.isKit)
  @IsInt()
  @Min(1)
  estimatedPrintTimeMinutes: number;

  @ApiProperty({ example: 297.6, description: 'Material estimado em gramas (ignorado para kits)' })
  @ValidateIf((o) => !o.isKit)
  @IsNumber()
  @Min(0.1)
  estimatedMaterialG: number;

  @ApiProperty({ example: 25, description: 'Peças por impressão (ignorado para kits)' })
  @ValidateIf((o) => !o.isKit)
  @IsInt()
  @Min(1)
  piecesPerPrint: number;

  @ApiPropertyOptional({ description: 'ID do tipo de filamento recomendado' })
  @IsOptional()
  @IsUUID()
  recommendedFilamentTypeId?: string;

  @ApiPropertyOptional({ example: 0.2 })
  @IsOptional()
  @IsNumber()
  recommendedLayerHeightMm?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  recommendedInfillPercent?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  supportsRequired?: boolean;

  @ApiPropertyOptional({ type: [DefaultAccessoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DefaultAccessoryItemDto)
  defaultAccessories?: DefaultAccessoryItemDto[];

  @ApiPropertyOptional({ type: [KitItemDto], description: 'Componentes do kit (obrigatório se isKit=true)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitItemDto)
  kitItems?: KitItemDto[];

  @ApiPropertyOptional({ example: 0, description: 'Estoque de produtos acabados' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 5, description: 'Mínimo de estoque para alerta' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStockAlert?: number;

  @ApiPropertyOptional({ example: 12.50, description: 'Preço de venda unitário' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ type: [ProductChannelPriceDto], description: 'Preços de venda por canal' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductChannelPriceDto)
  channelPrices?: ProductChannelPriceDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
