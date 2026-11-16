import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const ADMIN_STORY_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'HIDDEN',
  'REPORTED',
  'MODERATED',
  'WITHDRAWN',
  'DELETED',
] as const;
export type AdminStoryStatus = (typeof ADMIN_STORY_STATUSES)[number];

export const ADMIN_COMMENT_STATUSES = ['ACTIVE', 'HIDDEN', 'MODERATED', 'DELETED'] as const;
export type AdminCommentStatus = (typeof ADMIN_COMMENT_STATUSES)[number];

export const CONTENT_VISIBILITY_ACTIONS = ['HIDE', 'RESTORE'] as const;
export type ContentVisibilityAction = (typeof CONTENT_VISIBILITY_ACTIONS)[number];

export const CONTENT_REASON_MIN_LENGTH = 5;
export const CONTENT_REASON_MAX_LENGTH = 1000;

export class ListAdminStoriesQueryDto {
  @ApiPropertyOptional({ description: 'Busca por título, seudónimo o correo del autor.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  search?: string;

  @ApiPropertyOptional({ enum: ADMIN_STORY_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_STORY_STATUSES, { message: 'El estado del relato no es válido' })
  status?: AdminStoryStatus;

  @ApiPropertyOptional({ description: 'Id del último relato recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ListAdminCommentsQueryDto {
  @ApiPropertyOptional({ description: 'Busca por texto, relato, seudónimo o correo del autor.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  search?: string;

  @ApiPropertyOptional({ enum: ADMIN_COMMENT_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_COMMENT_STATUSES, { message: 'El estado del comentario no es válido' })
  status?: AdminCommentStatus;

  @ApiPropertyOptional({ description: 'Filtra los comentarios de un relato concreto.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  storyId?: string;

  @ApiPropertyOptional({ description: 'Id del último comentario recibido.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 50.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ContentVisibilityDto {
  @ApiProperty({ enum: CONTENT_VISIBILITY_ACTIONS })
  @IsIn(CONTENT_VISIBILITY_ACTIONS, { message: 'La acción no es válida' })
  action!: ContentVisibilityAction;

  @ApiProperty({ description: 'Motivo auditado de la medida.' })
  @Transform(trim)
  @IsString()
  @MinLength(CONTENT_REASON_MIN_LENGTH, {
    message: `Explica el motivo (mínimo ${CONTENT_REASON_MIN_LENGTH} caracteres)`,
  })
  @MaxLength(CONTENT_REASON_MAX_LENGTH)
  reason!: string;
}

export class DeleteContentDto {
  @ApiProperty({ description: 'Motivo auditado de la eliminación.' })
  @Transform(trim)
  @IsString()
  @MinLength(CONTENT_REASON_MIN_LENGTH, {
    message: `Explica el motivo (mínimo ${CONTENT_REASON_MIN_LENGTH} caracteres)`,
  })
  @MaxLength(CONTENT_REASON_MAX_LENGTH)
  reason!: string;
}
