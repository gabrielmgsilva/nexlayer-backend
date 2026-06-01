import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSlicerProfileDto {
  @ApiProperty({ example: 'PLA Bambu 0.4mm Standard' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @ApiPropertyOptional({
    example: { 'Temperatura Nozzle': '220°C', 'Temperatura Cama': '60°C', 'Infill': '15%' },
    description: 'Mapa livre de parâmetros: chave (nome) → valor (string)',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSlicerProfileDto extends PartialType(CreateSlicerProfileDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
