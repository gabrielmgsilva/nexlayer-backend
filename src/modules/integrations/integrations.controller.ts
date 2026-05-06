import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get(':provider/status')
  async getProviderStatus(@Param('provider') provider: string) {
    const configs = await this.integrationsService.getAllByProvider(provider);
    const isConnected = configs.length > 0;
    return { provider, isConnected, keys: configs };
  }

  @Delete(':provider')
  async disconnectProvider(@Param('provider') provider: string) {
    await this.integrationsService.deleteProvider(provider);
    return { message: `Provider ${provider} disconnected` };
  }
}
