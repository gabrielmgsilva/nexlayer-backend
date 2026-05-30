import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    this.logger.log(`validate: verificando token para sub=${payload.sub} email=${payload.email}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });

      if (!user) {
        this.logger.warn(`validate: usuário não encontrado para sub=${payload.sub}`);
        throw new UnauthorizedException();
      }

      if (!user.isActive) {
        this.logger.warn(`validate: usuário inativo para sub=${payload.sub}`);
        throw new UnauthorizedException();
      }

      return user;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`validate: erro ao validar token para sub=${payload.sub}`, err instanceof Error ? err.stack : String(err));
      throw new UnauthorizedException();
    }
  }
}
