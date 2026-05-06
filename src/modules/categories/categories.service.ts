import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns all categories as a flat list with parent/children counts.
   * The domain page builds the tree client-side.
   */
  async findAll(onlyActive = false, name?: string) {
    return this.prisma.category.findMany({
      where: {
        ...(onlyActive ? { isActive: true } : {}),
        ...(name ? { name: { contains: name, mode: 'insensitive' as const } } : {}),
      },
      include: {
        _count: { select: { products: true, children: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: { name: 'asc' } },
        _count: { select: { products: true } },
      },
    });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug já em uso');
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Categoria pai não encontrada');
    }
    return this.prisma.category.create({
      data: dto,
      include: { _count: { select: { products: true, children: true } } },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (dto.slug) {
      const exists = await this.prisma.category.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (exists) throw new ConflictException('Slug já em uso');
    }
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A categoria não pode ser pai de si mesma');
      await this.ensureNoCircular(id, dto.parentId);
    }
    return this.prisma.category.update({
      where: { id },
      data: dto,
      include: { _count: { select: { products: true, children: true } } },
    });
  }

  async remove(id: string) {
    const cat = await this.findOne(id);
    const childCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictException(`Categoria possui ${childCount} subcategoria(s). Remova-as antes.`);
    }
    if (cat._count.products > 0) {
      const updated = await this.prisma.category.update({ where: { id }, data: { isActive: false } });
      return { ...updated, action: 'deactivated' as const };
    }
    await this.prisma.category.delete({ where: { id } });
    return { id, action: 'deleted' as const };
  }

  private async ensureNoCircular(categoryId: string, targetParentId: string) {
    let current = targetParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === categoryId) {
        throw new BadRequestException('Referência circular detectada: a categoria pai é descendente desta categoria');
      }
      if (visited.has(current)) break;
      visited.add(current);
      const parent = await this.prisma.category.findUnique({ where: { id: current }, select: { parentId: true } });
      current = parent?.parentId ?? '';
    }
  }
}
