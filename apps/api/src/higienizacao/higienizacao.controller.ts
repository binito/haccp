import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { HigienizacaoZona, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateHigienizacaoDto } from './dto/create-higienizacao.dto';
import { HigienizacaoService } from './higienizacao.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('registos/higienizacao')
export class HigienizacaoController {
  constructor(private readonly service: HigienizacaoService) {}

  @Get()
  findAll(
    @TenantId() clientId: string,
    @Query('zona') zona?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(clientId, zona, startDate, endDate, page ? +page : 1, limit ? +limit : 50);
  }

  @Post()
  create(@Body() dto: CreateHigienizacaoDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id, user.clientId!);
  }

  @Get('config')
  getConfig(@TenantId() clientId: string) {
    return this.service.getZonaConfigs(clientId);
  }

  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Put('config/:zona')
  upsertConfig(
    @TenantId() clientId: string,
    @Param('zona') zona: string,
    @Body('itens') itens: { key: string; label: string; period: string }[],
  ) {
    return this.service.upsertZonaConfig(clientId, zona as HigienizacaoZona, itens);
  }

  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
