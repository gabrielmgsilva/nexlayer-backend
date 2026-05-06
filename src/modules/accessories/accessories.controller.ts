import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AccessoriesService } from './accessories.service';
import { CreateAccessoryDto } from './dto/create-accessory.dto';
import { UpdateAccessoryDto } from './dto/update-accessory.dto';
import { CreateAccessoryTransactionDto } from './dto/create-transaction.dto';
import { FilterAccessoriesDto } from './dto/filter-accessories.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('accessories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accessories')
export class AccessoriesController {
  constructor(private readonly service: AccessoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar acessórios (paginado)' })
  @ApiQuery({ name: 'categoryId', required: false })
  findAll(@Query() filter: FilterAccessoriesDto) {
    const { categoryId, ...pagination } = filter;
    return this.service.findAll(pagination, categoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do acessório com histórico de preços' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Criar acessório (cost_per_unit calculado automaticamente)' })
  create(@Body() dto: CreateAccessoryDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccessoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/transaction')
  @ApiOperation({
    summary: 'Movimentação de estoque',
    description: 'PURCHASE atualiza cost_per_unit e grava histórico de preço. Retorna alerta se CONSUMPTION deixar estoque abaixo do mínimo (Regra 8).',
  })
  createTransaction(
    @Param('id') id: string,
    @Body() dto: CreateAccessoryTransactionDto,
  ) {
    return this.service.createTransaction(id, dto);
  }
}
