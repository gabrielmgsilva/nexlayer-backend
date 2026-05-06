import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  ValidateIf,
  IsEnum,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.trim();
};

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const toDigitsOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  return digits === '' ? undefined : digits;
};

export enum CustomerTypeDto {
  PF = 'PF',
  PJ = 'PJ',
}

export class CreateCustomerDto {
  @ApiProperty({ enum: CustomerTypeDto, example: CustomerTypeDto.PF })
  @IsEnum(CustomerTypeDto)
  type: CustomerTypeDto;

  @ApiProperty({ example: 'João Silva' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Empresa XYZ LTDA', description: 'Obrigatório para clientes PJ' })
  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerTypeDto.PJ)
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  razaoSocial?: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @ValidateIf((o) => o.email !== '' && o.email != null)
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '(11) 98888-1234' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '12345678901', description: 'Obrigatório para clientes PF' })
  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerTypeDto.PF)
  @Transform(({ value }) => toDigitsOrUndefined(value))
  @IsString()
  @Matches(/^\d{11}$/, { message: 'cpf deve ter 11 dígitos' })
  cpf?: string;

  @ApiPropertyOptional({ example: '12345678000199', description: 'Obrigatório para clientes PJ' })
  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerTypeDto.PJ)
  @Transform(({ value }) => toDigitsOrUndefined(value))
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve ter 14 dígitos' })
  cnpj?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Rua das Flores' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  street: string;

  @ApiProperty({ example: '123' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(1)
  addressNumber: string;

  @ApiPropertyOptional({ example: 'Sala 1' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  complement?: string;

  @ApiProperty({ example: 'Centro' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  neighborhood: string;

  @ApiProperty({ example: 'Sao Paulo' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  city: string;

  @ApiProperty({ example: 'SP' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(2, 2)
  state: string;

  @ApiProperty({ example: '01310100' })
  @Transform(({ value }) => toDigitsOrUndefined(value))
  @IsString()
  @Matches(/^\d{8}$/, { message: 'zipCode deve ter 8 dígitos' })
  zipCode: string;

  @ApiPropertyOptional({ example: '3550308' })
  @IsOptional()
  @Transform(({ value }) => toDigitsOrUndefined(value))
  @IsString()
  @Matches(/^\d{7}$/, { message: 'ibgeCode deve ter 7 dígitos' })
  ibgeCode?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  inscricaoEstadual?: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  inscricaoMunicipal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
