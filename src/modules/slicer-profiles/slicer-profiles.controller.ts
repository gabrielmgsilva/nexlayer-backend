import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { SlicerProfilesService } from './slicer-profiles.service';
import { CreateSlicerProfileDto, UpdateSlicerProfileDto } from './dto/slicer-profile.dto';

@ApiTags('slicer-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('slicer-profiles')
export class SlicerProfilesController {
  constructor(private readonly service: SlicerProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar perfis de fatiamento' })
  findAll(
    @Query('materialId') materialId?: string,
    @Query('equipmentId') equipmentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.service.findAll({ materialId, equipmentId, isActive: active });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSlicerProfileDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlicerProfileDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
