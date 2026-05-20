import { Body, Controller, Delete, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Post()
  create(@Body() dto: CreateInvitationDto, @CurrentUser() user: AuthUser) {
    return this.invitationsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Get()
  findByClient(@Query('clientId') clientId: string, @CurrentUser() user: AuthUser) {
    return this.invitationsService.findByClient(clientId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Delete(':id')
  revoke(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invitationsService.revoke(id, user);
  }

  // Rotas públicas (sem auth)
  @Get(':token/validate')
  validate(@Param('token') token: string) {
    return this.invitationsService.validate(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.invitationsService.accept(token, dto);
    const isProduction = process.env.NODE_ENV === 'production';
    const ttl = 7 * 24 * 60 * 60 * 1000;

    res.cookie('patakus_token', result.access_token, {
      httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: ttl, path: '/',
    });

    return { user: result.user };
  }
}
