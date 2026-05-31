import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Bambu Lab' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'https://bambulab.com' })
  @IsOptional()
  @IsUrl()
  website?: string;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
