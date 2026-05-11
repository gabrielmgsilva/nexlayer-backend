import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialStockStatus } from '@prisma/client';
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsBoolean, Min } from 'class-validator';

export class CreateMaterialStockDto {
  @ApiProperty({ example: 1000, description: 'Quantidade inicial em gramas (já convertida pelo frontend)' })
  @IsNumber()
  @Min(1)
  initialWeightG: number;

  @ApiPropertyOptional({ example: 95.0, description: 'Custo por kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerKg?: number;

  @ApiPropertyOptional({ example: 'LOT-2024-03' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ example: '2024-03-01' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: '2024-03-10' })
  @IsOptional()
  @IsDateString()
  openedDate?: string;

  @ApiPropertyOptional({ enum: MaterialStockStatus, default: MaterialStockStatus.SEALED })
  @IsOptional()
  @IsEnum(MaterialStockStatus)
  status?: MaterialStockStatus;

  @ApiPropertyOptional({ example: '#FF5733', description: 'Cor hexadecimal da bobina/pote' })
  @IsOptional()
  @IsString()
  colorHex?: string;

  @ApiPropertyOptional({ example: false, description: 'Indica cor rainbow/multicolor' })
  @IsOptional()
  @IsBoolean()
  colorIsRainbow?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Indica material incolor/transparente' })
  @IsOptional()
  @IsBoolean()
  colorIsIncolor?: boolean;
}
