import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(user: { role: Role; clientId?: string }) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const clientId = user.role !== Role.SUPER_ADMIN ? user.clientId : undefined;

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

    return {
      totalClients,
      totalAreas,
      openAnomalies,
      openShortageReports,
      checklistsThisMonth,
    };
  }
}
