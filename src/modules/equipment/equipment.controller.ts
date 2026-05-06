import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { UpdateEquipmentStatusDto } from './dto/update-status.dto';
import { CreateMaintenanceLogDto } from './dto/create-maintenance-log.dto';
import { FilterEquipmentDto } from './dto/filter-equipment.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get()
  @ApiOperation({ summary: 'Listar equipamentos (paginado)' })
  @ApiQuery({ name: 'status', required: false, enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'] })
  findAll(@Query() filter: FilterEquipmentDto) {
    const { status, ...pagination } = filter;
    return this.service.findAll(pagination, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateEquipmentDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateEquipmentStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover equipamento — bloqueado se houver jobs ativos (Regra 10)' })
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Get(':id/maintenance-log')
  @ApiOperation({ summary: 'Listar histórico de manutenção (paginado)' })
  getMaintenanceLogs(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.service.getMaintenanceLogs(id, pagination);
  }

  @Post(':id/maintenance-log')
  createMaintenanceLog(@Param('id') id: string, @Body() dto: CreateMaintenanceLogDto) {
    return this.service.createMaintenanceLog(id, dto);
  }
}
