import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { COMMENT_MAX_LENGTH } from '../comment-sanitize';

export abstract class CommentContentDto {
  @ApiProperty({ example: 'Gracias por compartir esto.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'El comentario no puede estar vacío' })
  @MaxLength(COMMENT_MAX_LENGTH, { message: `El comentario no puede superar los ${COMMENT_MAX_LENGTH} caracteres` })
  content!: string;
}

export class CreateCommentDto extends CommentContentDto {
  @ApiPropertyOptional({
    description: 'Id del comentario al que se responde (una sola profundidad de respuesta).',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El comentario original no es válido' })
  parentId?: string;
}

export class EditCommentDto extends CommentContentDto {}

/** Razones admitidas para reportar. Es una lista cerrada, no texto libre. */
export const REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'OFFENSIVE',
  'SEXUAL',
  'THREATS',
  'IMPERSONATION',
  'ILLEGAL',
  'OTHER',
] as const;

export class ReportCommentDto {
  @ApiProperty({ enum: REPORT_REASONS, example: 'OFFENSIVE' })
  @IsIn(REPORT_REASONS, { message: 'La razón del reporte no es válida' })
  reason!: (typeof REPORT_REASONS)[number];
}

export class ListCommentsQueryDto {
  @ApiPropertyOptional({ description: 'Id del último comentario recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ default: 50, description: 'Entre 1 y 100. El servicio ajusta el tope.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}