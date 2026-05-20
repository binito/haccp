import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { assertOwnership } from '../common/utils/tenant.util';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { RecordTemperatureDto } from './dto/record-temperature.dto';

@Injectable()
export class TemperatureService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private equipKey(clientId?: string) {
    return `temp:equipment:${clientId ?? 'all'}`;
  }

  async findAllEquipment(clientId?: string) {
    const key = this.equipKey(clientId);
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const data = await this.prisma.temperatureEquipment.findMany({
      where: { active: true, ...(clientId ? { clientId } : {}) },
      orderBy: { name: 'asc' },
      include: { client: { select: { id: true, name: true } } },
    });
    await this.cache.set(key, data, 120000);
    return data;
  }

  async createEquipment(dto: CreateEquipmentDto, actor: AuthUser) {
    if (actor.role !== Role.SUPER_ADMIN) dto.clientId = actor.clientId!;
    const result = await this.prisma.temperatureEquipment.create({ data: dto });
    await Promise.all([
      this.cache.del(this.equipKey(dto.clientId)),
      this.cache.del(this.equipKey()),
    ]);
    return result;
  }

  async updateEquipment(id: string, data: Partial<CreateEquipmentDto>, actor: AuthUser) {
    const eq = await this.prisma.temperatureEquipment.findUnique({ where: { id }, select: { clientId: true } });
    if (!eq) throw new NotFoundException('Equipamento não encontrado');
    assertOwnership(actor, eq.clientId);
    const result = await this.prisma.temperatureEquipment.update({ where: { id }, data });
    await Promise.all([
      this.cache.del(this.equipKey(eq.clientId)),
      this.cache.del(this.equipKey()),
    ]);
    return result;
  }

  async deleteEquipment(id: string, actor: AuthUser) {
    const eq = await this.prisma.temperatureEquipment.findUnique({ where: { id }, select: { clientId: true } });
    if (!eq) throw new NotFoundException('Equipamento não encontrado');
    assertOwnership(actor, eq.clientId);

    await this.prisma.temperatureRecord.deleteMany({ where: { equipmentId: id } });
    await this.prisma.temperatureEquipment.delete({ where: { id } });
    await Promise.all([
      this.cache.del(this.equipKey(eq.clientId)),
      this.cache.del(this.equipKey()),
    ]);
    return { id };
  }

  async recordTemperature(dto: RecordTemperatureDto, operatorId: string, actor: AuthUser) {
    if (actor.role !== Role.SUPER_ADMIN) {
      const eq = await this.prisma.temperatureEquipment.findUnique({ where: { id: dto.equipmentId }, select: { clientId: true } });
      if (!eq) throw new NotFoundException('Equipamento não encontrado');
      assertOwnership(actor, eq.clientId);
    }

    return this.prisma.temperatureRecord.create({
      data: {
        temperature: dto.temperature,
        session: dto.session,
        notes: dto.notes,
        equipment: { connect: { id: dto.equipmentId } },
        operator: { connect: { id: operatorId } },
      },
    });
  }

  async getRecords(equipmentId?: string, date?: string, clientId?: string, startDate?: string, endDate?: string) {
    const where: any = {};

    if (equipmentId) {
      where.equipmentId = equipmentId;
    } else if (clientId) {
      where.equipment = { clientId };
    }

    if (startDate || endDate || date) {
      const from = new Date(startDate ?? date!);
      from.setHours(0, 0, 0, 0);
      const to = new Date(endDate ?? date!);
      to.setHours(23, 59, 59, 999);
      where.recordedAt = { gte: from, lte: to };
    }

    return this.prisma.temperatureRecord.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 500,
      include: {
        equipment: { select: { id: true, name: true, type: true, minTemp: true, maxTemp: true, location: true, client: { select: { id: true, name: true } } } },
        operator: { select: { id: true, name: true } },
      },
    });
  }

  async getTodayStatus(clientId: string) {
    const equipment = await this.findAllEquipment(clientId);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const todayRecords = await this.prisma.temperatureRecord.findMany({
      where: { equipment: { clientId }, recordedAt: { gte: start, lte: end } },
      select: { equipmentId: true, session: true, temperature: true, recordedAt: true },
    });

    return (equipment as any[]).map((eq) => {
      const records = todayRecords.filter((r) => r.equipmentId === eq.id);
      return {
        ...eq,
        today: {
          morning: records.find((r) => r.session === 'MORNING') ?? null,
          evening: records.find((r) => r.session === 'EVENING') ?? null,
        },
      };
    });
  }
}
