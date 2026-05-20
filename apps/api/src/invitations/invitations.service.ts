import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../common/types/auth-user.type';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/create-invitation.dto';

const BCRYPT_ROUNDS = 12;
const EXPIRES_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async create(dto: CreateInvitationDto, actor: AuthUser) {
    if (actor.role === Role.CLIENT_ADMIN) {
      if (dto.clientId !== actor.clientId) throw new ForbiddenException('Só pode convidar para o seu próprio cliente');
      if (dto.role && dto.role !== Role.OPERATOR) throw new ForbiddenException('Só pode convidar utilizadores do tipo Operacional');
    }

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const role = actor.role === Role.CLIENT_ADMIN ? Role.OPERATOR : (dto.role ?? Role.CLIENT_ADMIN);

    const invitation = await this.prisma.invitation.create({
      data: {
        token,
        email: dto.email,
        role,
        clientId: dto.clientId,
        expiresAt,
        createdById: actor.id,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL as string;
    return {
      id: invitation.id,
      token: invitation.token,
      link: `${frontendUrl}/invite/${token}`,
      expiresAt: invitation.expiresAt,
      email: invitation.email,
      clientName: client.name,
    };
  }

  async findByClient(clientId: string, actor: AuthUser) {
    if (actor.role === Role.CLIENT_ADMIN && clientId !== actor.clientId) {
      throw new ForbiddenException('Sem permissão para ver convites de outro cliente');
    }
    return this.prisma.invitation.findMany({
      where: { clientId, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, actor: AuthUser) {
    const inv = await this.prisma.invitation.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Convite não encontrado');
    if (actor.role === Role.CLIENT_ADMIN && inv.clientId !== actor.clientId) {
      throw new ForbiddenException('Sem permissão para revogar este convite');
    }
    await this.prisma.invitation.delete({ where: { id } });
    return { id };
  }

  async validate(token: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { token } });
    if (!inv) throw new NotFoundException('Convite inválido');
    if (inv.used) throw new BadRequestException('Este convite já foi utilizado');
    if (inv.expiresAt < new Date()) throw new BadRequestException('Este convite expirou');

    const client = await this.prisma.client.findUnique({
      where: { id: inv.clientId },
      select: { name: true },
    });

    return {
      email: inv.email,
      role: inv.role,
      clientName: client?.name ?? '',
      expiresAt: inv.expiresAt,
    };
  }

  async accept(token: string, dto: AcceptInvitationDto) {
    const inv = await this.prisma.invitation.findUnique({ where: { token } });
    if (!inv) throw new NotFoundException('Convite inválido');
    if (inv.used) throw new BadRequestException('Este convite já foi utilizado');
    if (inv.expiresAt < new Date()) throw new BadRequestException('Este convite expirou');

    const email = dto.email ?? inv.email;
    if (!email) throw new BadRequestException('Email obrigatório');

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Já existe uma conta com este email');

    const hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        password: hash,
        role: inv.role,
        clientId: inv.clientId,
      },
    });

    await this.prisma.invitation.update({ where: { id: inv.id }, data: { used: true } });

    return this.authService.login(email, dto.password);
  }
}
