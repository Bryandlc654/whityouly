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
import { REPORT_REASONS } from '../../comments/dto/comment.dto';
import { COUNTRY_CODES, LANGUAGES } from '../../../common/i18n/locales';

export const VISIBILITIES = ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

export const VISUAL_CARD_THEMES = [
  'lavender',
  'sunset',
  'forest',
  'ocean',
  'rose',
  'paper',
] as const;
export type VisualCardThemeValue = (typeof VISUAL_CARD_THEMES)[number];

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

  @ApiPropertyOptional({ enum: LANGUAGES, default: 'es' })
  @Transform(trim)
  @IsOptional()
  @IsIn([...LANGUAGES], { message: 'El idioma del relato no es válido' })
  language?: (typeof LANGUAGES)[number];

  @ApiPropertyOptional({ enum: COUNTRY_CODES, example: 'PE' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsIn([...COUNTRY_CODES], { message: 'El país del relato no es válido' })
  countryCode?: (typeof COUNTRY_CODES)[number];

  @ApiPropertyOptional({ enum: VISIBILITIES, default: 'PUBLIC' })
  @IsOptional()
  @IsIn(VISIBILITIES, { message: 'La visibilidad no es válida' })
  visibility?: VisibilityValue;

  @ApiPropertyOptional({
    enum: VISUAL_CARD_THEMES,
    description: 'Tema de la tarjeta visual. Si falta, el relato usa el formato de lectura normal.',
  })
  @IsOptional()
  @IsIn(VISUAL_CARD_THEMES, { message: 'El tema de la tarjeta visual no es válido' })
  visualCardTheme?: VisualCardThemeValue;

  @ApiPropertyOptional({ description: 'Aviso de contenido opcional antes de leer.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El aviso de contenido no puede superar los 80 caracteres' })
  contentWarning?: string;

  @ApiPropertyOptional({ description: 'Canción vinculada por el autor.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'La canción no puede superar los 120 caracteres' })
  musicLabel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  externalShare?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  guestReadable?: boolean;

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

  @ApiPropertyOptional({
    description: 'Transcripción opcional del audio de la primera etapa.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CONTENT_MAX_LENGTH, {
    message: 'La transcripción no puede superar los 5000 caracteres',
  })
  audioTranscript?: string;
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
  @IsIn(VISIBILITIES, { message: 'La visibilidad no es vǭlida' })
  visibility?: VisibilityValue;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @Transform(trim)
  @IsOptional()
  @IsIn([...LANGUAGES], { message: 'El idioma del relato no es válido' })
  language?: (typeof LANGUAGES)[number];

  @ApiPropertyOptional({ enum: COUNTRY_CODES })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsIn([...COUNTRY_CODES], { message: 'El país del relato no es válido' })
  countryCode?: (typeof COUNTRY_CODES)[number];

  @ApiPropertyOptional({
    enum: VISUAL_CARD_THEMES,
    nullable: true,
    description: 'Tema de la tarjeta visual; `null` vuelve al formato de lectura normal.',
  })
  @IsOptional()
  @IsIn(VISUAL_CARD_THEMES, { message: 'El tema de la tarjeta visual no es válido' })
  visualCardTheme?: VisualCardThemeValue | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El aviso de contenido no puede superar los 80 caracteres' })
  contentWarning?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'La canción no puede superar los 120 caracteres' })
  musicLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  externalShare?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  guestReadable?: boolean;

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

  @ApiPropertyOptional({ enum: ['Hubo una conversación','Tomé una decisión o algo cambió','Nueva reflexión','Cierre que deseo compartir','Sin clasificación'] })
  @IsOptional()
  @IsIn(['Hubo una conversación','Tomé una decisión o algo cambió','Nueva reflexión','Cierre que deseo compartir','Sin clasificación'], { message: 'El tipo de continuación no es válido' })
  updateKind?: string;

  @ApiPropertyOptional({ description: 'Transcripción opcional del audio de esta etapa.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CONTENT_MAX_LENGTH, {
    message: 'La transcripción no puede superar los 5000 caracteres',
  })
  transcript?: string;
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

  @ApiPropertyOptional({ enum: ['Hubo una conversación','Tomé una decisión o algo cambió','Nueva reflexión','Cierre que deseo compartir','Sin clasificación'] })
  @IsOptional()
  @IsIn(['Hubo una conversación','Tomé una decisión o algo cambió','Nueva reflexión','Cierre que deseo compartir','Sin clasificación'], { message: 'El tipo de continuación no es válido' })
  updateKind?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Transcripción del audio; `null` para quitarla.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(STORY_CONTENT_MAX_LENGTH, {
    message: 'La transcripción no puede superar los 5000 caracteres',
  })
  transcript?: string | null;
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

export class ListWithdrawnQueryDto {
  @ApiPropertyOptional({ description: 'Id del último relato retirado; devuelve los siguientes.' })
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
}

export class ReportStoryDto {
  @ApiProperty({ enum: REPORT_REASONS, example: 'OFFENSIVE' })
  @IsIn(REPORT_REASONS, { message: 'La razón del reporte no es válida' })
  reason!: (typeof REPORT_REASONS)[number];
}

export class ListPublicStoriesQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda por texto en el título.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ enum: COUNTRY_CODES, description: 'Filtra por país del relato.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsIn([...COUNTRY_CODES], { message: 'El país del relato no es válido' })
  countryCode?: (typeof COUNTRY_CODES)[number];

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
