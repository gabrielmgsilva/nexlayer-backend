import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccessoryTransactionType, PurchaseMode } from '@prisma/client';
import { IsNumber, IsEnum, IsOptional, IsString, IsUUID, Min, IsDateString } from 'class-validator';

export class CreateAccessoryTransactionDto {
  @ApiProperty({ enum: AccessoryTransactionType })
  @IsEnum(AccessoryTransactionType)
  type: AccessoryTransactionType;

  @ApiProperty({ example: 100, description: 'Quantidade (positivo = entrada, negativo = saída)' })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ description: 'Preenchido automaticamente quando type=PURCHASE' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  // ── Campos extras para PURCHASE (atualiza custo e histórico) ──
  @ApiPropertyOptional({ enum: PurchaseMode })
  @IsOptional()
  @IsEnum(PurchaseMode)
  purchaseMode?: PurchaseMode;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  purchaseQuantity?: number;

  @ApiPropertyOptional({ example: 80.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

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
