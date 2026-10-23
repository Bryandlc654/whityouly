import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const MY_REPORT_STATUSES = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export type MyReportStatus = (typeof MY_REPORT_STATUSES)[number];

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
