import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    this.logger.log(`register: tentativa para e-mail=${dto.email}`);
    try {
      const exists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) {
        this.logger.warn(`register: e-mail já cadastrado — ${dto.email}`);
        throw new ConflictException('E-mail já cadastrado');
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      this.logger.log(`register: usuário criado id=${user.id} email=${dto.email}`);

      const tokens = await this.generateTokens(user.id, user.email);
      return { user, ...tokens };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      this.logger.error(`register: erro inesperado para email=${dto.email}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erro ao registrar usuário');
    }
  }

  async login(dto: LoginDto) {
    this.logger.log(`login: tentativa para email=${dto.email}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (!user) {
        this.logger.warn(`login: usuário não encontrado — email=${dto.email}`);
        throw new UnauthorizedException('Credenciais inválidas');
      }

      if (!user.isActive) {
        this.logger.warn(`login: usuário inativo — email=${dto.email} id=${user.id}`);
        throw new UnauthorizedException('Credenciais inválidas');
      }

      const valid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!valid) {
        this.logger.warn(`login: senha incorreta — email=${dto.email} id=${user.id}`);
        throw new UnauthorizedException('Credenciais inválidas');
      }

      const tokens = await this.generateTokens(user.id, user.email);
      this.logger.log(`login: sucesso — email=${dto.email} id=${user.id} role=${user.role}`);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          onboardingCompletedAt: user.onboardingCompletedAt,
        },
        ...tokens,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`login: erro inesperado para email=${dto.email}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erro ao autenticar');
    }
  }

  async getSetupStatus(userId: string) {
    this.logger.log(`getSetupStatus: userId=${userId}`);
    try {
      const [user, equipmentCount, materialCount, productCount, costConfigCount, materialStockCount] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { onboardingCompletedAt: true } }),
        this.prisma.equipment.count({ where: { deletedAt: null } }),
        this.prisma.material.count({ where: { deletedAt: null } }),
        this.prisma.product.count({ where: { deletedAt: null } }),
        this.prisma.costConfig.count(),
        this.prisma.materialStock.count(),
      ]);

      return {
        hasEquipment: equipmentCount > 0,
        hasMaterial: materialCount > 0,
        hasMaterialStock: materialStockCount > 0,
        hasProduct: productCount > 0,
        hasCostConfig: costConfigCount > 0,
        onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
        completed: !!user?.onboardingCompletedAt,
      };
    } catch (err) {
      this.logger.error(`getSetupStatus: erro para userId=${userId}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  async completeOnboarding(userId: string) {
    this.logger.log(`completeOnboarding: userId=${userId}`);
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
        select: { id: true, name: true, email: true, role: true, onboardingCompletedAt: true },
      });
    } catch (err) {
      this.logger.error(`completeOnboarding: erro para userId=${userId}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  async refresh(refreshToken: string) {
    this.logger.log('refresh: tentativa de renovação de token');
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      this.logger.log(`refresh: token válido para sub=${payload.sub}`);
      const tokens = await this.generateTokens(payload.sub, payload.email);
      return tokens;
    } catch (err) {
      this.logger.warn(`refresh: token inválido ou expirado — ${err instanceof Error ? err.message : String(err)}`);
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  private async generateTokens(userId: string, email: string) {
    this.logger.log(`generateTokens: gerando par de tokens para userId=${userId}`);
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as `${number}${'s'|'m'|'h'|'d'}`,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as `${number}${'s'|'m'|'h'|'d'}`,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
