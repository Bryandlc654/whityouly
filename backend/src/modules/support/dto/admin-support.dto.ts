import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportCategory,
  type SupportStatus,
} from './support.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Bandeja de soporte: filtros por estado, motivo y texto del caso. */
export class ListSupportTicketsQueryDto {
  @ApiPropertyOptional({ description: 'Id de la última solicitud recibida; devuelve las siguientes.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ enum: SUPPORT_STATUSES })
  @IsOptional()
  @IsIn(SUPPORT_STATUSES, { message: 'El estado no es válido' })
  status?: SupportStatus;

  @ApiPropertyOptional({ enum: SUPPORT_CATEGORIES })
  @IsOptional()
  @IsIn(SUPPORT_CATEGORIES, { message: 'El motivo de la solicitud no es válido' })
  category?: SupportCategory;

  @ApiPropertyOptional({ description: 'Busca en el correo de la cuenta o en el texto del caso.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  search?: string;
}

/** Cambio de estado y respuesta visible para la persona que abrió el caso. */
export class UpdateSupportTicketDto {
  @ApiPropertyOptional({ enum: SUPPORT_STATUSES })
  @IsOptional()
  @IsIn(SUPPORT_STATUSES, { message: 'El estado no es válido' })
  status?: SupportStatus;

  @ApiPropertyOptional({
    description: 'Respuesta interna/visible. Enviar cadena vacía para quitarla.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  resolutionNote?: string;
}
