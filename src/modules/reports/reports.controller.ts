import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('pnl')
  @ApiOperation({ summary: 'P&L agregado no período (com breakdown opcional por canal)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'channelId', required: false })
  pnl(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.service.getPnl({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      channelId,
    });
  }

  @Get('pnl/by-channel')
  @ApiOperation({ summary: 'P&L quebrado por canal de venda' })
  pnlByChannel(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getPnlByChannel({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('cost-variance')
  @ApiOperation({ summary: 'Custo real (consumo de estoque) vs custo do snapshot por job' })
  costVariance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getCostVariance({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Comissões por canal no período' })
  commissions(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getCommissions({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
