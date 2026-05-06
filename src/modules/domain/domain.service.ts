import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { MaterialCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type DomainTable = 'filamentType' | 'color' | 'brand' | 'accessoryCategory' | 'unit';

interface CreateDomainDto {
  name: string;
  description?: string;
  hexCode?: string;
  website?: string;
  symbol?: string;
}

@Injectable()
export class DomainService {
  constructor(private prisma: PrismaService) {}

  // ── FilamentTypes ─────────────────────────────────────────────
  getFilamentTypes(category?: MaterialCategory) {
    return this.prisma.filamentType.findMany({
      where: { isActive: true, ...(category ? { category } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createFilamentType(dto: { name: string; description?: string; category?: MaterialCategory; sortOrder?: number }) {
    try {
      return await this.prisma.filamentType.create({ data: dto });
    } catch { throw new ConflictException(`Tipo "${dto.name}" já existe`); }
  }

  async updateFilamentType(id: string, dto: { name?: string; description?: string; category?: MaterialCategory; isActive?: boolean; sortOrder?: number }) {
    try {
      return await this.prisma.filamentType.update({ where: { id }, data: dto });
    } catch { throw new NotFoundException('Tipo de filamento não encontrado'); }
  }

  async deleteFilamentType(id: string) {
    const inUse = await this.prisma.material.count({ where: { filamentTypeId: id } });
    if (inUse) throw new ConflictException(`Tipo em uso em ${inUse} material(is). Remova o vínculo antes.`);
    return this.prisma.filamentType.update({ where: { id }, data: { isActive: false } });
  }

  // ── Colors ────────────────────────────────────────────────────
  getColors() {
    return this.prisma.color.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createColor(dto: { name: string; hexCode?: string; isRainbow?: boolean }) {
    try {
      return await this.prisma.color.create({ data: dto });
    } catch { throw new ConflictException(`Cor "${dto.name}" já existe`); }
  }

  async updateColor(id: string, dto: { name?: string; hexCode?: string; isRainbow?: boolean; isActive?: boolean }) {
    try {
      return await this.prisma.color.update({ where: { id }, data: dto });
    } catch { throw new NotFoundException('Cor não encontrada'); }
  }

  async deleteColor(id: string) {
    const inUse = await this.prisma.materialStock.count({
      where: { OR: [{ color1Id: id }, { color2Id: id }, { color3Id: id }] },
    });
    if (inUse) throw new ConflictException(`Cor em uso em ${inUse} carretel(is)/pote(s).`);
    return this.prisma.color.update({ where: { id }, data: { isActive: false } });
  }

  // ── Brands ────────────────────────────────────────────────────
  getBrands() {
    return this.prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createBrand(dto: { name: string; website?: string }) {
    try {
      return await this.prisma.brand.create({ data: dto });
    } catch { throw new ConflictException(`Marca "${dto.name}" já existe`); }
  }

  async updateBrand(id: string, dto: { name?: string; website?: string; isActive?: boolean }) {
    try {
      return await this.prisma.brand.update({ where: { id }, data: dto });
    } catch { throw new NotFoundException('Marca não encontrada'); }
  }

  async deleteBrand(id: string) {
    const matCount = await this.prisma.material.count({ where: { brandId: id } });
    const eqCount  = await this.prisma.equipment.count({ where: { brandId: id } });
    const total = matCount + eqCount;
    if (total) throw new ConflictException(`Marca em uso em ${total} registro(s).`);
    return this.prisma.brand.update({ where: { id }, data: { isActive: false } });
  }

  // ── AccessoryCategories ───────────────────────────────────────
  getAccessoryCategories() {
    return this.prisma.accessoryCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createAccessoryCategory(dto: { name: string }) {
    try {
      return await this.prisma.accessoryCategory.create({ data: dto });
    } catch { throw new ConflictException(`Categoria "${dto.name}" já existe`); }
  }

  async updateAccessoryCategory(id: string, dto: { name?: string; isActive?: boolean }) {
    try {
      return await this.prisma.accessoryCategory.update({ where: { id }, data: dto });
    } catch { throw new NotFoundException('Categoria não encontrada'); }
  }

  async deleteAccessoryCategory(id: string) {
    const inUse = await this.prisma.accessory.count({ where: { categoryId: id } });
    if (inUse) throw new ConflictException(`Categoria em uso em ${inUse} acessório(s).`);
    return this.prisma.accessoryCategory.update({ where: { id }, data: { isActive: false } });
  }

  // ── Units ─────────────────────────────────────────────────────
  getUnits() {
    return this.prisma.unit.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createUnit(dto: { name: string; symbol: string }) {
    try {
      return await this.prisma.unit.create({ data: dto });
    } catch { throw new ConflictException(`Unidade "${dto.name}" ou símbolo "${dto.symbol}" já existe`); }
  }

  async updateUnit(id: string, dto: { name?: string; symbol?: string; isActive?: boolean }) {
    try {
      return await this.prisma.unit.update({ where: { id }, data: dto });
    } catch { throw new NotFoundException('Unidade não encontrada'); }
  }

  async deleteUnit(id: string) {
    const inUse = await this.prisma.accessory.count({ where: { unitId: id } });
    if (inUse) throw new ConflictException(`Unidade em uso em ${inUse} acessório(s).`);
    return this.prisma.unit.update({ where: { id }, data: { isActive: false } });
  }
}
