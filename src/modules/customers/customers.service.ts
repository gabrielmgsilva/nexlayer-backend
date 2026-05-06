import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto, CustomerTypeDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { paginate, getPrismaPage } from '../../shared/utils/paginate';

@Injectable()
export class CustomersService {
  private readonly invoiceFieldKeys: Array<keyof UpdateCustomerDto> = [
    'type',
    'cpf',
    'cnpj',
    'razaoSocial',
    'street',
    'addressNumber',
    'neighborhood',
    'city',
    'state',
    'zipCode',
    'inscricaoEstadual',
    'inscricaoMunicipal',
  ];

  constructor(private prisma: PrismaService) {}

  private assertInvoiceData(payload: Partial<CreateCustomerDto>) {
    const requiredAddressFields: Array<keyof CreateCustomerDto> = [
      'street',
      'addressNumber',
      'neighborhood',
      'city',
      'state',
      'zipCode',
    ];

    for (const field of requiredAddressFields) {
      if (!payload[field]) {
        throw new BadRequestException(`Campo obrigatório para emissão: ${field}`);
      }
    }

    if (payload.type === CustomerTypeDto.PF) {
      if (!payload.cpf) {
        throw new BadRequestException('CPF é obrigatório para cliente PF');
      }
      if (payload.cnpj) {
        throw new BadRequestException('Cliente PF não pode ter CNPJ');
      }
    }

    if (payload.type === CustomerTypeDto.PJ) {
      if (!payload.cnpj) {
        throw new BadRequestException('CNPJ é obrigatório para cliente PJ');
      }
      if (!payload.razaoSocial) {
        throw new BadRequestException('Razão social é obrigatória para cliente PJ');
      }
      if (payload.cpf) {
        throw new BadRequestException('Cliente PJ não pode ter CPF');
      }
    }
  }

  private sanitizeByType<T extends Partial<CreateCustomerDto>>(payload: T): T {
    if (payload.type === CustomerTypeDto.PF) {
      return {
        ...payload,
        cnpj: undefined,
        razaoSocial: undefined,
        inscricaoEstadual: undefined,
        inscricaoMunicipal: undefined,
      } as T;
    }

    if (payload.type === CustomerTypeDto.PJ) {
      return {
        ...payload,
        cpf: undefined,
      } as T;
    }

    return payload;
  }

  private touchesInvoiceFields(payload: UpdateCustomerDto) {
    return this.invoiceFieldKeys.some((field) => field in payload);
  }

  async findAll(pagination: PaginationDto, isActive?: boolean) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      deletedAt: null as null,
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return customer;
  }

  create(dto: CreateCustomerDto) {
    this.assertInvoiceData(dto);
    return this.prisma.customer.create({ data: this.sanitizeByType(dto) });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const current = await this.findOne(id);
    if (this.touchesInvoiceFields(dto)) {
      const mergedInvoiceData: Partial<CreateCustomerDto> = {
        type: (dto.type ?? current.type) as CustomerTypeDto,
        cpf: dto.cpf ?? current.cpf ?? undefined,
        cnpj: dto.cnpj ?? current.cnpj ?? undefined,
        razaoSocial: dto.razaoSocial ?? current.razaoSocial ?? undefined,
        street: dto.street ?? current.street ?? undefined,
        addressNumber: dto.addressNumber ?? current.addressNumber ?? undefined,
        neighborhood: dto.neighborhood ?? current.neighborhood ?? undefined,
        city: dto.city ?? current.city ?? undefined,
        state: dto.state ?? current.state ?? undefined,
        zipCode: dto.zipCode ?? current.zipCode ?? undefined,
        inscricaoEstadual: dto.inscricaoEstadual ?? current.inscricaoEstadual ?? undefined,
        inscricaoMunicipal: dto.inscricaoMunicipal ?? current.inscricaoMunicipal ?? undefined,
      };
      this.assertInvoiceData(mergedInvoiceData);
    }
    return this.prisma.customer.update({ where: { id }, data: this.sanitizeByType(dto) });
  }

  async remove(id: string) {
    await this.findOne(id);
    const activeJobs = await this.prisma.productionJob.count({
      where: { customerId: id, status: { notIn: ['DELIVERED', 'CANCELLED', 'QC_REJECTED'] } },
    });
    if (activeJobs > 0) {
      throw new BadRequestException(
        `Cliente possui ${activeJobs} job(s) ativo(s). Finalize-os antes de remover.`,
      );
    }
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getJobs(customerId: string, pagination: PaginationDto) {
    await this.findOne(customerId);
    const { page = 1, limit = 20 } = pagination;
    const where = { customerId };
    const [data, total] = await Promise.all([
      this.prisma.productionJob.findMany({
        where,
        include: {
          product: { select: { id: true, name: true } },
          equipment: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.productionJob.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }
}
