import { PaginatedResult } from '../dto/pagination.dto';

/**
 * Monta o resultado paginado a partir dos dados e metadados do Prisma.
 */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Retorna os parâmetros `skip` e `take` para o Prisma.
 */
export function getPrismaPage(page = 1, limit = 20) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
