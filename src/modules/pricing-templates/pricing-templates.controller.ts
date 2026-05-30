import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PricingTemplatesService } from './pricing-templates.service';
import { CreatePricingTemplateDto } from './dto/create-template.dto';
import { DeriveProductDto } from './dto/derive-product.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('pricing-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing-templates')
export class PricingTemplatesController {
  constructor(private readonly service: PricingTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os templates de precificação' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do template com produtos derivados' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Criar/atualizar template a partir do último CostSnapshot do produto âncora' })
  create(@Body() dto: CreatePricingTemplateDto) { return this.service.create(dto); }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview de preço sem criar produto (simula derivação)' })
  preview(@Param('id') id: string, @Body() dto: DeriveProductDto) {
    return this.service.preview(id, dto);
  }

  @Post(':id/derive')
  @ApiOperation({ summary: 'Criar produto derivado do template com preço calculado automaticamente' })
  derive(@Param('id') id: string, @Body() dto: DeriveProductDto) {
    return this.service.deriveProduct(id, dto);
  }

  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Recalcular preço de todos os produtos derivados com as taxas atuais do template' })
  recalculate(@Param('id') id: string) {
    return this.service.recalculateAll(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover template (desvincula produtos derivados sem deletá-los)' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
