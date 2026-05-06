import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseMode } from '@prisma/client';
import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min } from 'class-validator';

export class CreateAccessoryDto {
  @ApiProperty({ example: 'Argola chaveiro 25mm' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID da categoria (tabela accessory_categories)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'ID da unidade (tabela units)' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiProperty({ enum: PurchaseMode })
  @IsEnum(PurchaseMode)
  purchaseMode: PurchaseMode;

  @ApiProperty({ example: 100, description: 'Quantidade por compra (1, 100, 500, etc.)' })
  @IsNumber()
  @Min(0.001)
  purchaseQuantity: number;

  @ApiProperty({ example: 80.0, description: 'Custo total da compra' })
  @IsNumber()
  @Min(0)
  purchaseCost: number;

  @ApiPropertyOptional({ example: 200, description: 'Quantidade inicial em estoque' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockAlert?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
