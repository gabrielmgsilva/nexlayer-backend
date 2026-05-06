import { Injectable } from '@nestjs/common';
import { NotificationType, NotificationSeverity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const EXPIRY_DAYS = 15;

export interface CreateNotificationInput {
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  entityName?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a notification. Deduplicates: skips if an unread notification of the
   * same type + entityId already exists and was created within the last 24 hours.
   */
  async create(input: CreateNotificationInput) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

    if (input.entityId) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await this.prisma.notification.findFirst({
        where: {
          type: input.type,
          entityId: input.entityId,
          isRead: false,
          createdAt: { gte: cutoff },
        },
      });
      if (existing) return existing;
    }

    return this.prisma.notification.create({
      data: {
        type: input.type,
        severity: input.severity ?? NotificationSeverity.WARNING,
        title: input.title,
        message: input.message,
        entityId: input.entityId,
        entityType: input.entityType,
        entityName: input.entityName,
        expiresAt,
      },
    });
  }

  /**
   * Returns all non-expired notifications ordered by newest first.
   */
  findAll() {
    const now = new Date();
    return this.prisma.notification.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Count of unread non-expired notifications.
   */
  async countUnread(): Promise<number> {
    const now = new Date();
    return this.prisma.notification.count({
      where: { isRead: false, expiresAt: { gt: now } },
    });
  }

  /**
   * Mark a single notification as read.
   */
  markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all unread notifications as read.
   */
  markAllRead() {
    return this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Purge expired notifications (can be called by a cron or on startup).
   */
  purgeExpired() {
    return this.prisma.notification.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
