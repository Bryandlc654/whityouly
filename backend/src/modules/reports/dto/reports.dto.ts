import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { REPORT_REASONS } from '../../comments/dto/comment.dto';

export const MY_REPORT_STATUSES = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export type MyReportStatus = (typeof MY_REPORT_STATUSES)[number];

export class CreateGeneralReportDto {
  @ApiPropertyOptional({ enum: REPORT_REASONS })
  @IsIn(REPORT_REASONS, { message: 'La razón del reporte no es válida' })
  reason!: (typeof REPORT_REASONS)[number];

  @ApiPropertyOptional({ description: 'Contexto opcional del reporte.' })
  @IsOptional()
  @IsString()
  @MaxLength(800, { message: 'El contexto no puede superar los 800 caracteres' })
  details?: string;
}

export class ListMyReportsQueryDto {
  @ApiPropertyOptional({ description: 'Id del último reporte recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'El cursor no es válido' })
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ enum: MY_REPORT_STATUSES })
  @IsOptional()
  @IsIn(MY_REPORT_STATUSES, { message: 'El estado no es válido' })
  status?: MyReportStatus;
}
