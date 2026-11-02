import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export enum DiaryEntryType {
  ALL = 'ALL',
  NOTE = 'NOTE',
  EMOTIONAL = 'EMOTIONAL',
}

export class DiaryQueryDto {
  @ApiPropertyOptional({ description: 'Busca en titulo, contenido o emocion.', maxLength: 200 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Desde esta fecha (ISO 8601), inclusive.' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha desde no es valida' })
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta esta fecha (ISO 8601), inclusive.' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'La fecha hasta no es valida' })
  to?: string;

  @ApiPropertyOptional({ enum: DiaryEntryType, default: DiaryEntryType.ALL })
  @IsOptional()
  @IsEnum(DiaryEntryType)
  type?: DiaryEntryType;

  @ApiPropertyOptional({ description: 'Lista la papelera en lugar del historial activo.' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  trash?: boolean;

  @ApiPropertyOptional({ default: 100, description: 'Entre 1 y 200.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ description: 'Fecha del ultimo registro recibido para pedir la siguiente pagina.' })
  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'El cursor de fecha no es valido' })
  before?: string;

  @ApiPropertyOptional({ description: 'Id del ultimo registro recibido para pedir la siguiente pagina.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'El cursor de id no es valido' })
  beforeId?: string;
}

export class CreateDiaryNoteDto {
  @ApiPropertyOptional({ description: 'Titulo opcional de la nota.', maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El titulo no puede superar los 100 caracteres' })
  title?: string;

  @ApiProperty({ description: 'Contenido libre de la nota.', maxLength: 10000 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Escribe algo antes de guardar tu nota' })
  @MaxLength(10000, { message: 'La nota no puede superar los 10000 caracteres' })
  content!: string;
}

export class UpdateDiaryNoteDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El titulo no puede superar los 100 caracteres' })
  title?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Escribe algo antes de guardar tu nota' })
  @MaxLength(10000, { message: 'La nota no puede superar los 10000 caracteres' })
  content?: string;
}
