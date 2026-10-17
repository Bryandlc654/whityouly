import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CommunityPulseQueryDto {
  @ApiPropertyOptional({
    default: 7,
    description: 'Ventana en días (1 a 90) que cubre el pulso de la comunidad.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Desfase del huso horario en minutos, tal como lo devuelve Date.getTimezoneOffset(). Agrupa por día local.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-720)
  @Max(840)
  tzOffsetMinutes?: number;
}
