import { Controller, Get, Patch, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista notificações (últimos 15 dias)' })
  findAll() {
    return this.service.findAll().then((data) => ({ data }));
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Retorna contagem de não lidas' })
  async unreadCount() {
    const count = await this.service.countUnread();
    return { data: { count } };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca uma notificação como lida' })
  markRead(@Param('id') id: string) {
    return this.service.markRead(id).then((data) => ({ data }));
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca todas as notificações como lidas' })
  markAllRead() {
    return this.service.markAllRead().then((data) => ({ data }));
  }
}
