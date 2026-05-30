import {
  Injectable, NotFoundException, ConflictException,
  InternalServerErrorException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCostConfigDto } from './dto/create-cost-config.dto';
import { UpdateCostConfigDto } from './dto/update-cost-config.dto';

@Injectable()
export class CostConfigService {
  private readonly logger = new Logger(CostConfigService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    try {
      this.logger.log('Buscando todos os centros de custo');
      return await this.prisma.costConfig.findMany({
        orderBy: [{ isActive: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }],
      });
    } catch (err) {
      this.logger.error('Erro ao buscar centros de custo', err);
      throw new InternalServerErrorException('Falha ao listar centros de custo');
    }
  }

  async findOne(id: string) {
    try {
      const config = await this.prisma.costConfig.findUnique({ where: { id } });
      if (!config) throw new NotFoundException(`Centro de custo ${id} não encontrado`);
      return config;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Erro ao buscar centro de custo ${id}`, err);
      throw new InternalServerErrorException('Falha ao buscar centro de custo');
    }
  }

  async findDefault() {
    try {
      const config = await this.prisma.costConfig.findFirst({ where: { isDefault: true } });
      if (!config) throw new NotFoundException('Nenhum centro de custo padrão encontrado');
      return config;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error('Erro ao buscar centro de custo padrão', err);
      throw new InternalServerErrorException('Falha ao buscar centro de custo padrão');
    }
  }

  async create(dto: CreateCostConfigDto) {
    this.logger.log(`Criando centro de custo: ${dto.name}`);
    try {
      if (dto.isDefault) await this.clearDefault();

      const data: Record<string, unknown> = {
        name:                  dto.name,
        isDefault:             dto.isDefault             ?? false,
        isActive:              dto.isActive              ?? true,
        electricityCostPerKwh: dto.electricityCostPerKwh,
        laborCostPerHour:      dto.laborCostPerHour      ?? null,
        monthlyOverhead:       dto.monthlyOverhead       ?? null,
        monthlyProductionHours:dto.monthlyProductionHours ?? null,
        failureRateMode:       dto.failureRateMode       ?? 'HYBRID',
        failureRatePercent:    dto.failureRatePercent    ?? 5,
        failureAutoWindowDays: dto.failureAutoWindowDays ?? null,
        failureAutoMinSamples: dto.failureAutoMinSamples ?? null,
        notes:                 dto.notes                 ?? null,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = await (this.prisma.costConfig.create as any)({ data });

      this.logger.log(`Centro de custo criado: ${config.id}`);
      return config;
    } catch (err) {
      this.logger.error(`Erro ao criar centro de custo "${dto.name}"`, err?.stack ?? err);
      if (err instanceof ConflictException) throw err;
      throw new InternalServerErrorException('Falha ao criar centro de custo');
    }
  }

  async update(id: string, dto: UpdateCostConfigDto) {
    this.logger.log(`Atualizando centro de custo ${id}`);
    try {
      const config = await this.findOne(id);

      const nextIsDefault = dto.isDefault ?? config.isDefault;
      const nextIsActive  = dto.isActive  ?? config.isActive;
      if (nextIsDefault && !nextIsActive) {
        throw new ConflictException('Não é possível desativar o centro de custo padrão');
      }

      if (dto.isDefault) await this.clearDefault(id);

      const data: Record<string, unknown> = {};
      if (dto.name                   !== undefined) data.name                   = dto.name;
      if (dto.isDefault              !== undefined) data.isDefault              = dto.isDefault;
      if (dto.isActive               !== undefined) data.isActive               = dto.isActive;
      if (dto.electricityCostPerKwh  !== undefined) data.electricityCostPerKwh  = dto.electricityCostPerKwh;
      if (dto.laborCostPerHour       !== undefined) data.laborCostPerHour       = dto.laborCostPerHour;
      if (dto.monthlyOverhead        !== undefined) data.monthlyOverhead        = dto.monthlyOverhead;
      if (dto.monthlyProductionHours !== undefined) data.monthlyProductionHours = dto.monthlyProductionHours;
      if (dto.failureRateMode        !== undefined) data.failureRateMode        = dto.failureRateMode;
      if (dto.failureRatePercent     !== undefined) data.failureRatePercent     = dto.failureRatePercent;
      if (dto.failureAutoWindowDays  !== undefined) data.failureAutoWindowDays  = dto.failureAutoWindowDays;
      if (dto.failureAutoMinSamples  !== undefined) data.failureAutoMinSamples  = dto.failureAutoMinSamples;
      if (dto.notes                  !== undefined) data.notes                  = dto.notes;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (this.prisma.costConfig.update as any)({ where: { id }, data });
      this.logger.log(`Centro de custo ${id} atualizado`);
      return updated;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ConflictException) throw err;
      this.logger.error(`Erro ao atualizar centro de custo ${id}`, err?.stack ?? err);
      throw new InternalServerErrorException('Falha ao atualizar centro de custo');
    }
  }

  async remove(id: string) {
    this.logger.log(`Removendo centro de custo ${id}`);
    try {
      const config = await this.findOne(id);

      if (config.isDefault) {
        throw new ConflictException('Não é possível remover o centro de custo padrão');
      }

      const jobsCount = await this.prisma.productionJob.count({ where: { costConfigId: id } });
      if (jobsCount > 0) {
        throw new ConflictException(`Perfil em uso por ${jobsCount} job(s); desative em vez de excluir`);
      }

      await this.prisma.costConfig.delete({ where: { id } });
      this.logger.log(`Centro de custo ${id} removido`);
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ConflictException) throw err;
      this.logger.error(`Erro ao remover centro de custo ${id}`, err?.stack ?? err);
      throw new InternalServerErrorException('Falha ao remover centro de custo');
    }
  }

  private async clearDefault(excludeId?: string) {
    await this.prisma.costConfig.updateMany({
      where: { isDefault: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      data: { isDefault: false },
    });
  }
}
