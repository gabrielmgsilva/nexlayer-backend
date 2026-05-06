import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CostConfigService } from './cost-config.service';
import { CreateCostConfigDto } from './dto/create-cost-config.dto';
import { UpdateCostConfigDto } from './dto/update-cost-config.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('cost-configs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cost-configs')
export class CostConfigController {
  constructor(private readonly service: CostConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Listar perfis de custo' })
  findAll() { return this.service.findAll(); }

  @Get('default')
  @ApiOperation({ summary: 'Obter perfil padrão' })
  findDefault() { return this.service.findDefault(); }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do perfil' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Criar perfil de custo' })
  create(@Body() dto: CreateCostConfigDto) { return this.service.create(dto); }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar perfil' })
  update(@Param('id') id: string, @Body() dto: UpdateCostConfigDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover perfil' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
