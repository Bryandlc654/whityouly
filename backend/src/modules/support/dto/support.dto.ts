import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SUPPORT_CATEGORIES = [
  'ACCOUNT',
  'MODERATION',
  'STORY',
  'BUG',
  'PRIVACY',
  'OTHER',
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_BODY_MIN_LENGTH = 10;
export const SUPPORT_BODY_MAX_LENGTH = 3000;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSupportTicketDto {
  @ApiProperty({ enum: SUPPORT_CATEGORIES, example: 'ACCOUNT' })
  @IsIn(SUPPORT_CATEGORIES, { message: 'El motivo de la solicitud no es válido' })
  category!: SupportCategory;

  @ApiProperty({
    example: 'No puedo acceder a mi cuenta desde ayer.',
    description: 'Descripción del caso. No incluyas contraseñas ni secretos.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(SUPPORT_BODY_MIN_LENGTH, {
    message: `Cuéntanos un poco más (mínimo ${SUPPORT_BODY_MIN_LENGTH} caracteres)`,
  })
  @MaxLength(SUPPORT_BODY_MAX_LENGTH, {
    message: `La solicitud no puede superar los ${SUPPORT_BODY_MAX_LENGTH} caracteres`,
  })
  body!: string;
}

export class ListMySupportTicketsQueryDto {
  @ApiPropertyOptional({ description: 'Id de la última solicitud recibida; devuelve las siguientes.' })
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

  @ApiPropertyOptional({ enum: SUPPORT_STATUSES })
  @IsOptional()
  @IsIn(SUPPORT_STATUSES, { message: 'El estado no es válido' })
  status?: SupportStatus;
}
