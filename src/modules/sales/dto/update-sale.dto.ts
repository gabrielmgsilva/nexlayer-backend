import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional, IsString, IsNumber, IsArray,
  ValidateNested, Min, IsInt, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSaleItemDto {
  @ApiPropertyOptional({ description: 'ID do item existente (omitir para criar novo)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variationId?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 49.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;
}

export class UpdateSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [UpdateSaleItemDto],
    description: 'Lista completa de itens. Sem id = novo; com id = atualiza. Itens omitidos sem job vinculado serão removidos.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSaleItemDto)
  items?: UpdateSaleItemDto[];
}
