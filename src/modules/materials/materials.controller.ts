import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CreateMaterialStockDto } from './dto/create-stock.dto';
import { UpdateMaterialStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('materials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar materiais (paginado)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do material com estoque ativo' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar material' })
  create(@Body() dto: CreateMaterialDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar material' })
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover material — bloqueado se houver jobs ativos (Regra 10)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Listar carretéis do material (paginado)' })
  getStocks(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.service.getStocks(id, pagination);
  }

  @Post(':id/stock')
  @ApiOperation({ summary: 'Adicionar carretel ao material' })
  createStock(@Param('id') id: string, @Body() dto: CreateMaterialStockDto) {
    return this.service.createStock(id, dto);
  }

  @Patch('stock/:stockId')
  @ApiOperation({
    summary: 'Atualizar carretel (label, status, peso atual, data de abertura)',
    description:
      'Atualizar peso dispara registro de transação ADJUSTMENT automática. Retorna alerta de estoque baixo se aplicável (Regra 8).',
  })
  updateStock(@Param('stockId') stockId: string, @Body() dto: UpdateMaterialStockDto) {
    return this.service.updateStock(stockId, dto);
  }

  @Post('stock/:stockId/transaction')
  @ApiOperation({
    summary: 'Registrar movimentação de estoque',
    description: 'Retorna alerta de estoque baixo se CONSUMPTION/WASTE (Regra 8).',
  })
  createTransaction(
    @Param('stockId') stockId: string,
    @Body() dto: CreateStockTransactionDto,
  ) {
    return this.service.createTransaction(stockId, dto);
  }
}
