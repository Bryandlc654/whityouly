import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const NAME_MAX_LENGTH = 40;

/** Las notas personales conviven con el contexto: un solo texto libre acotado. */
export const NOTE_MAX_LENGTH = 1000;

// Normaliza Unicode (evita homoglifos), colapsa espacios y recorta extremos. El
// mismo criterio que usa el resto de catálogos para no crear nombres que no casen.
const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEmotionalLogDto {
  @ApiProperty({ example: 'Esperanza', description: 'Nombre de una emoción del catálogo.' })
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty({ message: 'Elige una emoción' })
  @MaxLength(NAME_MAX_LENGTH, { message: 'La emoción no puede superar los 40 caracteres' })
  emotion!: string;

  @ApiProperty({ example: 7, description: 'Intensidad del 1 al 10.' })
  @Type(() => Number)
  @IsInt({ message: 'La intensidad debe ser un número entero' })
  @Min(1, { message: 'La intensidad mínima es 1' })
  @Max(10, { message: 'La intensidad máxima es 10' })
  intensity!: number;

  @ApiPropertyOptional({
    example: '2026-10-16T20:30:00.000Z',
    description: 'Fecha del registro. Por defecto, el momento actual.',
  })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha no es válida' })
  loggedAt?: string;

  @ApiPropertyOptional({
    example: 'Después de hablar con mi hermana. Me sentí escuchada.',
    description: 'Notas personales y contexto del momento.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH, {
    message: `Las notas no pueden superar los ${NOTE_MAX_LENGTH} caracteres`,
  })
  contextNote?: string;
}

export class UpdateEmotionalLogDto {
  @ApiPropertyOptional({ example: 'Calma' })
  @Transform(normalizeName)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La emoción no puede estar vacía' })
  @MaxLength(NAME_MAX_LENGTH, { message: 'La emoción no puede superar los 40 caracteres' })
  emotion?: string;

  @ApiPropertyOptional({ example: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'La intensidad debe ser un número entero' })
  @Min(1, { message: 'La intensidad mínima es 1' })
  @Max(10, { message: 'La intensidad máxima es 10' })
  intensity?: number;

  @ApiPropertyOptional({ example: '2026-10-16T08:00:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha no es válida' })
  loggedAt?: string;

  @ApiPropertyOptional({
    example: '',
    description: 'Enviar una cadena vacía borra las notas y el contexto.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH, {
    message: `Las notas no pueden superar los ${NOTE_MAX_LENGTH} caracteres`,
  })
  contextNote?: string;
}

export class ListEmotionalLogsQueryDto {
  @ApiPropertyOptional({ description: 'Id del último registro recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Desde esta fecha (ISO 8601), inclusive.' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha «desde» no es válida' })
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta esta fecha (ISO 8601), inclusive.' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha «hasta» no es válida' })
  to?: string;
}

export class EmotionalSummaryQueryDto {
  @ApiPropertyOptional({
    default: 90,
    description: 'Ventana en días (1 a 366) que cubre el mapa emocional.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
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
