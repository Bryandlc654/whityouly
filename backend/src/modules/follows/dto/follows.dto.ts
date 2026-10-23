import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Paginación por cursor para las listas públicas de seguidores y seguidos. */
export class ListConnectionsQueryDto {
  @ApiPropertyOptional({
    description: 'Id de la última relación recibida; devuelve las siguientes.',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'El cursor no es válido' })
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(50, { message: 'El límite máximo es 50' })
  limit?: number;
}
