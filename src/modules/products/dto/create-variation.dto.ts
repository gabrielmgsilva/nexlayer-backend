import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsUUID, IsBoolean, IsInt, IsNumber, Min,
} from 'class-validator';

export class CreateVariationDto {
  @ApiProperty({ example: 'Vermelho' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'CHAV-PIKA-001-VRM' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ description: 'ID da cor (tabela de domínio)' })
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStockAlert?: number;

  @ApiPropertyOptional({ example: 39.90, description: 'Preço específico desta variação (sobrescreve o preço base do produto)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
