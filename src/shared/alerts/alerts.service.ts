import { Injectable } from '@nestjs/common';
import { NotificationSeverity, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';

export interface StockAlert {
  type: 'MATERIAL_LOW' | 'ACCESSORY_LOW' | 'PRODUCT_LOW';
  entityId: string;
  entityName: string;
  current: number;
  minimum: number;
  unit: string;
  message: string;
}

export interface MaintenanceAlert {
  type: 'LIFESPAN_WARNING' | 'LIFESPAN_CRITICAL' | 'MAINTENANCE_DUE' | 'MAINTENANCE_OVERDUE';
  equipmentId: string;
  equipmentName: string;
  message: string;
  totalPrintHours: number;
  estimatedLifespanHours: number;
  percentUsed: number;
  nextDueAt?: Date | null;
}

const LIFESPAN_WARNING_THRESHOLD = 0.8;   // 80% da vida útil usada
const LIFESPAN_CRITICAL_THRESHOLD = 0.95; // 95% da vida útil usada
const MAINTENANCE_DUE_DAYS = 7;           // Manutenção vence em até 7 dias
const MATERIAL_LOW_THRESHOLD = 0.15;      // Alerta abaixo de 15% do peso inicial

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Regra 8 — Verifica alerta de estoque de material após transação de consumo.
   * Retorna alerta se o carretel estiver abaixo de MATERIAL_LOW_THRESHOLD do peso inicial.
   */
  async checkMaterialStockAlert(stockId: string): Promise<StockAlert | null> {
    const stock = await this.prisma.materialStock.findUnique({
      where: { id: stockId },
      include: { material: { include: { brand: { select: { name: true } }, filamentType: { select: { name: true } } } } },
    });

    if (!stock || stock.status === 'EMPTY') return null;

    const percentRemaining = stock.currentWeightG / stock.initialWeightG;
    if (percentRemaining > MATERIAL_LOW_THRESHOLD) return null;

    const matLabel = [stock.material.brand?.name, stock.material.filamentType?.name].filter(Boolean).join(' ') || stock.material.materialType;

    const alert: StockAlert = {
      type: 'MATERIAL_LOW',
      entityId: stockId,
      entityName: `${matLabel} — carretel ${stock.spoolLabel ?? stock.id.slice(0, 8)}`,
      current: stock.currentWeightG,
      minimum: Math.round(stock.initialWeightG * MATERIAL_LOW_THRESHOLD),
      unit: 'g',
      message: `Carretel com apenas ${stock.currentWeightG}g restantes (${Math.round(percentRemaining * 100)}% do peso inicial de ${stock.initialWeightG}g)`,
    };

    await this.notifications.create({
      type: NotificationType.MATERIAL_LOW,
      severity: NotificationSeverity.WARNING,
      title: `Material baixo: ${matLabel}`,
      message: alert.message,
      entityId: stockId,
      entityType: 'MaterialStock',
      entityName: alert.entityName,
    });

    return alert;
  }

  /**
   * Regra 8 — Verifica alerta de estoque de acessório após transação de consumo.
   * Usa o campo minStockAlert do próprio acessório.
   */
  async checkAccessoryStockAlert(accessoryId: string): Promise<StockAlert | null> {
    const acc = await this.prisma.accessory.findUnique({
      where: { id: accessoryId },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        minStockAlert: true,
        unit: { select: { symbol: true } },
      },
    });

    if (!acc || !acc.minStockAlert) return null;

    const current = Number(acc.stockQuantity);
    const minimum = Number(acc.minStockAlert);
    const unitSymbol = (acc.unit as { symbol: string } | null)?.symbol ?? '';

    if (current > minimum) return null;

    const alert: StockAlert = {
      type: 'ACCESSORY_LOW',
      entityId: accessoryId,
      entityName: acc.name,
      current,
      minimum,
      unit: unitSymbol,
      message: `Estoque de "${acc.name}" em ${current} ${unitSymbol} — mínimo configurado: ${minimum} ${unitSymbol}`,
    };

    await this.notifications.create({
      type: NotificationType.ACCESSORY_LOW,
      severity: NotificationSeverity.WARNING,
      title: `Estoque baixo: ${acc.name}`,
      message: alert.message,
      entityId: accessoryId,
      entityType: 'Accessory',
      entityName: acc.name,
    });

    return alert;
  }

  /**
   * Verifica alerta de estoque de produto acabado.
   * Dispara quando stockQuantity <= minStockAlert.
   */
  async checkProductStockAlert(productId: string): Promise<StockAlert | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stockQuantity: true, minStockAlert: true },
    });
    if (!product || product.minStockAlert === null) return null;

    const current = product.stockQuantity;
    const minimum = product.minStockAlert;
    if (current > minimum) return null;

    const alert: StockAlert = {
      type: 'PRODUCT_LOW',
      entityId: productId,
      entityName: product.name,
      current,
      minimum,
      unit: 'un',
      message: `Estoque de "${product.name}" em ${current} un — mínimo configurado: ${minimum} un`,
    };

    await this.notifications.create({
      type: NotificationType.PRODUCT_LOW,
      severity: NotificationSeverity.WARNING,
      title: `Estoque baixo: ${product.name}`,
      message: alert.message,
      entityId: productId,
      entityType: 'Product',
      entityName: product.name,
    });

    return alert;
  }

  /**
   * Verifica alerta de estoque de variação de produto.
   */
  async checkVariationStockAlert(variationId: string): Promise<StockAlert | null> {
    const variation = await this.prisma.productVariation.findUnique({
      where: { id: variationId },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        minStockAlert: true,
        product: { select: { name: true } },
      },
    });
    if (!variation || variation.minStockAlert === null) return null;

    const current = variation.stockQuantity;
    const minimum = variation.minStockAlert;
    if (current > minimum) return null;

    const entityName = `${variation.product.name} — ${variation.name}`;
    const alert: StockAlert = {
      type: 'PRODUCT_LOW',
      entityId: variationId,
      entityName,
      current,
      minimum,
      unit: 'un',
      message: `Estoque de "${entityName}" em ${current} un — mínimo: ${minimum} un`,
    };

    await this.notifications.create({
      type: NotificationType.PRODUCT_LOW,
      severity: NotificationSeverity.WARNING,
      title: `Estoque baixo: ${entityName}`,
      message: alert.message,
      entityId: variationId,
      entityType: 'ProductVariation',
      entityName,
    });

    return alert;
  }

  /**
   * Regra 9 — Verifica alertas de manutenção e vida útil do equipamento
   * após incremento de horas de uso.
   */
  async checkEquipmentMaintenanceAlert(
    equipmentId: string,
  ): Promise<MaintenanceAlert[]> {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: {
        id: true,
        name: true,
        totalPrintHours: true,
        estimatedLifespanHours: true,
        maintenanceLogs: {
          orderBy: { nextDueAt: 'asc' },
          where: { nextDueAt: { not: null } },
          take: 1,
          select: { nextDueAt: true, description: true },
        },
      },
    });

    if (!equipment) return [];

    const alerts: MaintenanceAlert[] = [];
    const totalHours = Number(equipment.totalPrintHours);
    const lifespanHours = equipment.estimatedLifespanHours;
    const percentUsed = totalHours / lifespanHours;

    const base = {
      equipmentId,
      equipmentName: equipment.name,
      totalPrintHours: totalHours,
      estimatedLifespanHours: lifespanHours,
      percentUsed: Math.round(percentUsed * 100),
    };

    // Alerta de vida útil
    if (percentUsed >= LIFESPAN_CRITICAL_THRESHOLD) {
      const msg = `${equipment.name} atingiu ${base.percentUsed}% da vida útil estimada (${totalHours.toFixed(1)}h / ${lifespanHours}h). Considere substituição.`;
      alerts.push({ ...base, type: 'LIFESPAN_CRITICAL', message: msg });
      await this.notifications.create({
        type: NotificationType.LIFESPAN_CRITICAL,
        severity: NotificationSeverity.CRITICAL,
        title: `Vida útil crítica: ${equipment.name}`,
        message: msg,
        entityId: equipmentId,
        entityType: 'Equipment',
        entityName: equipment.name,
      });
    } else if (percentUsed >= LIFESPAN_WARNING_THRESHOLD) {
      const msg = `${equipment.name} atingiu ${base.percentUsed}% da vida útil estimada (${totalHours.toFixed(1)}h / ${lifespanHours}h).`;
      alerts.push({ ...base, type: 'LIFESPAN_WARNING', message: msg });
      await this.notifications.create({
        type: NotificationType.LIFESPAN_WARNING,
        severity: NotificationSeverity.WARNING,
        title: `Vida útil: ${equipment.name}`,
        message: msg,
        entityId: equipmentId,
        entityType: 'Equipment',
        entityName: equipment.name,
      });
    }

    // Alerta de manutenção agendada
    const nextMaintenance = equipment.maintenanceLogs[0];
    if (nextMaintenance?.nextDueAt) {
      const now = new Date();
      const dueAt = new Date(nextMaintenance.nextDueAt);
      const daysUntilDue = Math.ceil(
        (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilDue < 0) {
        const msg = `Manutenção de "${nextMaintenance.description}" estava prevista para ${dueAt.toLocaleDateString('pt-BR')} e está atrasada ${Math.abs(daysUntilDue)} dias.`;
        alerts.push({ ...base, type: 'MAINTENANCE_OVERDUE', nextDueAt: dueAt, message: msg });
        await this.notifications.create({
          type: NotificationType.MAINTENANCE_OVERDUE,
          severity: NotificationSeverity.CRITICAL,
          title: `Manutenção atrasada: ${equipment.name}`,
          message: msg,
          entityId: equipmentId,
          entityType: 'Equipment',
          entityName: equipment.name,
        });
      } else if (daysUntilDue <= MAINTENANCE_DUE_DAYS) {
        const msg = `Manutenção de "${nextMaintenance.description}" prevista em ${daysUntilDue} dias (${dueAt.toLocaleDateString('pt-BR')}).`;
        alerts.push({ ...base, type: 'MAINTENANCE_DUE', nextDueAt: dueAt, message: msg });
        await this.notifications.create({
          type: NotificationType.MAINTENANCE_DUE,
          severity: NotificationSeverity.WARNING,
          title: `Manutenção em breve: ${equipment.name}`,
          message: msg,
          entityId: equipmentId,
          entityType: 'Equipment',
          entityName: equipment.name,
        });
      }
    }

    return alerts;
  }

  /**
   * Retorna todos os alertas ativos do sistema (para dashboard).
   */
  async getActiveAlerts(): Promise<{
    stockAlerts: StockAlert[];
    maintenanceAlerts: MaintenanceAlert[];
  }> {
    const [accessories, materialStocks, equipments, products, variations] = await Promise.all([
      this.prisma.accessory.findMany({
        where: { deletedAt: null, minStockAlert: { not: null } },
        select: { id: true, name: true, stockQuantity: true, minStockAlert: true, unit: { select: { symbol: true } } },
      }),
      this.prisma.materialStock.findMany({
        where: { status: { in: ['IN_USE', 'SEALED'] } },
        include: { material: { include: { brand: { select: { name: true } }, filamentType: { select: { name: true } } } } },
      }),
      this.prisma.equipment.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          totalPrintHours: true,
          estimatedLifespanHours: true,
          maintenanceLogs: {
            orderBy: { nextDueAt: 'asc' },
            where: { nextDueAt: { not: null } },
            take: 1,
            select: { nextDueAt: true, description: true },
          },
        },
      }),
      this.prisma.product.findMany({
        where: { deletedAt: null, isActive: true, minStockAlert: { not: null } },
        select: { id: true, name: true, stockQuantity: true, minStockAlert: true },
      }),
      this.prisma.productVariation.findMany({
        where: { isActive: true, minStockAlert: { not: null } },
        select: {
          id: true,
          name: true,
          stockQuantity: true,
          minStockAlert: true,
          product: { select: { name: true } },
        },
      }),
    ]);

    const stockAlerts: StockAlert[] = [];

    for (const acc of accessories) {
      if (!acc.minStockAlert) continue;
      const current = Number(acc.stockQuantity);
      const minimum = Number(acc.minStockAlert);
      const unitSymbol = (acc.unit as { symbol: string } | null)?.symbol ?? '';
      if (current <= minimum) {
        stockAlerts.push({
          type: 'ACCESSORY_LOW',
          entityId: acc.id,
          entityName: acc.name,
          current,
          minimum,
          unit: unitSymbol,
          message: `Estoque de "${acc.name}" em ${current} ${unitSymbol} — mínimo: ${minimum} ${unitSymbol}`,
        });
      }
    }

    for (const stock of materialStocks) {
      const percent = stock.currentWeightG / stock.initialWeightG;
      if (percent <= MATERIAL_LOW_THRESHOLD) {
        const label = [stock.material.brand?.name, stock.material.filamentType?.name].filter(Boolean).join(' ') || stock.material.materialType;
        stockAlerts.push({
          type: 'MATERIAL_LOW',
          entityId: stock.id,
          entityName: `${label} — ${stock.spoolLabel ?? stock.id.slice(0, 8)}`,
          current: stock.currentWeightG,
          minimum: Math.round(stock.initialWeightG * MATERIAL_LOW_THRESHOLD),
          unit: 'g',
          message: `Carretel com ${stock.currentWeightG}g restantes (${Math.round(percent * 100)}% do inicial)`,
        });
      }
    }

    // Product stock alerts
    for (const p of products) {
      if (p.minStockAlert === null) continue;
      if (p.stockQuantity <= p.minStockAlert) {
        stockAlerts.push({
          type: 'PRODUCT_LOW',
          entityId: p.id,
          entityName: p.name,
          current: p.stockQuantity,
          minimum: p.minStockAlert,
          unit: 'un',
          message: `Estoque de "${p.name}" em ${p.stockQuantity} un — mínimo: ${p.minStockAlert} un`,
        });
      }
    }

    // Variation stock alerts
    for (const v of variations) {
      if (v.minStockAlert === null) continue;
      if (v.stockQuantity <= v.minStockAlert) {
        const entityName = `${v.product.name} — ${v.name}`;
        stockAlerts.push({
          type: 'PRODUCT_LOW',
          entityId: v.id,
          entityName,
          current: v.stockQuantity,
          minimum: v.minStockAlert,
          unit: 'un',
          message: `Estoque de "${entityName}" em ${v.stockQuantity} un — mínimo: ${v.minStockAlert} un`,
        });
      }
    }

    const maintenanceAlerts: MaintenanceAlert[] = [];
    for (const eq of equipments) {
      const alerts = await this.checkEquipmentMaintenanceAlert(eq.id);
      maintenanceAlerts.push(...alerts);
    }

    return { stockAlerts, maintenanceAlerts };
  }
}
