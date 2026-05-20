import { BadRequestException, ForbiddenException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { assertOwnership } from '../common/utils/tenant.util';
import { CreateAreaDto } from './dto/create-area.dto';

@Injectable()
export class AreasService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private areasKey(clientId?: string) {
    return `areas:${clientId ?? 'all'}`;
  }

  async create(dto: CreateAreaDto, actor: AuthUser) {
    if (actor.role === Role.CLIENT_ADMIN) {
      dto.clientId = actor.clientId!;
    }
    const result = await this.prisma.area.create({ data: dto });
    await Promise.all([
      this.cache.del(this.areasKey(dto.clientId)),
      this.cache.del(this.areasKey()),
    ]);
    return result;
  }

  async findAll(clientId?: string) {
    const key = this.areasKey(clientId);
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const data = await this.prisma.area.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { name: 'asc' },
    });
    await this.cache.set(key, data, 60000);
    return data;
  }

  async findOne(id: string, actor?: AuthUser) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { checklistTemplates: true },
    });
    if (!area) throw new NotFoundException('Área não encontrada');
    if (actor) assertOwnership(actor, area.clientId);
    return area;
  }

  async update(id: string, data: Partial<CreateAreaDto>, actor: AuthUser) {
    const area = await this.findOne(id, actor);
    const result = await this.prisma.area.update({ where: { id }, data });
    await Promise.all([
      this.cache.del(this.areasKey(area.clientId)),
      this.cache.del(this.areasKey()),
    ]);
    return result;
  }

  async deactivate(id: string, actor: AuthUser) {
    const area = await this.findOne(id, actor);
    const result = await this.prisma.area.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true },
    });
    await Promise.all([
      this.cache.del(this.areasKey(area.clientId)),
      this.cache.del(this.areasKey()),
    ]);
    return result;
  }

  async delete(id: string, actor: AuthUser) {
    const area = await this.findOne(id, actor);

    const [entries, anomalies] = await Promise.all([
      this.prisma.checklistEntry.count({ where: { areaId: id } }),
      this.prisma.anomalyReport.count({ where: { areaId: id } }),
    ]);

    if (entries > 0 || anomalies > 0) {
      throw new BadRequestException(
        `Não é possível eliminar esta área porque tem ${entries} registo(s) de checklist e ${anomalies} anomalia(s) associadas.`,
      );
    }

    await this.prisma.checklistTemplate.deleteMany({ where: { areaId: id } });
    await this.prisma.area.delete({ where: { id } });
    await Promise.all([
      this.cache.del(this.areasKey(area.clientId)),
      this.cache.del(this.areasKey()),
    ]);
    return { id };
  }
}
