import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
  BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as path from 'path';
import { Response } from 'express';

// ── Inline DTOs ───────────────────────────────────────────────────────────────
class AddPhotoDto {
  @ApiProperty() @IsString() url: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}
class AddPrintFileDto {
  @ApiProperty() @IsString() url: string;
  @ApiProperty() @IsString() filename: string;
  @ApiProperty() @IsString() format: string;
}
class AdjustStockDto {
  @ApiProperty({ description: 'Delta positivo (entrada) ou negativo (saída)' })
  @IsNumber()
  delta: number;
}

// ── File filter helpers ───────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_MODEL_EXTS = ['.stl', '.3mf'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_MODEL_BYTES = 100 * 1024 * 1024; // 100 MB

const imageInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new BadRequestException('Apenas JPEG, PNG e WebP são permitidos'), false);
    }
    cb(null, true);
  },
});

const modelInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_MODEL_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MODEL_EXTS.includes(ext)) {
      return cb(new BadRequestException('Apenas arquivos .stl e .3mf são permitidos'), false);
    }
    cb(null, true);
  },
});

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // ── Product list / detail / CRUD ─────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar produtos (paginado)' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(@Query() filter: FilterProductsDto) {
    const { categoryId, isActive, ...pagination } = filter;
    return this.service.findAll(pagination, categoryId, isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do produto' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/cost-snapshot')
  @ApiOperation({ summary: 'Último cost snapshot do produto' })
  getLatestCostSnapshot(@Param('id') id: string) {
    return this.service.getLatestCostSnapshot(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar produto' })
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar produto' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover produto (soft delete)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── Product photo & model upload ─────────────────────────────────────────

  @Post(':id/upload/photo')
  @ApiOperation({ summary: 'Upload de foto do produto para Cloudflare R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, isPrimary: { type: 'boolean' } } } })
  @UseInterceptors(imageInterceptor)
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('isPrimary') isPrimary?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    return this.service.uploadProductPhoto(id, file, isPrimary === 'true');
  }

  @Post(':id/upload/model')
  @ApiOperation({ summary: 'Upload de modelo 3D (.stl/.3mf) do produto para Cloudflare R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(modelInterceptor)
  uploadModel(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    return this.service.uploadProductModel(id, file);
  }

  // ── Legacy photo / print-file endpoints (URL-based, kept for compatibility) ─

  @Post(':id/photos')
  @ApiOperation({ summary: 'Adicionar foto por URL' })
  addPhoto(@Param('id') id: string, @Body() dto: AddPhotoDto) {
    return this.service.addPhoto(id, dto.url, dto.isPrimary ?? false);
  }

  @Delete(':id/photos')
  @ApiOperation({ summary: 'Remover foto' })
  @ApiBody({ schema: { properties: { url: { type: 'string' } } } })
  removePhoto(@Param('id') id: string, @Body('url') url: string) {
    return this.service.removePhoto(id, url);
  }

  @Post(':id/print-files')
  @ApiOperation({ summary: 'Adicionar arquivo de impressão por URL' })
  addPrintFile(@Param('id') id: string, @Body() dto: AddPrintFileDto) {
    return this.service.addPrintFile(id, dto);
  }

  @Delete(':id/print-files')
  @ApiOperation({ summary: 'Remover arquivo de impressão' })
  @ApiBody({ schema: { properties: { url: { type: 'string' } } } })
  removePrintFile(@Param('id') id: string, @Body('url') url: string) {
    return this.service.removePrintFile(id, url);
  }

  @Get(':id/print-files/view')
  @ApiOperation({ summary: 'Visualizar arquivo de impressão via proxy (bypass CORS)' })
  @ApiQuery({ name: 'url', required: true, type: String })
  async viewPrintFile(
    @Param('id') id: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    if (!url) throw new BadRequestException('Parâmetro "url" é obrigatório');

    const file = await this.service.getPrintFileViewContent(id, url);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.send(file.buffer);
  }

  // ── Product stock ─────────────────────────────────────────────────────────

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Ajustar estoque do produto (delta positivo = entrada, negativo = saída)' })
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.service.adjustStock(id, dto.delta);
  }

  // ── Variations ───────────────────────────────────────────────────────────

  @Get(':id/variations')
  @ApiOperation({ summary: 'Listar variações do produto' })
  getVariations(@Param('id') id: string) {
    return this.service.getVariations(id);
  }

  @Post(':id/variations')
  @ApiOperation({ summary: 'Criar variação' })
  createVariation(@Param('id') id: string, @Body() dto: CreateVariationDto) {
    return this.service.createVariation(id, dto);
  }

  @Put(':id/variations/:varId')
  @ApiOperation({ summary: 'Atualizar variação' })
  updateVariation(
    @Param('id') id: string,
    @Param('varId') varId: string,
    @Body() dto: UpdateVariationDto,
  ) {
    return this.service.updateVariation(id, varId, dto);
  }

  @Delete(':id/variations/:varId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover variação' })
  removeVariation(@Param('id') id: string, @Param('varId') varId: string) {
    return this.service.removeVariation(id, varId);
  }

  @Patch(':id/variations/:varId/stock')
  @ApiOperation({ summary: 'Ajustar estoque de variação' })
  adjustVariationStock(
    @Param('id') id: string,
    @Param('varId') varId: string,
    @Body() dto: AdjustStockDto,
  ) {
    void id; // parentId validated inside service via findFirst
    return this.service.adjustVariationStock(varId, dto.delta);
  }

  @Post(':id/variations/:varId/upload/photo')
  @ApiOperation({ summary: 'Upload de foto da variação para Cloudflare R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(imageInterceptor)
  uploadVariationPhoto(
    @Param('id') id: string,
    @Param('varId') varId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    return this.service.uploadVariationPhoto(id, varId, file);
  }

  @Post(':id/variations/:varId/upload/model')
  @ApiOperation({ summary: 'Upload de modelo 3D (.stl/.3mf) da variação para Cloudflare R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(modelInterceptor)
  uploadVariationModel(
    @Param('id') id: string,
    @Param('varId') varId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    return this.service.uploadVariationModel(id, varId, file);
  }
}
