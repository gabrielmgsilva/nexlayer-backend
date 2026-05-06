import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const REVENUE_STATUSES: SaleStatus[] = [
  SaleStatus.CONFIRMED,
  SaleStatus.SHIPPED,
  SaleStatus.DELIVERED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = startDate;

    const [
      salesAgg,
      prevSalesCount,
      salesByStatus,
      dailyRevenue,
      topProducts,
      jobStats,
      prevJobStats,
      attemptStats,
      prevAttemptStats,
      lowStockProducts,
      lowStockMaterials,
      lowStockAccessories,
      lateJobs,
      recentSales,
      inventoryProducts,
      inventoryMaterials,
      productionResults,
    ] = await Promise.all([
      // Sales aggregation for current period
      this.getSalesAggregation(startDate, endDate),
      // Previous period sales count
      this.prisma.saleOrder.count({
        where: { createdAt: { gte: prevStart, lt: prevEnd }, status: { in: REVENUE_STATUSES } },
      }),
      // Sales by status
      this.prisma.saleOrder.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate, lt: endDate } },
        _count: true,
      }),
      // Daily revenue
      this.getDailyRevenue(startDate, endDate),
      // Top products
      this.getTopProducts(startDate, endDate),
      // Job stats current
      this.getJobStats(startDate, endDate),
      // Job stats previous
      this.getJobStats(prevStart, prevEnd),
      // Print attempt stats current
      this.getAttemptStats(startDate, endDate),
      // Print attempt stats previous
      this.getAttemptStats(prevStart, prevEnd),
      // Low stock products
      this.getLowStockProducts(),
      // Low stock materials
      this.getLowStockMaterials(),
      // Low stock accessories
      this.getLowStockAccessories(),
      // Late jobs
      this.getLateJobs(),
      // Recent sales
      this.getRecentSales(),
      // Inventory value - products
      this.getInventoryProducts(),
      // Inventory value - materials
      this.getInventoryMaterials(),
      // Production results (weekly)
      this.getProductionResults(startDate, endDate),
    ]);

    const revenue = Number(salesAgg.revenue);
    const cost = Number(salesAgg.cost);
    const shipping = Number(salesAgg.shipping);
    const discount = Number(salesAgg.discount);
    const netRevenue = revenue - discount;
    const profit = netRevenue - cost;
    const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

    const totalAttempts = attemptStats.success + attemptStats.failed + attemptStats.partial;
    const failureRate = totalAttempts > 0 ? (attemptStats.failed / totalAttempts) * 100 : 0;
    const prevTotalAttempts = prevAttemptStats.success + prevAttemptStats.failed + prevAttemptStats.partial;
    const prevFailureRate = prevTotalAttempts > 0 ? (prevAttemptStats.failed / prevTotalAttempts) * 100 : 0;

    const inventoryProductValue = inventoryProducts.reduce(
      (sum, p) => sum + p.stockQuantity * Number(p.sellingPrice ?? 0), 0,
    );
    const inventoryMaterialValue = inventoryMaterials.reduce(
      (sum, m) => sum + (Number(m.currentWeightG) / 1000) * Number(m.costPerKg), 0,
    );

    return {
      revenue: netRevenue,
      profit,
      profitMargin,
      totalDiscount: discount,
      totalShipping: shipping,
      totalCost: cost,
      salesCount: salesAgg.count,
      salesPrevCount: prevSalesCount,
      inventoryValue: inventoryProductValue + inventoryMaterialValue,
      inventoryProductValue,
      inventoryMaterialValue,
      jobsDelivered: jobStats.delivered,
      jobsTotal: jobStats.total,
      jobsPrevDelivered: prevJobStats.delivered,
      failureRate,
      failureRatePrev: prevFailureRate,
      ticketAvg: salesAgg.count > 0 ? netRevenue / salesAgg.count : 0,

      dailyRevenue,
      salesByStatus: salesByStatus.map((s) => ({ status: s.status, count: s._count })),
      productionResults,
      topProducts,

      lowStock: [
        ...lowStockProducts.map((p) => ({
          id: p.id, name: p.name, type: 'PRODUCT' as const,
          current: p.stockQuantity, minimum: p.minStockAlert ?? 0,
        })),
        ...lowStockMaterials.map((m) => ({
          id: m.id, name: m.material.name, type: 'MATERIAL' as const,
          current: Number(m.currentWeightG), minimum: Number(m.material.spoolWeightG ?? 0) * 0.1,
        })),
        ...lowStockAccessories.map((a) => ({
          id: a.id, name: a.name, type: 'ACCESSORY' as const,
          current: Number(a.stockQuantity), minimum: Number(a.minStockAlert ?? 0),
        })),
      ],

      lateJobs,
      recentSales,
    };
  }

  private async getSalesAggregation(startDate: Date, endDate: Date) {
    const orders = await this.prisma.saleOrder.findMany({
      where: { createdAt: { gte: startDate, lt: endDate }, status: { in: REVENUE_STATUSES } },
      include: { items: true },
    });

    // Collect unique product IDs to look up latest cost snapshot
    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];

    // Get latest CostSnapshot unitCostWithError for each product
    const costMap = new Map<string, number>();
    for (const productId of productIds) {
      const snap = await this.prisma.costSnapshot.findFirst({
        where: { productionJob: { productId } },
        orderBy: { generatedAt: 'desc' },
        select: { unitCostWithError: true },
      });
      if (snap) costMap.set(productId, Number(snap.unitCostWithError));
    }

    let revenue = 0;
    let cost = 0;
    let shipping = 0;
    let discount = 0;

    for (const order of orders) {
      shipping += Number(order.shippingCost);
      discount += Number(order.discount);
      for (const item of order.items) {
        revenue += Number(item.unitPrice) * item.quantity;
        const unitCost = costMap.get(item.productId) ?? Number(item.costPerUnit);
        cost += unitCost * item.quantity;
      }
    }

    return { revenue, cost, shipping, discount, count: orders.length };
  }

  private async getDailyRevenue(startDate: Date, endDate: Date) {
    const result: { date: string; value: number }[] = [];
    const orders = await this.prisma.saleOrder.findMany({
      where: { createdAt: { gte: startDate, lt: endDate }, status: { in: REVENUE_STATUSES } },
      include: { items: true },
    });

    const map = new Map<string, number>();
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const total = o.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
        + Number(o.shippingCost) - Number(o.discount);
      map.set(day, (map.get(day) ?? 0) + total);
    }

    const cursor = new Date(startDate);
    while (cursor < endDate) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({ date: key, value: map.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  private async getTopProducts(startDate: Date, endDate: Date) {
    const items = await this.prisma.saleItem.findMany({
      where: {
        saleOrder: { createdAt: { gte: startDate, lt: endDate }, status: { in: REVENUE_STATUSES } },
      },
      include: { product: { select: { name: true } } },
    });

    const map = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const name = item.product.name;
      const existing = map.get(item.productId) ?? { name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.unitPrice) * item.quantity;
      map.set(item.productId, existing);
    }

    return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }

  private async getJobStats(startDate: Date, endDate: Date) {
    const jobs = await this.prisma.productionJob.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      select: { status: true },
    });
    return {
      total: jobs.length,
      delivered: jobs.filter((j) => j.status === 'DELIVERED').length,
    };
  }

  private async getAttemptStats(startDate: Date, endDate: Date) {
    const attempts = await this.prisma.printAttempt.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      select: { status: true },
    });
    return {
      success: attempts.filter((a) => a.status === 'SUCCESS').length,
      failed: attempts.filter((a) => a.status === 'FAILED').length,
      partial: attempts.filter((a) => a.status === 'PARTIAL').length,
    };
  }

  private async getProductionResults(startDate: Date, endDate: Date) {
    const attempts = await this.prisma.printAttempt.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      select: { status: true, createdAt: true },
    });

    // Group by ISO week
    const map = new Map<string, { week: string; success: number; failed: number; partial: number }>();
    for (const a of attempts) {
      const d = a.createdAt;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const entry = map.get(key) ?? { week: key, success: 0, failed: 0, partial: 0 };
      if (a.status === 'SUCCESS') entry.success++;
      else if (a.status === 'FAILED') entry.failed++;
      else entry.partial++;
      map.set(key, entry);
    }

    return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
  }

  private getLowStockProducts() {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; stockQuantity: number; minStockAlert: number }>>`
      SELECT id, name, stock_quantity as "stockQuantity", min_stock_alert as "minStockAlert"
      FROM products
      WHERE deleted_at IS NULL AND is_active = true
        AND min_stock_alert IS NOT NULL
        AND stock_quantity <= min_stock_alert
      LIMIT 20
    `;
  }

  private getLowStockMaterials() {
    return this.prisma.materialStock.findMany({
      where: { status: { in: ['IN_USE', 'SEALED'] }, material: { deletedAt: null, spoolWeightG: { not: null } } },
      include: { material: { include: { brand: { select: { name: true } }, filamentType: { select: { name: true } } } } },
      take: 40,
    }).then(stocks =>
      stocks
        .filter(s => s.currentWeightG <= (s.material.spoolWeightG ?? 0) * 0.1)
        .slice(0, 20)
        .map(s => ({
          id: s.id,
          currentWeightG: s.currentWeightG,
          material: {
            name: [s.material.brand?.name, s.material.filamentType?.name].filter(Boolean).join(' ') || s.material.materialType,
            spoolWeightG: s.material.spoolWeightG ?? 0,
            costPerKg: Number(s.costPerKg),
          },
        }))
    );
  }

  private getLowStockAccessories() {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; stockQuantity: number; minStockAlert: number }>>`
      SELECT id, name, stock_quantity as "stockQuantity", min_stock_alert as "minStockAlert"
      FROM accessories
      WHERE deleted_at IS NULL
        AND min_stock_alert IS NOT NULL
        AND stock_quantity <= min_stock_alert
      LIMIT 20
    `;
  }

  private getLateJobs() {
    return this.prisma.productionJob.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['DELIVERED', 'CANCELLED', 'QC_REJECTED'] },
      },
      include: {
        product: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });
  }

  private getRecentSales() {
    return this.prisma.saleOrder.findMany({
      include: {
        channel: { select: { name: true } },
        customer: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  private getInventoryProducts() {
    return this.prisma.product.findMany({
      where: { deletedAt: null, isActive: true, stockQuantity: { gt: 0 } },
      select: { stockQuantity: true, sellingPrice: true },
    });
  }

  private getInventoryMaterials() {
    return this.prisma.$queryRaw<Array<{ currentWeightG: number; costPerKg: number }>>`
      SELECT ms.current_weight_g as "currentWeightG", ms.cost_per_kg as "costPerKg"
      FROM material_stocks ms
      JOIN materials m ON m.id = ms.material_id
      WHERE ms.status IN ('SEALED', 'IN_USE')
        AND m.deleted_at IS NULL
    `;
  }
}
