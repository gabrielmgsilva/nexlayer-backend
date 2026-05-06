import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../shared/utils/encryption';

@Injectable()
export class IntegrationsService {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.get<string>('ENCRYPTION_KEY');
  }

  async upsert(provider: string, key: string, value: string, expiresAt?: Date) {
    const encrypted = encrypt(value, this.encryptionKey);
    return this.prisma.integrationConfig.upsert({
      where: { provider_key: { provider, key } },
      update: { value: encrypted, expiresAt },
      create: { provider, key, value: encrypted, expiresAt },
    });
  }

  async get(provider: string, key: string): Promise<string | null> {
    const record = await this.prisma.integrationConfig.findUnique({
      where: { provider_key: { provider, key } },
    });
    if (!record) return null;
    return decrypt(record.value, this.encryptionKey);
  }

  async getWithExpiry(provider: string, key: string): Promise<{ value: string; expiresAt: Date | null } | null> {
    const record = await this.prisma.integrationConfig.findUnique({
      where: { provider_key: { provider, key } },
    });
    if (!record) return null;
    return {
      value: decrypt(record.value, this.encryptionKey),
      expiresAt: record.expiresAt,
    };
  }

  async getAllByProvider(provider: string) {
    const records = await this.prisma.integrationConfig.findMany({
      where: { provider },
      select: { key: true, expiresAt: true, updatedAt: true },
    });
    return records;
  }

  async delete(provider: string, key: string) {
    return this.prisma.integrationConfig.deleteMany({
      where: { provider, key },
    });
  }

  async deleteProvider(provider: string) {
    return this.prisma.integrationConfig.deleteMany({
      where: { provider },
    });
  }
}
