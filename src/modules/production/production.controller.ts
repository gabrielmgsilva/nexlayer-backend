import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JobStatus } from '@prisma/client';
import { ProductionService } from './production.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

const invoiceInterceptor = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/xml', 'text/xml'];
    if (!allowed.includes(file.mimetype)) {
      cb(new BadRequestException('Apenas PDF e XML são permitidos'), false);
      return;
    }
    cb(null, true);
  },
});

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  @Get()
  @ApiOperation({ summary: 'Listar jobs (filtros: status, cliente, produto, statusGroup)' })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'statusGroup', required: false, enum: ['active', 'finished'] })
  findAll(
    @Query('status') status?: JobStatus,
    @Query('customerId') customerId?: string,
    @Query('productId') productId?: string,
    @Query('statusGroup') statusGroup?: 'active' | 'finished',
  ) {
    return this.service.findAll({ status, customerId, productId, statusGroup });
  }

  @Get('queue')
  @ApiOperation({ summary: 'Fila de produção agrupada por equipamento (kanban)' })
  getQueue() {
    return this.service.getQueue();
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Timeline de jobs por equipamento (janela em horas)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO datetime' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO datetime' })
  getTimeline(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getTimeline({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do job com custos e snapshots' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar job (gera CostSnapshot automaticamente)' })
  create(@Body() dto: CreateJobDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar job (apenas status QUOTED)' })
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transição de status (máquina de estados)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Patch(':id/queue-position')
  @ApiOperation({ summary: 'Reordenar job na fila / mudar de equipamento' })
  updateQueuePosition(
    @Param('id') id: string,
    @Body() body: { equipmentId?: string | null; position: number },
  ) {
    return this.service.updateQueuePosition(id, body.equipmentId ?? null, body.position);
  }

  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Recalcular custos (gera novo CostSnapshot com versão incrementada)' })
  recalculate(@Param('id') id: string) {
    return this.service.recalculate(id);
  }

  @Get(':id/cost-history')
  @ApiOperation({ summary: 'Histórico de snapshots de custo do job' })
  getCostHistory(@Param('id') id: string) {
    return this.service.getCostHistory(id);
  }

  @Post(':id/upload/invoice')
  @ApiOperation({ summary: 'Upload de nota fiscal (PDF/XML) — apenas jobs DELIVERED' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(invoiceInterceptor)
  uploadInvoice(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    return this.service.uploadInvoice(id, file);
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clonar job existente (cria novo job QUOTED com mesmos parâmetros)' })
  cloneJob(@Param('id') id: string) {
    return this.service.cloneJob(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar job' })
  cancel(@Param('id') id: string) {
    return this.service.updateStatus(id, JobStatus.CANCELLED);
  }
}
