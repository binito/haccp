import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getStats(user: { role: Role; clientId?: string }) {
    const clientId = user.role !== Role.SUPER_ADMIN ? user.clientId : undefined;
    const cacheKey = `dashboard:stats:${clientId ?? 'all'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalClients,
      totalAreas,
      openAnomalies,
      openShortageReports,
      checklistsThisMonth,
    ] = await Promise.all([
      clientId
        ? this.prisma.client.count({ where: { id: clientId, active: true } })
        : this.prisma.client.count({ where: { active: true } }),
      this.prisma.area.count({
        where: { active: true, ...(clientId ? { clientId } : {}) },
      }),
      this.prisma.anomalyReport.count({
        where: { status: 'OPEN', ...(clientId ? { area: { clientId } } : {}) },
      }),
      this.prisma.consumableReport.count({
        where: { status: 'OPEN', ...(clientId ? { stock: { clientId } } : {}) },
      }),
      this.prisma.checklistEntry.count({
        where: {
          completedAt: { gte: startOfMonth },
          ...(clientId ? { area: { clientId } } : {}),
        },
      }),
    ]);

    const result = {
      totalClients,
      totalAreas,
      openAnomalies,
      openShortageReports,
      checklistsThisMonth,
    };
    await this.cache.set(cacheKey, result, 30000);
    return result;
  }
}
