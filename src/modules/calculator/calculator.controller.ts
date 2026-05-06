import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalculatorService } from './calculator.service';
import { EstimateDto } from './dto/estimate.dto';
import { CreateJobDto } from '../production/dto/create-job.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('calculator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calculator')
export class CalculatorController {
  constructor(private readonly service: CalculatorService) {}

  @Post('estimate')
  @ApiOperation({
    summary: 'Estimativa rápida de custo sem criar job',
    description: 'Calcula custo/unidade, preço de venda e lucro em tempo real, útil para orçamentos rápidos.',
  })
  estimate(@Body() dto: EstimateDto) {
    return this.service.estimate(dto);
  }

  @Post('create-job')
  @ApiOperation({
    summary: 'Criar job de produção a partir da calculadora',
    description: 'Cria um novo job com os dados calculados, enviando direto para a fila de produção.',
  })
  createJob(@Body() dto: CreateJobDto) {
    return this.service.createJob(dto);
  }
}
