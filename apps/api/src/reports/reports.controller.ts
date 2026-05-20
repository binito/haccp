import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { Role, AnomalyStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CursorPaginationDto } from '../common/dto/pagination.dto';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';
import { ReportsService } from './reports.service';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const multerStorage = diskStorage({
  destination: process.env.UPLOAD_DIR ?? './uploads',
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('anomalies')
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: multerStorage,
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Tipo de ficheiro não permitido: ${file.mimetype}. Use JPEG, PNG ou WebP.`), false);
        }
      },
    }),
  )
  createAnomaly(
    @Body() dto: CreateAnomalyDto,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.reportsService.createAnomaly(dto, user.id, files ?? [], user);
  }

  @Get('anomalies')
  findAll(
    @TenantId() clientId: string,
    @Query('areaId') areaId: string,
    @Query('status') status: string,
    @Query('zona') zona: string,
    @Query() pagination: CursorPaginationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.findAll(
      user.role === Role.SUPER_ADMIN ? (clientId || undefined) : clientId,
      areaId,
      status as AnomalyStatus,
      zona,
      pagination,
    );
  }

  @Get('anomalies/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.findOne(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Delete('anomalies/:id')
  deleteAnomaly(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reportsService.deleteAnomaly(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  @Patch('anomalies/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: AnomalyStatus,
    @Body('resolvedNote') resolvedNote: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.updateStatus(id, status, resolvedNote, user);
  }
}
