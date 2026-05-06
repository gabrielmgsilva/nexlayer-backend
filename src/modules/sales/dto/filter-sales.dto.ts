import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class FilterSalesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  channelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  customerId?: string;
}
