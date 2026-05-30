import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrintFailuresService } from './print-failures.service';
import { CreatePrintFailureDto } from './dto/create-print-failure.dto';
import { FilterPrintFailuresDto } from './dto/filter-print-failures.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('print-failures')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('print-failures')
export class PrintFailuresController {
  constructor(private readonly service: PrintFailuresService) {}

  @Get()
  @ApiOperation({ summary: 'Listar falhas de impressão com filtros' })
  findAll(@Query() filter: FilterPrintFailuresDto) {
    return this.service.findAll(filter);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Estatísticas agregadas de falhas' })
  getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAnalytics(from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de uma falha' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar falha de impressão' })
  create(@Body() dto: CreatePrintFailureDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar registro de falha' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePrintFailureDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover registro de falha' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
