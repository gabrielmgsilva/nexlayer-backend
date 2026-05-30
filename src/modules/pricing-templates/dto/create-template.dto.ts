import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreatePricingTemplateDto {
  @ApiProperty({ description: 'ID do produto âncora (deve ter um CostSnapshot)' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Nome do template' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 0.4, description: 'Margem padrão para produtos derivados (0.4 = 40%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  defaultMargin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
