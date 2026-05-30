import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log('Conectando ao banco de dados...');
    try {
      await this.$connect();
      this.logger.log('Banco de dados conectado com sucesso');
    } catch (err) {
      this.logger.error('Falha ao conectar ao banco de dados', err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Desconectando do banco de dados...');
    await this.$disconnect();
  }
}
