import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'Mercado Livre' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionPercent?: number;

  @ApiPropertyOptional({ example: 4.5, description: 'Taxa fixa por venda (R$)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeFixed?: number;

  @ApiPropertyOptional({ example: 2.0, description: 'Taxa variável adicional (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feePercentVariable?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
