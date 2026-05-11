import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; isActive?: boolean } = {}) {
    const page = Number.isFinite(params.page) ? params.page! : 1;
    const limit = Number.isFinite(params.limit) ? params.limit! : 50;
    const { isActive } = params;
    const skip = (page - 1) * limit;

    const where = isActive !== undefined ? { isActive } : {};
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SELECT });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) {
      if (dto.password.length < 8) throw new BadRequestException('Senha deve ter ao menos 8 caracteres');
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.user.update({ where: { id }, data, select: SELECT });
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) throw new BadRequestException('Não é possível excluir o próprio usuário');
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: SELECT });
  }
}
