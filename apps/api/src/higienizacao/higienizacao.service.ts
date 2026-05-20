import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HigienizacaoZona, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { buildDateRange } from '../common/utils/date-range.util';
import { CreateHigienizacaoDto } from './dto/create-higienizacao.dto';

@Injectable()
export class HigienizacaoService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateHigienizacaoDto, operatorId: string, clientId: string) {
    return this.prisma.higienizacaoRecord.create({
      data: {
        zona: dto.zona as HigienizacaoZona,
        dia: new Date(dto.dia),
        itens: dto.itens,
        observacoes: dto.observacoes,
        clientId,
        operatorId,
      },
      include: { operator: { select: { id: true, name: true } } },
    });
  }

  async findAll(clientId: string, zona?: string, startDate?: string, endDate?: string, page = 1, limit = 50) {
    const dateRange = buildDateRange(startDate, endDate);
    const where = {
      ...(clientId ? { clientId } : {}),
      ...(zona ? { zona: zona as HigienizacaoZona } : {}),
      ...(dateRange ? { dia: dateRange } : {}),
    };
    const safeLimit = Math.min(limit, 200);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.higienizacaoRecord.findMany({
        where,
        orderBy: { dia: 'desc' },
        include: { operator: { select: { id: true, name: true } } },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.higienizacaoRecord.count({ where }),
    ]);
    return { data, total, page, limit: safeLimit };
  }

  async getZonaConfigs(clientId: string) {
    return this.prisma.higienizacaoZonaConfig.findMany({ where: { clientId } });
  }

  async upsertZonaConfig(clientId: string, zona: HigienizacaoZona, itens: { key: string; label: string; period: string }[]) {
    return this.prisma.higienizacaoZonaConfig.upsert({
      where: { clientId_zona: { clientId, zona } },
      create: { clientId, zona, itens },
      update: { itens },
    });
  }

  async remove(id: string, actor: AuthUser) {
    const rec = await this.prisma.higienizacaoRecord.findUnique({ where: { id }, select: { clientId: true } });
    if (!rec) throw new NotFoundException('Registo não encontrado');
    if (actor.role !== Role.SUPER_ADMIN && rec.clientId !== actor.clientId) {
      throw new ForbiddenException('Acesso negado a este registo');
    }
    return this.prisma.higienizacaoRecord.delete({ where: { id } });
  }
}
