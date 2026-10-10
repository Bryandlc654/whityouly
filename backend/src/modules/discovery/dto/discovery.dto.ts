import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ListDiscoveryQueryDto {
  @ApiPropertyOptional({ default: 12, description: 'Entre 1 y 30. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * Datos de curación de un destacado. Es un reemplazo completo (PUT): si un campo
 * se omite, se conserva el valor anterior; `note: ''` la vacía.
 */
export class UpsertFeaturedDto {
  @ApiPropertyOptional({ description: 'Orden en la lista curada. Menor aparece antes.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ description: 'Nota editorial breve. Enviar cadena vacía para quitarla.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  note?: string;

  @ApiPropertyOptional({
    description: 'Fecha (ISO 8601) a partir de la cual el destacado deja de mostrarse.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
