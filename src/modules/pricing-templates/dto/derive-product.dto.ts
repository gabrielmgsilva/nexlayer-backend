import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class DeriveProductDto {
  @ApiProperty({ description: 'Nome do produto derivado' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 14.5, description: 'Gramas de material estimado por impressão' })
  @IsNumber()
  @Min(0.1)
  estimatedMaterialG: number;

  @ApiProperty({ example: 32, description: 'Minutos de impressão estimados' })
  @IsNumber()
  @Min(1)
  estimatedPrintTimeMinutes: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  piecesPerPrint?: number;

  @ApiPropertyOptional({ example: 0.4, description: 'Margem desejada (0.4 = 40%). Se omitido usa o defaultMargin do template.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  margin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
