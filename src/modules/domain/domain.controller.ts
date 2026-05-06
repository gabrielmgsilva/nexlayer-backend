import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { MaterialCategory } from '@prisma/client';
import { DomainService } from './domain.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

class NameDto            { @IsString() name: string }
class FilamentTypeDto    {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(MaterialCategory) category?: MaterialCategory;
  @IsOptional() @IsNumber() sortOrder?: number;
}
class ColorDto           { @IsString() name: string; @IsOptional() @IsString() hexCode?: string; @IsOptional() @IsBoolean() isRainbow?: boolean }
class BrandDto           { @IsString() name: string; @IsOptional() @IsString() website?: string }
class UnitDto            { @IsString() name: string; @IsString() symbol: string }

@ApiTags('domain')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('domain')
export class DomainController {
  constructor(private readonly svc: DomainService) {}

  // ── Filament Types ───────────────────────────────────────────────
  @Get('filament-types')
  @ApiOperation({ summary: 'Listar tipos de filamento/resina' })
  getFilamentTypes(@Query('category') category?: MaterialCategory) {
    return this.svc.getFilamentTypes(category);
  }

  @Post('filament-types')
  createFilamentType(@Body() dto: FilamentTypeDto) {
    return this.svc.createFilamentType(dto);
  }

  @Put('filament-types/:id')
  updateFilamentType(@Param('id') id: string, @Body() dto: Partial<FilamentTypeDto>) {
    return this.svc.updateFilamentType(id, dto);
  }

  @Delete('filament-types/:id')
  @HttpCode(HttpStatus.OK)
  deleteFilamentType(@Param('id') id: string) {
    return this.svc.deleteFilamentType(id);
  }

  // ── Colors ───────────────────────────────────────────────────────
  @Get('colors')
  @ApiOperation({ summary: 'Listar cores' })
  getColors() { return this.svc.getColors(); }

  @Post('colors')
  createColor(@Body() dto: ColorDto) { return this.svc.createColor(dto); }

  @Put('colors/:id')
  updateColor(@Param('id') id: string, @Body() dto: Partial<ColorDto>) {
    return this.svc.updateColor(id, dto);
  }

  @Delete('colors/:id')
  @HttpCode(HttpStatus.OK)
  deleteColor(@Param('id') id: string) { return this.svc.deleteColor(id); }

  // ── Brands ───────────────────────────────────────────────────────
  @Get('brands')
  @ApiOperation({ summary: 'Listar marcas' })
  getBrands() { return this.svc.getBrands(); }

  @Post('brands')
  createBrand(@Body() dto: BrandDto) { return this.svc.createBrand(dto); }

  @Put('brands/:id')
  updateBrand(@Param('id') id: string, @Body() dto: Partial<BrandDto>) {
    return this.svc.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  @HttpCode(HttpStatus.OK)
  deleteBrand(@Param('id') id: string) { return this.svc.deleteBrand(id); }

  // ── Accessory Categories ─────────────────────────────────────────
  @Get('accessory-categories')
  @ApiOperation({ summary: 'Listar categorias de acessórios' })
  getAccessoryCategories() { return this.svc.getAccessoryCategories(); }

  @Post('accessory-categories')
  createAccessoryCategory(@Body() dto: NameDto) {
    return this.svc.createAccessoryCategory(dto);
  }

  @Put('accessory-categories/:id')
  updateAccessoryCategory(@Param('id') id: string, @Body() dto: Partial<NameDto>) {
    return this.svc.updateAccessoryCategory(id, dto);
  }

  @Delete('accessory-categories/:id')
  @HttpCode(HttpStatus.OK)
  deleteAccessoryCategory(@Param('id') id: string) {
    return this.svc.deleteAccessoryCategory(id);
  }

  // ── Units ─────────────────────────────────────────────────────────
  @Get('units')
  @ApiOperation({ summary: 'Listar unidades de medida' })
  getUnits() { return this.svc.getUnits(); }

  @Post('units')
  createUnit(@Body() dto: UnitDto) { return this.svc.createUnit(dto); }

  @Put('units/:id')
  updateUnit(@Param('id') id: string, @Body() dto: Partial<UnitDto>) {
    return this.svc.updateUnit(id, dto);
  }

  @Delete('units/:id')
  @HttpCode(HttpStatus.OK)
  deleteUnit(@Param('id') id: string) { return this.svc.deleteUnit(id); }
}
