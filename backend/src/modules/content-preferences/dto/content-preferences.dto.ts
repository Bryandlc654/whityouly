import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const AUTHOR_PREFERENCE_KINDS = ['MUTE', 'BLOCK', 'LESS'] as const;
export type AuthorPreferenceKindValue = (typeof AUTHOR_PREFERENCE_KINDS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAuthorPreferenceDto {
  @ApiProperty({ example: 'LuzEnPausa' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  authorName!: string;

  @ApiProperty({ enum: AUTHOR_PREFERENCE_KINDS })
  @IsIn(AUTHOR_PREFERENCE_KINDS, { message: 'La preferencia no es válida' })
  kind!: AuthorPreferenceKindValue;
}
