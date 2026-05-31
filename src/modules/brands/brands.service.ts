import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private prisma: PrismaService) {}

  findAll(params?: { isActive?: boolean }) {
    return this.prisma.brand.findMany({
      where: params?.isActive !== undefined ? { isActive: params.isActive } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { materials: true, equipment: true } },
      },
    });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { materials: true, equipment: true } } },
    });
    if (!brand) throw new NotFoundException('Marca não encontrada');
    return brand;
  }

  async create(dto: CreateBrandDto) {
    const exists = await this.prisma.brand.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Já existe uma marca com este nome');
    this.logger.log(`create: ${dto.name}`);
    return this.prisma.brand.create({ data: dto });
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findOne(id);
    if (dto.name) {
      const conflict = await this.prisma.brand.findFirst({ where: { name: dto.name, id: { not: id } } });
      if (conflict) throw new ConflictException('Já existe uma marca com este nome');
    }
    return this.prisma.brand.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const brand = await this.findOne(id);
    const total = brand._count.materials + brand._count.equipment;
    if (total > 0) {
      return this.prisma.brand.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.brand.delete({ where: { id } });
  }
}
