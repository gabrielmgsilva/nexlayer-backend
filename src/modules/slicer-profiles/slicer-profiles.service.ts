import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSlicerProfileDto, UpdateSlicerProfileDto } from './dto/slicer-profile.dto';

@Injectable()
export class SlicerProfilesService {
  private readonly logger = new Logger(SlicerProfilesService.name);

  constructor(private prisma: PrismaService) {}

  findAll(params?: { materialId?: string; equipmentId?: string; isActive?: boolean }) {
    return this.prisma.slicerProfile.findMany({
      where: {
        ...(params?.materialId && { materialId: params.materialId }),
        ...(params?.equipmentId && { equipmentId: params.equipmentId }),
        ...(params?.isActive !== undefined && { isActive: params.isActive }),
      },
      include: {
        material: { select: { id: true, filamentType: { select: { name: true } }, brand: { select: { name: true } } } },
        equipment: { select: { id: true, name: true, model: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.slicerProfile.findUnique({
      where: { id },
      include: {
        material: { select: { id: true, filamentType: { select: { name: true } }, brand: { select: { name: true } } } },
        equipment: { select: { id: true, name: true, model: true } },
      },
    });
    if (!profile) throw new NotFoundException('Perfil de fatiamento não encontrado');
    return profile;
  }

  async create(dto: CreateSlicerProfileDto) {
    this.logger.log(`create: ${dto.name}`);
    return this.prisma.slicerProfile.create({ data: dto });
  }

  async update(id: string, dto: UpdateSlicerProfileDto) {
    await this.findOne(id);
    return this.prisma.slicerProfile.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.slicerProfile.delete({ where: { id } });
  }
}
