import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const NAME_MAX_LENGTH = 40;

// Normaliza Unicode (evita homoglifos), colapsa espacios y recorta extremos.
// El mismo criterio se aplica al leer y al escribir para no crear duplicados.
export function normalizeCatalogName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeCatalogName(value) : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Etiquetas/categorías: letras (con acentos), números, espacios y separadores
// simples. Se prohíben símbolos y emojis para que no sirvan de adorno de spam.
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '&+./-]*$/u;
const NAME_PATTERN_MESSAGE =
  'Solo puede contener letras, números, espacios y los separadores \' & + . / -';

// Color hexadecimal de 6 dígitos (#rrggbb). Se admite también la forma corta.
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class CreateCategoryDto {
  @ApiProperty({ example: 'Relaciones' })
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class UpdateCategoryDto {
  @ApiProperty({ example: 'Vínculos' })
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class CreateEmotionDto {
  @ApiProperty({ example: 'Esperanza' })
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;

  @ApiPropertyOptional({ example: '#37a978', description: 'Color en formato #rrggbb' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN, { message: 'El color debe ser un hexadecimal como #37a978' })
  colorHex?: string;
}

export class UpdateEmotionDto {
  @ApiPropertyOptional({ example: 'Serenidad' })
  @Transform(normalizeName)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name?: string;

  @ApiPropertyOptional({ example: '#4b83e5' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN, { message: 'El color debe ser un hexadecimal como #4b83e5' })
  colorHex?: string;
}

export class CreateTagDto {
  @ApiProperty({ example: 'Duelo' })
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}

export class UpdateTagDto {
  @ApiProperty({ example: 'Pérdida' })
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(NAME_MAX_LENGTH)
  @Matches(NAME_PATTERN, { message: NAME_PATTERN_MESSAGE })
  name!: string;
}
