import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaterialTransactionType } from '@prisma/client';
import { IsNumber, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStockTransactionDto {
  @ApiProperty({ enum: MaterialTransactionType })
  @IsEnum(MaterialTransactionType)
  type: MaterialTransactionType;

  @ApiProperty({ description: 'Positivo para entrada, negativo para saída (gramas)', example: -150 })
  @IsNumber()
  quantityG: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
