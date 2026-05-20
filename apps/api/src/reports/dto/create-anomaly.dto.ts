import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AnomalySeverity } from '@prisma/client';

export class CreateAnomalyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(AnomalySeverity)
  @IsOptional()
  severity?: AnomalySeverity;

  @IsString()
  @IsOptional()
  areaId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  zona?: string;
}
