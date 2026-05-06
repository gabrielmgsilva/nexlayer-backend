import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCostConfigDto } from './dto/create-cost-config.dto';
import { UpdateCostConfigDto } from './dto/update-cost-config.dto';

@Injectable()
export class CostConfigService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.costConfig.findMany({
      orderBy: [{ isActive: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }],
      include: { equipment: { select: { id: true, name: true, annualMaintenanceCost: true, annualUsageHours: true, avgPowerWatts: true, purchasePrice: true, estimatedLifespanHours: true } } },
    });
  }

  async findOne(id: string) {
    const config = await this.prisma.costConfig.findUnique({
      where: { id },
      include: { equipment: { select: { id: true, name: true, annualMaintenanceCost: true, annualUsageHours: true, avgPowerWatts: true, purchasePrice: true, estimatedLifespanHours: true } } },
    });
    if (!config) throw new NotFoundException('Configuração de custo não encontrada');
    return config;
  }

  async findDefault() {
    const config = await this.prisma.costConfig.findFirst({ where: { isDefault: true } });
    if (!config) throw new NotFoundException('Nenhuma configuração padrão encontrada');
    return config;
  }

  async create(dto: CreateCostConfigDto) {
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.costConfig.create({ data: dto });
  }

  async update(id: string, dto: UpdateCostConfigDto) {
    const config = await this.findOne(id);

    const nextIsDefault = dto.isDefault ?? config.isDefault;
    const nextIsActive = dto.isActive ?? config.isActive;
    if (nextIsDefault && !nextIsActive) {
      throw new ConflictException('Não é possível desativar a configuração padrão');
    }

    if (dto.isDefault) await this.clearDefault(id);
    return this.prisma.costConfig.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const config = await this.findOne(id);
    if (config.isDefault) {
      throw new ConflictException('Não é possível remover a configuração padrão');
    }

    const jobsUsingConfig = await this.prisma.productionJob.count({ where: { costConfigId: id } });
    if (jobsUsingConfig > 0) {
      throw new ConflictException('Perfil em uso por jobs; desative em vez de excluir');
    }

    return this.prisma.costConfig.delete({ where: { id } });
  }

  private async clearDefault(excludeId?: string) {
    await this.prisma.costConfig.updateMany({
      where: { isDefault: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      data: { isDefault: false },
    });
  }
}
