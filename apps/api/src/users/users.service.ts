import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, AdminUpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  active: true,
  clientId: true,
  createdAt: true,
} as const;

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto, actor: AuthUser) {
    if (actor.role === Role.CLIENT_ADMIN) {
      if (dto.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Não pode criar utilizadores com este perfil');
      }
      dto.clientId = actor.clientId ?? undefined;
    }

    const existe = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('Email já está em uso');

    const hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: { ...dto, password: hash },
      select: USER_SELECT,
    });
  }

  async findAll(clientId?: string) {
    return this.prisma.user.findMany({
      where: clientId ? { clientId } : undefined,
      select: USER_SELECT,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Utilizador não encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto | AdminUpdateUserDto, actor: AuthUser) {
    const target = await this.findOne(id);

    if (actor.role === Role.CLIENT_ADMIN) {
      if (target.clientId !== actor.clientId) {
        throw new ForbiddenException('Acesso negado a este utilizador');
      }
      const safeDto = dto as UpdateUserDto;
      if ((safeDto as any).role !== undefined || (safeDto as any).clientId !== undefined) {
        throw new ForbiddenException('Não pode alterar perfil ou cliente');
      }
    }

    const data: Record<string, unknown> = { ...dto };
    if (data['password']) {
      data['password'] = await bcrypt.hash(data['password'] as string, BCRYPT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { ...USER_SELECT, updatedAt: true },
    });
  }

  async deactivate(id: string, actor: AuthUser) {
    const target = await this.findOne(id);

    if (actor.role === Role.CLIENT_ADMIN && target.clientId !== actor.clientId) {
      throw new ForbiddenException('Acesso negado a este utilizador');
    }

    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true },
    });
  }

  async delete(id: string, actor: AuthUser) {
    const target = await this.findOne(id);

    if (actor.id === id) {
      throw new ForbiddenException('Não pode apagar a sua própria conta');
    }
    if (actor.role === Role.CLIENT_ADMIN && target.clientId !== actor.clientId) {
      throw new ForbiddenException('Acesso negado a este utilizador');
    }

    await this.prisma.user.delete({ where: { id } });
    return { id };
  }
}
