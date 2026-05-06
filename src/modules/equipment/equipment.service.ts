import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { CreateMaintenanceLogDto } from './dto/create-maintenance-log.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { paginate, getPrismaPage } from '../../shared/utils/paginate';

@Injectable()
export class EquipmentService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto, status?: EquipmentStatus) {
    const { page = 1, limit = 20 } = pagination;
    const where = { deletedAt: null, ...(status ? { status } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where,
        include: { brand: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.equipment.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, deletedAt: null },
      include: { brand: { select: { id: true, name: true } } },
    });
    if (!equipment) throw new NotFoundException('Equipamento não encontrado');
    return equipment;
  }

  create(dto: CreateEquipmentDto) {
    return this.prisma.equipment.create({
      data: {
        ...dto,
        purchasePrice: dto.purchasePrice,
        purchaseDate: new Date(dto.purchaseDate),
      },
    });
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    await this.findOne(id);
    return this.prisma.equipment.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.purchaseDate ? { purchaseDate: new Date(dto.purchaseDate) } : {}),
      },
    });
  }

  async updateStatus(id: string, status: EquipmentStatus) {
    await this.findOne(id);
    return this.prisma.equipment.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    const equipment = await this.findOne(id);
    if (equipment.status === EquipmentStatus.PRINTING) {
      throw new BadRequestException('Não é possível remover equipamento em uso');
    }
    // Regra 10: verificar jobs ativos
    const activeJobs = await this.prisma.productionJob.count({
      where: {
        equipmentId: id,
        status: { notIn: ['DELIVERED', 'CANCELLED', 'QC_REJECTED'] },
      },
    });
    if (activeJobs > 0) {
      throw new BadRequestException(
        `Equipamento possui ${activeJobs} job(s) ativo(s). Finalize-os antes de remover.`,
      );
    }
    return this.prisma.equipment.update({
      where: { id },
      data: { deletedAt: new Date(), status: EquipmentStatus.OFFLINE },
    });
  }

  async getMaintenanceLogs(equipmentId: string, pagination: PaginationDto) {
    await this.findOne(equipmentId);
    const { page = 1, limit = 20 } = pagination;
    const where = { equipmentId };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceLog.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.maintenanceLog.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async createMaintenanceLog(equipmentId: string, dto: CreateMaintenanceLogDto) {
    await this.findOne(equipmentId);
    return this.prisma.maintenanceLog.create({
      data: {
        equipmentId,
        description: dto.description,
        cost: dto.cost,
        performedAt: new Date(dto.performedAt),
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : undefined,
        notes: dto.notes,
      },
    });
  }
}
