import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReportType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateShareDto } from './dto/create-share.dto';

@Injectable()
export class SharesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateShareDto, actor: AuthUser) {
    const clientId = dto.clientId ?? actor.clientId ?? '';
    const accessToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    return this.prisma.reportShare.create({
      data: {
        type: dto.type,
        label: dto.label,
        params: dto.params as any,
        clientId,
        createdById: actor.id,
        accessToken,
        expiresAt,
      },
      select: { id: true, accessToken: true, type: true, label: true, createdAt: true, expiresAt: true },
    });
  }

  async getPublicShare(token: string) {
    // Suporta token aleatório (novo) e id UUID (shares antigas sem token)
    const share = token.length === 64
      ? await this.prisma.reportShare.findUnique({ where: { accessToken: token } })
      : await this.prisma.reportShare.findUnique({ where: { id: token } });

    if (!share) throw new NotFoundException('Partilha não encontrada');
    if (share.expiresAt && share.expiresAt < new Date()) throw new ForbiddenException('Partilha expirada');

    const [client, data] = await Promise.all([
      share.clientId
        ? this.prisma.client.findUnique({ where: { id: share.clientId }, select: { name: true } })
        : Promise.resolve(null),
      this.fetchData(share.type, share.clientId, share.params as any),
    ]);

    return {
      type: share.type,
      label: share.label,
      createdAt: share.createdAt,
      params: share.params,
      clientName: client?.name ?? null,
      data,
    };
  }

  private dateWhere(field: string, params: any) {
    if (!params.startDate && !params.endDate) return {};
    const w: any = {};
    if (params.startDate) w.gte = new Date(params.startDate);
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setDate(end.getDate() + 1);
      w.lt = end;
    }
    return { [field]: w };
  }

  private async fetchData(type: ReportType, clientId: string, params: any) {
    const cIdFilter = clientId ? { clientId } : {};
    switch (type) {
      case ReportType.ENTRADAS:
        return this.prisma.entradaRecord.findMany({
          where: { ...cIdFilter, ...this.dateWhere('data', params) },
          include: { operator: { select: { name: true } } },
          orderBy: { data: 'desc' },
          take: 500,
        });

      case ReportType.HIGIENIZACAO:
        return this.prisma.higienizacaoRecord.findMany({
          where: {
            ...cIdFilter,
            ...this.dateWhere('dia', params),
            ...(params.zona ? { zona: params.zona } : {}),
          },
          include: { operator: { select: { name: true } } },
          orderBy: { dia: 'desc' },
          take: 500,
        });

      case ReportType.DESINFECAO:
        return this.prisma.desinfecaoRecord.findMany({
          where: { ...cIdFilter, ...this.dateWhere('data', params) },
          include: { operator: { select: { name: true } } },
          orderBy: { data: 'desc' },
          take: 500,
        });

      case ReportType.OLEOS:
        return this.prisma.oleoFrituraRecord.findMany({
          where: { ...cIdFilter, ...this.dateWhere('data', params) },
          include: { responsavel: { select: { name: true } } },
          orderBy: { data: 'desc' },
          take: 500,
        });

      case ReportType.TEMPERATURAS:
        return this.prisma.temperatureRecord.findMany({
          where: {
            ...(clientId ? { equipment: { clientId } } : {}),
            ...this.dateWhere('recordedAt', params),
          },
          include: {
            equipment: { select: { name: true, type: true } },
            operator: { select: { name: true } },
          },
          orderBy: { recordedAt: 'desc' },
          take: 500,
        });

      case ReportType.CHECKLISTS:
        return this.prisma.checklistEntry.findMany({
          where: {
            ...(clientId ? { area: { clientId } } : {}),
            ...this.dateWhere('completedAt', params),
          },
          include: {
            template: { select: { name: true, frequency: true } },
            area: { select: { name: true } },
            operator: { select: { name: true } },
            taskResults: {
              include: { task: { select: { description: true, order: true } } },
              orderBy: { task: { order: 'asc' } },
            },
          },
          orderBy: { completedAt: 'desc' },
          take: 200,
        });

      default:
        return [];
    }
  }
}
