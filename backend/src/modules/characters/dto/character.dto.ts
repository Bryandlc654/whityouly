import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  IsArray,
  IsInt,
  Min,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  MinLength,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CHARACTER_NAME_MAX_LENGTH = 30;
const BIO_MAX_LENGTH = 500;
const TAGLINE_MAX_LENGTH = 120;
const MAX_INTERESTS = 8;
const INTEREST_NAME_MAX_LENGTH = 40;
const URL_MAX_LENGTH = 2048;

// Normaliza Unicode (evita homoglifos), colapsa espacios y recorta extremos.
const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/g, ' ').trim()
    : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// El lema es una sola línea: los saltos se convierten en espacios.
const singleLine = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

// Los intereses se envían por nombre, que es lo que el usuario elige del
// catálogo. El servidor nunca confía en el identificador que llegue.
const normalizeInterests = ({ value }: { value: unknown }): unknown => {
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

// Letras/números Unicode, espacios, guion, punto y guion bajo.
// El primer carácter no puede ser un separador.
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u;
const NAME_PATTERN_MESSAGE =
  'El seudónimo solo puede contener letras, números, espacios, guiones, puntos y guion bajo';

export class PrivacySettingsDto {
  @ApiPropertyOptional({ enum: ['PUBLIC', 'PRIVATE'], example: 'PUBLIC' })
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'], { message: 'La visibilidad debe ser PUBLIC o PRIVATE' })
  profileVisibility?: 'PUBLIC' | 'PRIVATE';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showAvatar?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showBio?: boolean;
}

export class CreateCharacterDto {
  @ApiProperty({ example: 'ElViajeroSolitario' })
  @Transform(normalizeName)
  @IsString()
  @MinLength(3, { message: 'El seudónimo debe tener al menos 3 caracteres' })
  @MaxLength(CHARACTER_NAME_MAX_LENGTH, { message: 'El seudónimo no puede superar los 30 caracteres' })
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;

  @ApiPropertyOptional({ example: 'Amante de la escritura y los viajes.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX_LENGTH, { message: 'La biografía no puede superar los 500 caracteres' })
  bio?: string;

  @ApiPropertyOptional({ example: 'Escribo de madrugada y no duermo bien.' })
  @Transform(singleLine)
  @IsOptional()
  @IsString()
  @MaxLength(TAGLINE_MAX_LENGTH, { message: 'La descripción no puede superar los 120 caracteres' })
  tagline?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['Música', 'Naturaleza'] })
  @Transform(normalizeInterests)
  @IsOptional()
  @IsArray({ message: 'Los intereses deben enviarse como una lista' })
  @ArrayMaxSize(MAX_INTERESTS, {
    message: `Elige como máximo ${MAX_INTERESTS} intereses`,
  })
  @ArrayUnique({ message: 'Hay intereses repetidos' })
  @IsString({ each: true })
  @MaxLength(INTEREST_NAME_MAX_LENGTH, { each: true })
  interests?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.whityouly.com/avatars/abc.png' })
  @Transform(trim)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true, require_tld: true },
    { message: 'El avatar debe ser una URL https válida' },
  )
  @MaxLength(URL_MAX_LENGTH)
  avatarUrl?: string;

  @ApiPropertyOptional({ type: PrivacySettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings?: PrivacySettingsDto;
}

export class UpdateCharacterDto {
  @ApiPropertyOptional({ example: 'ElViajero' })
  @Transform(normalizeName)
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El seudónimo debe tener al menos 3 caracteres' })
  @MaxLength(CHARACTER_NAME_MAX_LENGTH, { message: 'El seudónimo no puede superar los 30 caracteres' })
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name?: string;

  @ApiPropertyOptional({ example: 'https://cdn.whityouly.com/avatars/abc.png' })
  @Transform(trim)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true, require_tld: true },
    { message: 'El avatar debe ser una URL https válida' },
  )
  @MaxLength(URL_MAX_LENGTH)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: 'Actualizando mi bio...' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX_LENGTH, { message: 'La biografía no puede superar los 500 caracteres' })
  bio?: string | null;

  @ApiPropertyOptional({ example: 'Escribo de madrugada y no duermo bien.' })
  @Transform(singleLine)
  @IsOptional()
  @IsString()
  @MaxLength(TAGLINE_MAX_LENGTH, { message: 'La descripción no puede superar los 120 caracteres' })
  tagline?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['Música', 'Naturaleza'] })
  @Transform(normalizeInterests)
  @IsOptional()
  @IsArray({ message: 'Los intereses deben enviarse como una lista' })
  @ArrayMaxSize(MAX_INTERESTS, { message: `Elige como máximo ${MAX_INTERESTS} intereses` })
  @ArrayUnique({ message: 'Hay intereses repetidos' })
  @IsString({ each: true })
  @MaxLength(INTEREST_NAME_MAX_LENGTH, { each: true })
  interests?: string[];

  @ApiPropertyOptional({ type: PrivacySettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings?: PrivacySettingsDto;
}

export class NameAvailabilityQueryDto {
  @Transform(normalizeName)
  @IsString()
  @MinLength(3, { message: 'El seudónimo debe tener al menos 3 caracteres' })
  @MaxLength(CHARACTER_NAME_MAX_LENGTH, { message: 'El seudónimo no puede superar los 30 caracteres' })
  name!: string;
}

export class SearchCharactersQueryDto {
  @ApiProperty({ example: 'Luz', description: 'Prefijo del seudónimo a buscar.' })
  @Transform(normalizeName)
  @IsString()
  @MinLength(1, { message: 'Escribe al menos un carácter' })
  @MaxLength(CHARACTER_NAME_MAX_LENGTH, { message: 'La búsqueda no puede superar los 30 caracteres' })
  q!: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 30.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
