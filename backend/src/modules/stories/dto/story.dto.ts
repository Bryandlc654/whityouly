import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  STORY_CONTENT_MAX_LENGTH,
  STORY_TITLE_MAX_LENGTH,
} from '../story-sanitize';

export const VISIBILITIES = ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

const MAX_CATEGORIES = 3;
const MAX_EMOTIONS = 5;
const MAX_TAGS = 10;
const NAME_MAX_LENGTH = 40;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Los catálogos se envían por nombre (lo que la persona elige de la lista). El
// servidor nunca confía en identificadores: los resuelve contra el catálogo.
const normalizeNames = ({ value }: { value: unknown }): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  const seen = new Set<string>();

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.normalize('NFKC').replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

export class CreateStoryDto {
  @ApiProperty({ example: 'Hoy dejé de fingir que todo estaba bien' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  @MaxLength(STORY_TITLE_MAX_LENGTH, { message: 'El título no puede superar los 120 caracteres' })
  title!: string;

  @ApiProperty({
    example: 'No pasó nada extraordinario. Solo me cansé de responder "todo bien".',
    description: 'Texto de la primera etapa. Se puede dejar vacío si se adjunta imagen o audio.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CONTENT_MAX_LENGTH, {
    message: 'El relato no puede superar los 5000 caracteres',
  })
  content?: string;

  @ApiPropertyOptional({ enum: VISIBILITIES, default: 'PUBLIC' })
  @IsOptional()
  @IsIn(VISIBILITIES, { message: 'La visibilidad no es válida' })
  visibility?: VisibilityValue;

  @ApiPropertyOptional({
    default: false,
    description: 'Si es true el relato se publica; si no, queda como borrador privado.',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['Relaciones'] })
  @Transform(normalizeNames)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CATEGORIES, { message: `Elige como máximo ${MAX_CATEGORIES} categorías` })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(NAME_MAX_LENGTH, { each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Tristeza', 'Esperanza'] })
  @Transform(normalizeNames)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EMOTIONS, { message: `Elige como máximo ${MAX_EMOTIONS} emociones` })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(NAME_MAX_LENGTH, { each: true })
  emotions?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Autoestima'] })
  @Transform(normalizeNames)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS, { message: `Elige como máximo ${MAX_TAGS} etiquetas` })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(NAME_MAX_LENGTH, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Id de una imagen de tu biblioteca para ilustrar la primera etapa.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo indicado no es válido' })
  mediaAssetId?: string;

  @ApiPropertyOptional({
    description: 'Id de un audio de tu biblioteca para acompañar la primera etapa.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo indicado no es válido' })
  audioAssetId?: string;
}

export class UpdateStoryDto {
  @ApiPropertyOptional({ example: 'Un nuevo título' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  @MaxLength(STORY_TITLE_MAX_LENGTH, { message: 'El título no puede superar los 120 caracteres' })
  title?: string;

  @ApiPropertyOptional({ enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES, { message: 'La visibilidad no es válida' })
  visibility?: VisibilityValue;

  @ApiPropertyOptional({ type: [String] })
  @Transform(normalizeNames)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CATEGORIES, { message: `Elige como máximo ${MAX_CATEGORIES} categorías` })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(NAME_MAX_LENGTH, { each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [String] })
  @Transform(normalizeNames)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EMOTIONS, { message: `Elige como máximo ${MAX_EMOTIONS} emociones` })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(NAME_MAX_LENGTH, { each: true })
  emotions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @Transform(normalizeNames)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS, { message: `Elige como máximo ${MAX_TAGS} etiquetas` })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(NAME_MAX_LENGTH, { each: true })
  tags?: string[];
}

export class CreateStoryUpdateDto {
  @ApiProperty({
    example: 'Han pasado tres semanas y quiero contar cómo me fue.',
    description: 'Texto de la etapa. Se puede dejar vacío si se adjunta imagen o audio.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CONTENT_MAX_LENGTH, {
    message: 'La etapa no puede superar los 5000 caracteres',
  })
  content?: string;

  @ApiPropertyOptional({ description: 'Id de una imagen de tu biblioteca para esta etapa.' })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo indicado no es válido' })
  mediaAssetId?: string;

  @ApiPropertyOptional({ description: 'Id de un audio de tu biblioteca para esta etapa.' })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo indicado no es válido' })
  audioAssetId?: string;
}

export class UpdateStoryUpdateDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La etapa no puede estar vacía' })
  @MaxLength(STORY_CONTENT_MAX_LENGTH, {
    message: 'La etapa no puede superar los 5000 caracteres',
  })
  content?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Id de la imagen; `null` para quitar la imagen de la etapa.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo indicado no es válido' })
  mediaAssetId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Id del audio; `null` para quitar el audio de la etapa.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El archivo indicado no es válido' })
  audioAssetId?: string | null;
}

export class ListMyStoriesQueryDto {
  @ApiPropertyOptional({ description: 'Id del último relato recibido; devuelve los siguientes.' })
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

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'], { message: 'El estado no es válido' })
  status?: 'DRAFT' | 'PUBLISHED';
}

export class ListPublicStoriesQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por texto en el título.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filtra por nombre de categoría.' })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  category?: string;

  @ApiPropertyOptional({ description: 'Filtra por nombre de emoción.' })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  emotion?: string;

  @ApiPropertyOptional({ description: 'Filtra por nombre de etiqueta.' })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  tag?: string;
}
