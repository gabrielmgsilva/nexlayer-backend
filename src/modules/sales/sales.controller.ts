import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SaleStatus } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { FilterSalesDto } from './dto/filter-sales.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  // ── Channels ───────────────────────────────────────────────

  @Get('channels')
  @ApiOperation({ summary: 'Listar canais de venda' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAllChannels(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true' || includeInactive === '1';
    return this.service.findAllChannels({ includeInactive: include });
  }

  @Get('channels/:id')
  findOneChannel(@Param('id') id: string) {
    return this.service.findOneChannel(id);
  }

  @Post('channels')
  createChannel(@Body() dto: CreateChannelDto) {
    return this.service.createChannel(dto);
  }

  @Put('channels/:id')
  updateChannel(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.service.updateChannel(id, dto);
  }

  @Delete('channels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeChannel(@Param('id') id: string) {
    return this.service.removeChannel(id);
  }

  // ── Sale Orders ────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar vendas (paginado)' })
  findAll(@Query() filter: FilterSalesDto) {
    const { status, channelId, customerId, ...pagination } = filter;
    return this.service.findAll({
      status: status as SaleStatus | undefined,
      channelId,
      customerId,
      ...pagination,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSaleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Alterar status da venda' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: SaleStatus,
  ) {
    return this.service.updateStatus(id, status);
  }
}
