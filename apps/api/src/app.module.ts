import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './common/guards/csrf.guard';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { AreasModule } from './areas/areas.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ReportsModule } from './reports/reports.module';
import { ConsumablesModule } from './consumables/consumables.module';
import { ProductsModule } from './products/products.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TemperatureModule } from './temperature/temperature.module';
import { EntradasModule } from './entradas/entradas.module';
import { HigienizacaoModule } from './higienizacao/higienizacao.module';
import { DesinfecaoModule } from './desinfecao/desinfecao.module';
import { OleosModule } from './oleos/oleos.module';
import { SharesModule } from './shares/shares.module';
import { InvitationsModule } from './invitations/invitations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 60000, max: 500 }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context, stack }) =>
              stack
                ? `${timestamp} [${context ?? 'App'}] ${level}: ${message}\n${stack}`
                : `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
            ),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    AreasModule,
    ChecklistsModule,
    ReportsModule,
    ConsumablesModule,
    ProductsModule,
    DashboardModule,
    TemperatureModule,
    EntradasModule,
    HigienizacaoModule,
    DesinfecaoModule,
    OleosModule,
    SharesModule,
    InvitationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
