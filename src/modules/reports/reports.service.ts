import { Injectable } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface PnlInput extends DateRange {
  channelId?: string;
}

const REVENUE_STATUSES: SaleStatus[] = [
  SaleStatus.CONFIRMED,
  SaleStatus.SHIPPED,
  SaleStatus.DELIVERED,
];

function defaultRange(opts: DateRange) {
  const now = new Date();
  const from =
    opts.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const to = opts.to ?? now;
  return { from, to };
}

function n(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────
  // P&L agregado
  // ─────────────────────────────────────────
  async getPnl(input: PnlInput) {
    const { from, to } = defaultRange(input);

    const orders = await this.prisma.saleOrder.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: from, lte: to },
        ...(input.channelId ? { channelId: input.channelId } : {}),
      },
      include: {
        items: true,
        channel: true,
      },
    });

    return this.aggregate(orders, { from, to });
  }

  // ─────────────────────────────────────────
  // P&L por canal
  // ─────────────────────────────────────────
  async getPnlByChannel(input: DateRange) {
    const { from, to } = defaultRange(input);

    const channels = await this.prisma.salesChannel.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const orders = await this.prisma.saleOrder.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: from, lte: to },
      },
      include: { items: true, channel: true },
    });

    const byChannel = channels.map((ch) => {
      const channelOrders = orders.filter((o) => o.channelId === ch.id);
      const agg = this.aggregate(channelOrders, { from, to });
      return {
        channelId: ch.id,
        channelName: ch.name,
        ...agg,
      };
    });

    return {
      window: { from: from.toISOString(), to: to.toISOString() },
      channels: byChannel,
    };
  }

  // ─────────────────────────────────────────
  // Comissões por canal
  // ─────────────────────────────────────────
  async getCommissions(input: DateRange) {
    const result = await this.getPnlByChannel(input);
    return {
      window: result.window,
      total: result.channels.reduce(
        (s, c) => s + c.commissions + c.fixedFees + c.variableFees,
        0,
      ),
      channels: result.channels.map((c) => ({
        channelId: c.channelId,
        channelName: c.channelName,
        revenue: c.revenue,
        commissions: c.commissions,
        fixedFees: c.fixedFees,
        variableFees: c.variableFees,
        total: c.commissions + c.fixedFees + c.variableFees,
      })),
    };
  }

  // ─────────────────────────────────────────
  // Custo real vs snapshot (variance)
  // ─────────────────────────────────────────
  async getCostVariance(input: DateRange) {
    const { from, to } = defaultRange(input);

    const jobs = await this.prisma.productionJob.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: { gte: from, lte: to },
      },
      include: {
        product: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true } },
        costSnapshots: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { deliveredAt: 'desc' },
    });

    // For each job, real material cost = sum of CONSUMPTION transactions
    // referencing this job (negative quantityG × unit cost from stock)
    const rows = await Promise.all(
      jobs.map(async (job) => {
        const txs = await this.prisma.materialStockTransaction.findMany({
          where: {
            referenceId: job.id,
            referenceType: 'ProductionJob',
            type: 'CONSUMPTION',
          },
          include: { materialStock: { select: { costPerKg: true } } },
        });

        const realMaterialCost = txs.reduce((s, t) => {
          const grams = Math.abs(n(t.quantityG));
          const costPerKg = n(t.materialStock.costPerKg);
          return s + (grams / 1000) * costPerKg;
        }, 0);

        const snap = job.costSnapshots[0];
        const snapshotMaterialCost = snap
          ? n(snap.unitMaterialCost) * (job.totalPiecesProduced ?? job.quantityOrdered)
          : 0;
        const snapshotTotalCost = snap ? n(snap.batchTotalCost) : 0;

        // Approximate "real total cost" = batch cost - snapshot material + real material
        const realTotalCost =
          snapshotTotalCost - snapshotMaterialCost + realMaterialCost;

        const deltaAbs = realTotalCost - snapshotTotalCost;
        const deltaPct = snapshotTotalCost > 0
          ? (deltaAbs / snapshotTotalCost) * 100
          : 0;

        return {
          jobId: job.id,
          jobNumber: job.jobNumber,
          productName: job.product.name,
          equipmentName: job.equipment?.name ?? null,
          deliveredAt: job.deliveredAt?.toISOString() ?? null,
          quantity: job.totalPiecesProduced ?? job.quantityOrdered,
          snapshotMaterialCost,
          realMaterialCost,
          snapshotTotalCost,
          realTotalCost,
          deltaAbs,
          deltaPct,
        };
      }),
    );

    rows.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

    const totals = rows.reduce(
      (acc, r) => {
        acc.snapshotTotalCost += r.snapshotTotalCost;
        acc.realTotalCost += r.realTotalCost;
        return acc;
      },
      { snapshotTotalCost: 0, realTotalCost: 0 },
    );

    return {
      window: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        ...totals,
        deltaAbs: totals.realTotalCost - totals.snapshotTotalCost,
        deltaPct:
          totals.snapshotTotalCost > 0
            ? ((totals.realTotalCost - totals.snapshotTotalCost) /
                totals.snapshotTotalCost) *
              100
            : 0,
      },
      rows,
    };
  }

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────
  private aggregate(
    orders: Array<
      Prisma.SaleOrderGetPayload<{
        include: { items: true; channel: true };
      }>
    >,
    window: { from: Date; to: Date },
  ) {
    let revenue = 0;
    let cogs = 0;
    let shipping = 0;
    let discount = 0;
    let commissions = 0;
    let fixedFees = 0;
    let variableFees = 0;
    const dailyMap = new Map<string, { revenue: number; profit: number }>();

    for (const o of orders) {
      const itemsRevenue = o.items.reduce(
        (s, it) => s + n(it.unitPrice) * it.quantity,
        0,
      );
      const itemsCogs = o.items.reduce(
        (s, it) => s + n(it.costPerUnit) * it.quantity,
        0,
      );
      const orderRevenue = itemsRevenue;
      const orderShipping = n(o.shippingCost);
      const orderDiscount = n(o.discount);
      const grossNet = orderRevenue - orderDiscount;

      const ch = o.channel;
      const orderCommission = (grossNet * n(ch.commissionPercent)) / 100;
      const orderFixed = n(ch.feeFixed);
      const orderVariable = (grossNet * n(ch.feePercentVariable)) / 100;

      revenue += orderRevenue;
      cogs += itemsCogs;
      shipping += orderShipping;
      discount += orderDiscount;
      commissions += orderCommission;
      fixedFees += orderFixed;
      variableFees += orderVariable;

      const day = (o.confirmedAt ?? o.createdAt).toISOString().slice(0, 10);
      const cur = dailyMap.get(day) ?? { revenue: 0, profit: 0 };
      const profit =
        orderRevenue -
        orderDiscount -
        itemsCogs -
        orderShipping -
        orderCommission -
        orderFixed -
        orderVariable;
      cur.revenue += orderRevenue;
      cur.profit += profit;
      dailyMap.set(day, cur);
    }

    const netRevenue = revenue - discount;
    const totalFees = commissions + fixedFees + variableFees;
    const grossProfit = netRevenue - cogs - shipping - totalFees;
    const margin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const daily = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, ...v }));

    return {
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      ordersCount: orders.length,
      revenue,
      discount,
      netRevenue,
      cogs,
      shipping,
      commissions,
      fixedFees,
      variableFees,
      totalFees,
      grossProfit,
      margin,
      daily,
    };
  }
}
